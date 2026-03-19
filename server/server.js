// Express + Socket.IO server: REST API, static file serving, and real-time overlay communication.
'use strict';

require('dotenv').config();

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — allow overlays served from a different port / OBS browser source
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-token');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// REST API — routes from src/ (TypeScript compiled to dist/ in prod,
// loaded with tsx/ts-node in dev via "npm run dev:ts")
try {
  const { initEmitter }  = require('./src/socket/emitter');
  initEmitter(io);

  const authRouter        = require('./src/api/auth').default;
  const teamsRouter       = require('./src/api/teams').default;
  const vehiclesRouter    = require('./src/api/vehicles').default;
  const controlsRouter    = require('./src/api/controls').default;
  const racetracksRouter  = require('./src/api/racetracks').default;
  const pilotsRouter      = require('./src/api/pilots').default;
  const racesRouter       = require('./src/api/races').default;
  const ocrRouter         = require('./src/api/ocr').default;
  const raceEventsRouter  = require('./src/api/race-events').default;

  app.use('/api/auth',         authRouter);
  app.use('/api/teams',        teamsRouter);
  app.use('/api/vehicles',     vehiclesRouter);
  app.use('/api/controls',     controlsRouter);
  app.use('/api/racetracks',   racetracksRouter);
  app.use('/api/pilots',       pilotsRouter);
  app.use('/api/races',        racesRouter);
  app.use('/api/ocr',          ocrRouter);
  app.use('/api/race-events',  raceEventsRouter);

  // 500ms broadcast interval — keeps overlays in sync during active races
  const { getContext }      = require('./src/engine/race-context');
  const { broadcastRaceState } = require('./src/socket/emitter');
  setInterval(() => {
    try {
      const ctx = getContext();
      if (ctx && (ctx.raceStatus === 'STARTED' || ctx.raceStatus === 'PAUSED')) {
        broadcastRaceState(ctx);
      }
    } catch { /* ignore */ }
  }, 500);

  console.log('✅ REST API routes loaded');
} catch (err) {
  console.error('⚠️  Could not load REST API routes:', err.message);
  console.error('   Run "npm run build" or use "npm run dev:ts" for TypeScript support.');
}

// Health check — used by reset.js to wait for server readiness
app.get('/health', (_req, res) => res.json({ ok: true }));

// Static files — dashboard, overlays, pilot-app
app.use(express.static(path.join(__dirname)));

// Socket.IO — real-time overlay communication
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Dashboard identifies itself to receive server-only events (dnf-warning, etc.)
  if (socket.handshake.query.role === 'dashboard') {
    socket.join('dashboard');
  }

  // Broadcast full race state to all clients (leaderboard overlay)
  socket.on('race-update', (data) => {
    socket.broadcast.emit('race-data', data);
  });

  // Broadcast race events: finished, incident, fastest-lap
  socket.on('race-event', (data) => {
    socket.broadcast.emit('race-event', data);
  });

  // Race lifecycle signals → overlay banners
  socket.on('race-restarted', () => {
    socket.broadcast.emit('race-restarted');
  });

  socket.on('race-resumed', () => {
    socket.broadcast.emit('race-resumed');
  });

  // Pilot list visibility toggle (dashboard → leaderboard)
  socket.on('toggle-pilots-visibility', (data) => {
    socket.broadcast.emit('toggle-pilots-visibility', data);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status ?? 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// Start
const PORT = parseInt(process.env.PORT ?? '3000', 10);

server.listen(PORT, () => {
  console.log('');
  console.log('🏁 Circus Racing server started');
  console.log(`   Dashboard:   http://localhost:${PORT}/dashboard/`);
  console.log(`   Leaderboard: http://localhost:${PORT}/overlays/leaderboard/`);
  console.log(`   Race Alert:  http://localhost:${PORT}/overlays/race-alert/`);
  console.log(`   Pilot app:   http://localhost:${PORT}/pilot-app/register.html`);
  console.log(`   API:         http://localhost:${PORT}/api/`);
  console.log('');
});

module.exports = { app, io };
