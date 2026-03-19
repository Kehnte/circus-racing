// race-controls.js — Handlers des boutons de course (appelle race-api.js).
// Toutes les actions envoient une commande REST ; le serveur broadcast l'état mis à jour.

let _countdownActive = false;

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

async function startRace() {
    const id     = window.activeRaceId;
    const status = window.currentRaceState?.status;
    if (!id) { alert("Charger une course d'abord"); return; }
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
    if (!confirm("Remettre la course à zéro ?")) return;
    try {
        stopCountdown(false);
        await raceReset(id);
    } catch (e) { alert(e.message); }
}

async function reloadPilots() {
    const id = window.activeRaceId;
    if (!id) { alert("Charger une course d'abord"); return; }
    try { await raceLoad(id); } catch (e) { alert(e.message); }
}

// ---------------------------------------------------------------------------
// Contrôles manuels (mode MANUEL)
// ---------------------------------------------------------------------------

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
        // Forcer un re-render pour remettre la valeur
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

// ---------------------------------------------------------------------------
// Admin direct-add
// ---------------------------------------------------------------------------

async function adminAddPilot() {
    const id      = window.activeRaceId;
    const select  = document.getElementById("add-pilot-select");
    const pilotId = select?.value;
    if (!id)      { alert("Charger une course d'abord"); return; }
    if (!pilotId) { alert("Sélectionner un pilote"); return; }
    try {
        await adminAddEntryRequest(id, pilotId);
        await reloadPilots(); // recharge le contexte depuis les entrées validées
        updateAddPilotSelect();
    } catch (e) { alert(e.message); }
}

/** Peuple le select "ajouter un pilote" avec ceux qui ne sont pas déjà dans la course. */
function updateAddPilotSelect() {
    const select = document.getElementById("add-pilot-select");
    if (!select) return;
    const inRace = new Set((window.currentRaceState?.pilots ?? []).map(p => p.id));
    select.innerHTML = '<option value="">— Sélectionner un pilote —</option>';
    const allPilots  = typeof pilots !== "undefined" ? pilots : [];
    allPilots.forEach(p => {
        if (inRace.has(p.id)) return;
        const opt       = document.createElement("option");
        opt.value       = p.id;
        opt.textContent = p.displayName ?? p.name ?? p.id;
        select.appendChild(opt);
    });
}

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

async function startCountdown() {
    const id          = window.activeRaceId;
    const status      = window.currentRaceState?.status;
    const durationSec = parseInt(document.getElementById("countdown-duration")?.value) || 0;
    if (!id) { alert("Charger une course d'abord"); return; }
    if (status === "STARTED" || status === "PAUSED" || status === "FINISHED") {
        alert("Le countdown ne peut être lancé qu'avant la course.");
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

// ---------------------------------------------------------------------------
// Mode AUTO — gestion des warnings DNF
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Overlay pilots visibility
// ---------------------------------------------------------------------------

function togglePilotsVisibility() {
    const chip = document.getElementById("btn-pilots-toggle");
    const visible = chip ? chip.hasAttribute("selected") : true;
    if (window.raceSocket) window.raceSocket.emit("toggle-pilots-visibility", { visible });
}

// ---------------------------------------------------------------------------
// Chrono toggle (chip dans index.html)
// ---------------------------------------------------------------------------

async function toggleChrono() {
    const chip = document.getElementById("btn-chrono-toggle");
    const on   = chip ? chip.selected : true;
    if (typeof updateChronoSelectVisibility === "function") updateChronoSelectVisibility(on);
    if (typeof onTimingEnabledChange === "function") onTimingEnabledChange(on);
}
