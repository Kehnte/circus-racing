// race-controls.js — Button handlers for race actions (calls race-api.js).
// All actions send a REST command; the server broadcasts the updated state.

let _countdownActive = false;

async function startRace() {
    const id     = window.activeRaceId;
    const status = window.currentRaceState?.status;
    if (!id) { console.warn("Load a race first"); return; }
    try {
        if (status === "PAUSED") {
            await raceResume(id);
        } else {
            await raceStart(id);
        }
    } catch (e) { console.warn(e.message); }
}

async function pauseRace() {
    const id = window.activeRaceId;
    if (!id) return;
    try { await racePause(id); } catch (e) { console.warn(e.message); }
}

async function endRaceManually() {
    const id = window.activeRaceId;
    if (!id) return;
    try { await raceFinish(id); } catch (e) { console.warn(e.message); }
}

async function resetRace() {
    const id = window.activeRaceId;
    if (!id) return;
    try {
        stopCountdown(false);
        await raceReset(id);
    } catch (e) { console.warn(e.message); }
}

async function reloadPilots() {
    const id = window.activeRaceId;
    if (!id) { console.warn("Load a race first"); return; }
    try { await raceLoad(id); } catch (e) { console.warn(e.message); }
}

async function changeLap(pilotId, delta) {
    const id     = window.activeRaceId;
    const state  = window.currentRaceState;
    if (!id || state?.status !== "STARTED" || state?.trackingMode !== "manual") return;
    try { await manualLap(id, pilotId, delta); } catch (e) { console.warn(e.message); }
}

async function movePilot(pilotId, direction) {
    const id    = window.activeRaceId;
    const state = window.currentRaceState;
    if (!id || state?.trackingMode !== "manual") return;
    try { await manualReorder(id, pilotId, direction); } catch (e) { console.warn(e.message); }
}

async function jumpToPosition(pilotId, newPosValue) {
    const id       = window.activeRaceId;
    const state    = window.currentRaceState;
    const position = parseInt(newPosValue);
    if (!id || state?.trackingMode !== "manual") return;
    if (isNaN(position) || position < 1) return;
    try { await manualPosition(id, pilotId, position); } catch (e) {
        console.warn(e.message);
        // force a re-render to restore the value
        if (typeof renderRaceTable === "function" && window.currentRaceState) {
            renderRaceTable(window.currentRaceState);
        }
    }
}

async function toggleDNF(pilotId) {
    const id    = window.activeRaceId;
    const state = window.currentRaceState;
    if (!id || state?.trackingMode !== "manual") return;
    try { await manualDnf(id, pilotId); } catch (e) { console.warn(e.message); }
}

// delete the active race

async function deleteRace() {
    const id = window.activeRaceId;
    if (!id) { console.warn("Load a race first"); return; }
    try {
        await raceDelete(id);
        window.activeRaceId = null;
        if (typeof loadActiveRaceList === "function") loadActiveRaceList();
        if (typeof loadActiveRace === "function") loadActiveRace("");
    } catch (e) { console.warn(e.message); }
}

// add pilot to race from the Available Pilots table

async function addPilotToRace(pilotId) {
    const id = window.activeRaceId;
    if (!id)      { console.warn("Load a race first"); return; }
    if (!pilotId) return;
    try {
        await adminAddEntryRequest(id, pilotId);
    } catch (e) { console.warn(e.message); }
}

// countdown

async function startCountdown() {
    const id          = window.activeRaceId;
    const status      = window.currentRaceState?.status;
    const durationSec = parseInt(document.getElementById("countdown-duration")?.value) || 0;
    if (!id) { console.warn("Load a race first"); return; }
    if (status === "STARTED" || status === "PAUSED" || status === "FINISHED") {
        console.warn("Countdown can only be started before the race.");
        return;
    }
    if (durationSec <= 0) { startRace(); return; }
    try {
        await raceCountdown(id, durationSec);
        _countdownActive = true;
        updateCountdownUI();
    } catch (e) { console.warn(e.message); }
}

async function stopCountdown(callApi = true) {
    const id = window.activeRaceId;
    _countdownActive = false;
    updateCountdownUI();
    if (callApi && id) {
        try { await raceCountdownStop(id); } catch (_) { /* best-effort */ }
    }
}

function updateCountdownUI() {
    const btn     = document.getElementById("btn-countdown");
    const stopBtn = document.getElementById("btn-countdown-stop");
    const status  = window.currentRaceState?.status;
    const canStart = status !== "STARTED" && status !== "PAUSED" && status !== "FINISHED";
    if (btn)     btn.disabled          = _countdownActive || !canStart;
    if (stopBtn) stopBtn.style.display = _countdownActive ? "" : "none";
}

// AUTO mode — DNF warning management

async function confirmDnf(pilotId) {
    const id = window.activeRaceId;
    if (!id) return;
    try {
        await confirmDnfRequest(id, pilotId);
        (window._dnfWarningPilots ?? new Set()).delete(pilotId);
        if (typeof renderDnfWarningPanel === "function") renderDnfWarningPanel();
    } catch (e) { console.warn(e.message); }
}

async function ignoreDnf(pilotId) {
    const id = window.activeRaceId;
    if (!id) return;
    try {
        await ignoreDnfRequest(id, pilotId);
        (window._dnfWarningPilots ?? new Set()).delete(pilotId);
        if (typeof renderDnfWarningPanel === "function") renderDnfWarningPanel();
    } catch (e) { console.warn(e.message); }
}

// chrono toggle (chip in index.html)

async function toggleChrono() {
    const state = window.currentRaceState;
    const on = !(state?.timingEnabled ?? true);
    const chip = document.getElementById("btn-chrono-toggle");
    if (chip) chip.selected = on;
    if (typeof updateChronoSelectVisibility === "function") updateChronoSelectVisibility(on);
    if (typeof onTimingEnabledChange === "function") onTimingEnabledChange(on);
}
