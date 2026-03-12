const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the entire project as static files
app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('A user connected');

    // Broadcast full race state to all clients
    socket.on('race-update', (data) => {
        socket.broadcast.emit('race-data', data);
    });

    // Broadcast race events (finished, incident, fastest-lap) to all clients
    socket.on('race-event', (data) => {
        socket.broadcast.emit('race-event', data);
    });

    // Broadcast race reset signal so the leaderboard can flash the banner
    socket.on('race-restarted', () => {
        socket.broadcast.emit('race-restarted');
    });

    // Broadcast race resumed signal so the leaderboard can flash the banner
    socket.on('race-resumed', () => {
        socket.broadcast.emit('race-resumed');
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
    
    // Relay pilot list visibility toggle from dashboard to leaderboard
    socket.on("toggle-pilots-visibility", (data) => {
        socket.broadcast.emit("toggle-pilots-visibility", data);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Dashboard:   http://localhost:${PORT}/dashboard/`);
    console.log(`Leaderboard: http://localhost:${PORT}/overlays/leaderboard/`);
    console.log(`Race Alert:  http://localhost:${PORT}/overlays/race-alert/`);
});
