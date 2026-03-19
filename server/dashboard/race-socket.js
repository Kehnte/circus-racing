// race-socket.js — Connexion Socket.IO dashboard, réception du broadcast race-state,
// stockage de l'état courant, délégation au rendu.

const raceSocket = io("/?role=dashboard");

/** État courant de la course, mis à jour à chaque broadcast race-state. */
window.currentRaceState = null;

/** Socket exposé pour les modules qui émettent (ex: toggle-pilots-visibility). */
window.raceSocket = raceSocket;

/** Ensemble des pilotIds avec WARNING_DNF actif. */
const _dnfWarningPilots = new Set();
window._dnfWarningPilots = _dnfWarningPilots;

raceSocket.on("race-state", (state) => {
    window.currentRaceState = state;

    // Synchroniser le set DNF à partir de l'état pilots
    _dnfWarningPilots.clear();
    if (state.pilots) {
        state.pilots.forEach((p) => {
            if (p.status === "WARNING_DNF") _dnfWarningPilots.add(p.id);
        });
    }

    if (typeof renderRaceTable    === "function") renderRaceTable(state);
    if (typeof renderDnfWarningPanel === "function") renderDnfWarningPanel();
});

// Compat arrière : pilots.js lit isTeamManagementActive
Object.defineProperty(window, "isTeamManagementActive", {
    get: () => window.currentRaceState?.teamDisplayMode !== "hidden",
    configurable: true,
});
