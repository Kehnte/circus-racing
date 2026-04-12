// Express + Socket.IO server: REST API, static file serving, and real-time overlay communication.
import 'dotenv/config';

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import * as http from 'http';
import { Server } from 'socket.io';
import * as path from 'path';

import { initEmitter, broadcastRaceState, emitDashboard, emitAll } from './src/socket/emitter.js';
import { FEATURES } from './src/utils/features.js';
import authRouter        from './src/api/auth.js';
import teamsRouter       from './src/api/teams.js';
import vehiclesRouter    from './src/api/vehicles.js';
import controlsRouter    from './src/api/controls.js';
import racetracksRouter  from './src/api/racetracks.js';
import pilotsRouter      from './src/api/pilots.js';
import racesRouter       from './src/api/races.js';
import raceEventsRouter  from './src/api/race-events.js';
import adminRouter       from './src/api/admin.js';
import featuresRouter    from './src/api/features.js';
import ocrRouter         from './src/api/ocr.js';
import streamingRouter   from './src/api/streaming.js';
import { getContext }    from './src/engine/race-context.js';
import { getOcrStatusMap } from './src/engine/ocr-tracker.js';

const app: Express      = express();
const server: http.Server = http.createServer(app);
const io: Server        = new Server(server);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — allow overlays served from a different port / OBS browser source
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-token');
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// Ping — no auth, used by the monitor to check server reachability
app.get('/api/ping', (_req: Request, res: Response) => res.json({ ok: true }));

initEmitter(io);

app.use('/api/auth',         authRouter);
app.use('/api/teams',        teamsRouter);
app.use('/api/vehicles',     vehiclesRouter);
app.use('/api/controls',     controlsRouter);
app.use('/api/racetracks',   racetracksRouter);
app.use('/api/pilots',       pilotsRouter);
app.use('/api/races',        racesRouter);
app.use('/api/race-events',  raceEventsRouter);
app.use('/api/admin',        adminRouter);
app.use('/api/features',     featuresRouter);

// Feature-gated routes — modules are imported but routes only registered when enabled
if (FEATURES.OCR)       app.use('/api/ocr',       ocrRouter);
if (FEATURES.STREAMING) app.use('/api/streaming',  streamingRouter);

// 500ms broadcast interval — keeps overlays in sync whenever a race is loaded
setInterval(() => {
  try {
    const ctx = getContext();
    if (ctx) broadcastRaceState(ctx);
  } catch (err) { console.error('Broadcast error:', err); }
}, 500);

// 2s OCR status broadcast — only when OCR feature is enabled
if (FEATURES.OCR) {
  setInterval(() => {
    try {
      emitDashboard('ocr-status', getOcrStatusMap());
    } catch (err) { console.error('OCR status broadcast error:', err); }
  }, 2000);
}

// 5s stream-status broadcast — polls mediamtx API, only when STREAMING is enabled
const MEDIAMTX_API = process.env.MEDIAMTX_API ?? 'http://localhost:9997';
if (FEATURES.STREAMING) {
  setInterval(() => {
    fetch(`${MEDIAMTX_API}/v3/paths/list`)
      .then((r) => r.ok ? r.json() : Promise.resolve({ items: [] }))
      .then((data: unknown) => {
        const typed = data as { items?: Array<{ name: string; ready: boolean }> };
        const paths = (typed.items ?? []).filter((p) => p.ready).map((p) => p.name);
        emitAll('stream-status', { paths });
      })
      .catch(() => { /* mediamtx not running — skip silently */ });
  }, 5000);
}

// Health check — used by reset.js to wait for server readiness
app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

// Redirect root to dashboard
app.get('/', (_req: Request, res: Response) => res.redirect('/dashboard/'));

// React dashboard SPA — served under /dashboard, before generic static middleware
const frontendDist = path.join(__dirname, 'frontend', 'dist');
app.use('/dashboard', express.static(frontendDist));
app.get('/dashboard/*splat', (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Uploaded avatars
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Static files — overlays and shared assets
app.use(express.static(path.join(__dirname)));

// Socket.IO — real-time overlay communication
io.on('connection', (socket) => {
  // Dashboard identifies itself to receive server-only events
  if (socket.handshake.query.role === 'dashboard') {
    socket.join('dashboard');
  }

  // Send current race state to newly connected clients (leaderboard, overlays)
  try {
    const ctx = getContext();
    if (ctx) broadcastRaceState(ctx);
  } catch (err) { console.error('Socket connect broadcast error:', err); }
});

// Global error handler
app.use((err: { status?: number; message: string; stack?: string }, _req: Request, res: Response, _next: NextFunction) => {
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
  console.log(`   API:         http://localhost:${PORT}/api/`);
  console.log('');
});

export { app, io };
