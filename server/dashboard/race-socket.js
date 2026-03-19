// race-socket.js — Socket.IO dashboard connection, receives race-state broadcast,
// stores current state, delegates to rendering.

const raceSocket = io("/?role=dashboard");

// current race state, updated on each race-state broadcast
window.currentRaceState = null;

// exposed socket for modules that emit (e.g. toggle-pilots-visibility)
window.raceSocket = raceSocket;

// set of pilotIds with active WARNING_DNF
const _dnfWarningPilots = new Set();
window._dnfWarningPilots = _dnfWarningPilots;

raceSocket.on("race-state", (state) => {
    window.currentRaceState = state;

    // sync DNF set from pilot states
    _dnfWarningPilots.clear();
    if (state.pilots) {
        state.pilots.forEach((p) => {
            if (p.status === "WARNING_DNF") _dnfWarningPilots.add(p.id);
        });
    }

    if (typeof renderRaceTable    === "function") renderRaceTable(state);
    if (typeof renderDnfWarningPanel === "function") renderDnfWarningPanel();
});

// backward compat: pilots.js reads isTeamManagementActive
Object.defineProperty(window, "isTeamManagementActive", {
    get: () => window.currentRaceState?.teamDisplayMode !== "hidden",
    configurable: true,
});
