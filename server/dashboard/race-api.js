// race-api.js — Appels API REST pour les commandes de course
// (start, pause, resume, finish, reset, load, contrôles manuels, countdown)

// --- Cycle de vie ---

async function raceLoad(raceId) {
    return apiPost(`/races/${raceId}/load`);
}

async function raceStart(raceId) {
    return apiPost(`/races/${raceId}/start`);
}

async function racePause(raceId) {
    return apiPost(`/races/${raceId}/pause`);
}

async function raceResume(raceId) {
    return apiPost(`/races/${raceId}/resume`);
}

async function raceFinish(raceId) {
    return apiPost(`/races/${raceId}/finish`);
}

async function raceReset(raceId) {
    return apiPost(`/races/${raceId}/reset`);
}

// --- Contrôles manuels (mode MANUEL) ---

async function manualLap(raceId, pilotId, delta) {
    return apiPost(`/race-events/races/${raceId}/manual-lap`, { pilotId, delta });
}

async function manualPosition(raceId, pilotId, position) {
    return apiPost(`/race-events/races/${raceId}/manual-position`, { pilotId, position });
}

async function manualReorder(raceId, pilotId, direction) {
    return apiPost(`/race-events/races/${raceId}/manual-reorder`, { pilotId, direction });
}

async function manualDnf(raceId, pilotId) {
    return apiPost(`/race-events/races/${raceId}/manual-dnf`, { pilotId });
}

async function raceGridOrder(raceId, pilotIds) {
    return apiPost(`/race-events/races/${raceId}/grid-order`, { pilotIds });
}

// --- Countdown ---

async function raceCountdown(raceId, seconds) {
    return apiPost(`/race-events/races/${raceId}/countdown`, { seconds });
}

async function raceCountdownStop(raceId) {
    return apiPost(`/race-events/races/${raceId}/countdown-stop`);
}

// --- Mode AUTO ---

async function confirmDnfRequest(raceId, pilotId) {
    return apiPost(`/race-events/races/${raceId}/confirm-dnf/${pilotId}`);
}

async function ignoreDnfRequest(raceId, pilotId) {
    return apiPost(`/race-events/races/${raceId}/ignore-dnf/${pilotId}`);
}

async function overridePositionRequest(raceId, pilotId, position) {
    return apiPost(`/race-events/races/${raceId}/override-position`, { pilotId, position });
}

// --- Inscriptions ---

async function adminAddEntryRequest(raceId, pilotId) {
    return apiPost(`/races/${raceId}/entries/admin`, { pilotId });
}

// --- Paramètres course ---

async function patchRaceSettings(raceId, body) {
    return apiPatch(`/races/${raceId}`, body);
}
