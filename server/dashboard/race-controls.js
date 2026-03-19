// race-controls.js — Button handlers for race actions (calls race-api.js).
// All actions send a REST command; the server broadcasts the updated state.

let _countdownActive = false;

async function startRace() {
    const id     = window.activeRaceId;
    const status = window.currentRaceState?.status;
    if (!id) { alert("Load a race first"); return; }
    try {
        if (status === "PAUSED") {
            await raceResume(id);
        } else {
            await raceStart(id);
        }
    } catch (e) { alert(e.message); }
}

async function pauseRace() {
    const id = window.activeRaceId;
    if (!id) return;
    try { await racePause(id); } catch (e) { alert(e.message); }
}

async function endRaceManually() {
    const id = window.activeRaceId;
    if (!id) return;
    try { await raceFinish(id); } catch (e) { alert(e.message); }
}

async function resetRace() {
    const id = window.activeRaceId;
    if (!id) return;
    if (!confirm("Reset the race to zero?")) return;
    try {
        stopCountdown(false);
        await raceReset(id);
    } catch (e) { alert(e.message); }
}

async function reloadPilots() {
    const id = window.activeRaceId;
    if (!id) { alert("Load a race first"); return; }
    try { await raceLoad(id); } catch (e) { alert(e.message); }
}

async function changeLap(pilotId, delta) {
    const id     = window.activeRaceId;
    const state  = window.currentRaceState;
    if (!id || state?.status !== "STARTED" || state?.trackingMode !== "manual") return;
    try { await manualLap(id, pilotId, delta); } catch (e) { alert(e.message); }
}

async function movePilot(pilotId, direction) {
    const id    = window.activeRaceId;
    const state = window.currentRaceState;
    if (!id || state?.trackingMode !== "manual") return;
    try { await manualReorder(id, pilotId, direction); } catch (e) { alert(e.message); }
}

async function jumpToPosition(pilotId, newPosValue) {
    const id       = window.activeRaceId;
    const state    = window.currentRaceState;
    const position = parseInt(newPosValue);
    if (!id || state?.trackingMode !== "manual") return;
    if (isNaN(position) || position < 1) return;
    try { await manualPosition(id, pilotId, position); } catch (e) {
        alert(e.message);
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
    try { await manualDnf(id, pilotId); } catch (e) { alert(e.message); }
}

// add pilot to race from the Available Pilots table

async function addPilotToRace(pilotId) {
    const id = window.activeRaceId;
    if (!id)      { alert("Load a race first"); return; }
    if (!pilotId) return;
    try {
        await adminAddEntryRequest(id, pilotId);
        await reloadPilots();
        if (typeof refreshPilotsAndEntries === "function") await refreshPilotsAndEntries();
        else if (typeof displayPilots === "function") displayPilots();
    } catch (e) { alert(e.message); }
}

// remove pilot from race

async function removeFromRace(entryId) {
    const id = window.activeRaceId;
    if (!id || !entryId) return;
    if (!confirm("Remove this pilot from the race?")) return;
    try {
        await adminRevokeEntry(id, entryId);
    } catch (e) { alert(e.message); }
}

// countdown

async function startCountdown() {
    const id          = window.activeRaceId;
    const status      = window.currentRaceState?.status;
    const durationSec = parseInt(document.getElementById("countdown-duration")?.value) || 0;
    if (!id) { alert("Load a race first"); return; }
    if (status === "STARTED" || status === "PAUSED" || status === "FINISHED") {
        alert("Countdown can only be started before the race.");
        return;
    }
    if (durationSec <= 0) { startRace(); return; }
    try {
        await raceCountdown(id, durationSec);
        _countdownActive = true;
        updateCountdownUI();
    } catch (e) { alert(e.message); }
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
    } catch (e) { alert(e.message); }
}

async function ignoreDnf(pilotId) {
    const id = window.activeRaceId;
    if (!id) return;
    try {
        await ignoreDnfRequest(id, pilotId);
        (window._dnfWarningPilots ?? new Set()).delete(pilotId);
        if (typeof renderDnfWarningPanel === "function") renderDnfWarningPanel();
    } catch (e) { alert(e.message); }
}

// overlay pilots visibility

function togglePilotsVisibility() {
    const chip = document.getElementById("btn-pilots-toggle");
    const visible = chip ? chip.hasAttribute("selected") : true;
    if (window.raceSocket) window.raceSocket.emit("toggle-pilots-visibility", { visible });
}

// chrono toggle (chip in index.html)

async function toggleChrono() {
    const chip = document.getElementById("btn-chrono-toggle");
    const on   = chip ? chip.selected : true;
    if (typeof updateChronoSelectVisibility === "function") updateChronoSelectVisibility(on);
    if (typeof onTimingEnabledChange === "function") onTimingEnabledChange(on);
}
