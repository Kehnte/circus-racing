const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve project folders
app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté');

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
        console.log("Un utilisateur s'est déconnecté");
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
    console.log(`Le Manager sera sur http://localhost:${PORT}/race-manager/race-manager.html`);
    console.log(`Le Leaderboard sera sur http://localhost:${PORT}/leaderboard/leaderboard.html`);
    console.log(`L'Event Row sera sur http://localhost:${PORT}/event-row/event-row.html`);
});