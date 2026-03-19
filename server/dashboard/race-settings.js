// race-settings.js — Gestion des paramètres de course (édition à chaud, sélecteur de course,
// création de course, inscriptions) et cycle de vie (open/close registrations).

/** ID de la course actuellement chargée dans le dashboard. */
window.activeRaceId = null;

// ---------------------------------------------------------------------------
// Init (appelé par initDashboard dans api.js)
// ---------------------------------------------------------------------------

async function loadRaceSettings() {
    await loadActiveRaceList();
}

// ---------------------------------------------------------------------------
// Sélecteur de course
// ---------------------------------------------------------------------------

async function loadActiveRaceList() {
    try {
        const races  = await apiGet("/races?status=PENDING,SCHEDULED,STARTED,PAUSED");
        const select = document.getElementById("active-race-select");
        if (!select) return;
        const prev = select.value;
        select.innerHTML = '<option value="">— Sélectionner une course —</option>';
        races.forEach(r => {
            const opt       = document.createElement("option");
            opt.value       = r.id;
            opt.textContent = `${r.name} [${r.status}]`;
            select.appendChild(opt);
        });
        if (prev && races.find(r => r.id === prev)) select.value = prev;
    } catch (e) {
        console.warn("loadActiveRaceList:", e.message);
    }
}

/** Charge une course et peuple les champs de paramètres. */
async function loadActiveRace(raceId) {
    if (!raceId) {
        window.activeRaceId = null;
        if (typeof updateStatusBar     === "function") updateStatusBar(null);
        if (typeof updateControlButtons=== "function") updateControlButtons(null);
        return;
    }
    try {
        const r              = await apiGet(`/races/${raceId}`);
        window.activeRaceId  = r.id;

        _setField("setting-race-name",  r.name);
        _setField("setting-session",    r.session);
        _setField("setting-weather",    r.weather);
        _setField("setting-start-type", r.startType);
        _setField("total-laps",         r.lapCount);
        _setField("timed-duration",     r.sessionDurationMs != null ? Math.round(r.sessionDurationMs / 60000) : null);
        _setField("event-duration",     r.eventDuration ?? 5);
        _setField("setting-session-mode", r.sessionMode);
        _setField("setting-team-display", r.teamDisplayMode);
        _setField("setting-chrono-display", r.chronoDisplayMode);

        updateSessionModeUI(r.sessionMode);
        if (typeof updateTrackingModeUI === "function") updateTrackingModeUI(r.trackingMode, r.status);
        if (typeof updateStatusBar      === "function") updateStatusBar(r.status);
        if (typeof updateControlButtons === "function") updateControlButtons({ status: r.status, trackingMode: r.trackingMode, timingEnabled: r.timingEnabled });
        if (typeof updateChronoButton   === "function") updateChronoButton({ timingEnabled: r.timingEnabled ?? true });
        if (typeof updateChronoSelectVisibility === "function") updateChronoSelectVisibility(r.timingEnabled ?? true);
        if (typeof updateAddPilotSelect === "function") updateAddPilotSelect();

        // Charger le contexte serveur pour obtenir le broadcast race-state
        await raceLoad(r.id);
    } catch (e) {
        console.error("loadActiveRace:", e.message);
    }
}

function _setField(id, value) {
    if (value === null || value === undefined) return;
    const el = document.getElementById(id);
    if (!el) return;
    // md-* components et selects natifs
    el.value = value;
}

// ---------------------------------------------------------------------------
// Paramètres — envoi PATCH à chaud
// ---------------------------------------------------------------------------

async function onTeamDisplayModeChange(value) {
    const id = window.activeRaceId;
    // Mise à jour UI immédiate
    const teamSection = document.getElementById("teams-manager-section");
    if (teamSection) teamSection.style.display = value !== "hidden" ? "block" : "none";
    if (typeof displayPilots === "function") displayPilots();
    if (!id) return;
    try { await patchRaceSettings(id, { teamDisplayMode: value }); } catch (e) { console.warn(e.message); }
}

async function onTimingEnabledChange(value) {
    const id = window.activeRaceId;
    if (typeof updateChronoSelectVisibility === "function") updateChronoSelectVisibility(value);
    if (!id) return;
    try { await patchRaceSettings(id, { timingEnabled: value }); } catch (e) { console.warn(e.message); }
}

async function onChronoDisplayModeChange(value) {
    const id = window.activeRaceId;
    if (!id) return;
    try { await patchRaceSettings(id, { chronoDisplayMode: value }); } catch (e) { console.warn(e.message); }
}

async function onSessionModeChange(value) {
    updateSessionModeUI(value);
    const id = window.activeRaceId;
    if (!id) return;
    try { await patchRaceSettings(id, { sessionMode: value }); } catch (e) { console.warn(e.message); }
}

function updateSessionModeUI(mode) {
    const lapsField  = document.getElementById("total-laps");
    const timedField = document.getElementById("timed-duration");
    if (lapsField)  lapsField.style.display  = mode === "laps"  ? "" : "none";
    if (timedField) timedField.style.display = mode === "timed" ? "" : "none";
}

// Debounced patch pour les champs texte (nom, session, météo…)
let _patchDebounceTimer = null;
function _debouncedPatch(field, value) {
    const id = window.activeRaceId;
    if (!id) return;
    clearTimeout(_patchDebounceTimer);
    _patchDebounceTimer = setTimeout(async () => {
        try { await patchRaceSettings(id, { [field]: value }); } catch (e) { console.warn(e.message); }
    }, 600);
}

// ---------------------------------------------------------------------------
// Inscriptions — open / close
// ---------------------------------------------------------------------------

async function openRegistrations() {
    const id = window.activeRaceId;
    if (!id) return;
    try {
        const updated = await apiPost(`/races/${id}/open-registrations`);
        if (typeof updateStatusBar === "function") updateStatusBar(updated.status);
        await loadActiveRaceList();
    } catch (e) { alert(e.message); }
}

async function closeRegistrations() {
    const id = window.activeRaceId;
    if (!id) return;
    try {
        const updated = await apiPost(`/races/${id}/close-registrations`);
        if (typeof updateStatusBar === "function") updateStatusBar(updated.status);
        await loadActiveRaceList();
    } catch (e) { alert(e.message); }
}

// ---------------------------------------------------------------------------
// Tracking mode toggle
// ---------------------------------------------------------------------------

async function toggleTrackingMode() {
    const id    = window.activeRaceId;
    const state = window.currentRaceState;
    if (!id)    { alert("Charger une course d'abord"); return; }
    if (state?.status === "STARTED" || state?.status === "PAUSED") {
        alert("Le mode de tracking ne peut pas être changé pendant la course.");
        return;
    }
    const newMode = state?.trackingMode === "auto" ? "manual" : "auto";
    try {
        await patchRaceSettings(id, { trackingMode: newMode });
    } catch (e) { alert(e.message); }
}

// ---------------------------------------------------------------------------
// Formulaire création de course
// ---------------------------------------------------------------------------

let _createRaceFormVisible    = false;

function toggleCreateRaceForm() {
    _createRaceFormVisible = !_createRaceFormVisible;
    const form = document.getElementById("create-race-form");
    if (!form) return;
    form.style.display = _createRaceFormVisible ? "block" : "none";
    if (_createRaceFormVisible) {
        _loadRacetracksForSelect();
        document.getElementById("new-race-name")?.focus();
        const errEl = document.getElementById("create-race-error");
        if (errEl) errEl.textContent = "";
    }
}

async function _loadRacetracksForSelect() {
    const select = document.getElementById("new-race-racetrack");
    if (!select) return;
    try {
        const tracks = await apiGet("/racetracks");
        select.querySelectorAll("md-select-option:not([value=''])").forEach(o => o.remove());
        tracks.forEach(t => {
            const opt     = document.createElement("md-select-option");
            opt.value     = t.id;
            opt.innerHTML = `<div slot="headline">${t.name}</div><div slot="supporting-text">${t.checkpoints?.length ?? 0} checkpoints</div>`;
            select.appendChild(opt);
        });
    } catch (e) { console.warn("_loadRacetracksForSelect:", e.message); }
}

function onNewRaceTrackingModeChange(value) {
    const racetracksSelect = document.getElementById("new-race-racetrack");
    if (racetracksSelect) {
        racetracksSelect.style.borderColor = value === "auto" ? "var(--md-sys-color-error)" : "";
    }
}

function onNewRaceSessionModeChange(value) {
    const lapField = document.getElementById("new-race-lap-count");
    const durField = document.getElementById("new-race-duration");
    if (lapField) lapField.style.display = value === "laps"  ? "" : "none";
    if (durField) durField.style.display = value === "timed" ? "" : "none";
}

async function submitCreateRace() {
    const errorEl = document.getElementById("create-race-error");
    if (errorEl) errorEl.textContent = "";

    const name        = document.getElementById("new-race-name")?.value?.trim();
    const racetrackId = document.getElementById("new-race-racetrack")?.value || null;
    const tracking    = document.getElementById("new-race-tracking-mode")?.value || "manual";
    const session     = document.getElementById("new-race-session")?.value || "Race";
    const weather     = document.getElementById("new-race-weather")?.value || "Clear";
    const startType   = document.getElementById("new-race-start-type")?.value || "Grid Start";
    const sessionMode = document.getElementById("new-race-session-mode")?.value || "laps";
    const lapCount    = parseInt(document.getElementById("new-race-lap-count")?.value) || 3;
    const durationMin = parseFloat(document.getElementById("new-race-duration")?.value) || 30;

    if (!name) { if (errorEl) errorEl.textContent = "Le nom est requis."; return; }
    if (tracking === "auto" && !racetrackId) {
        if (errorEl) errorEl.textContent = "Un circuit est requis pour le mode Auto (OCR).";
        return;
    }

    try {
        const created = await apiPost("/races", {
            name, racetrackId, trackingMode: tracking, session, weather,
            startType, sessionMode, lapCount,
            sessionDurationMs: sessionMode === "timed" ? durationMin * 60000 : null,
        });
        toggleCreateRaceForm();
        await loadActiveRaceList();
        const select = document.getElementById("active-race-select");
        if (select) {
            select.value = created.id;
            loadActiveRace(created.id);
        }
    } catch (e) {
        if (errorEl) errorEl.textContent = e.message;
    }
}

// ---------------------------------------------------------------------------
// DOMContentLoaded — event listeners sur les champs de paramètres
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    // Team display
    const teamDisplaySelect = document.getElementById("setting-team-display");
    if (teamDisplaySelect) {
        teamDisplaySelect.addEventListener("change", () => onTeamDisplayModeChange(teamDisplaySelect.value));
    }

    // Chrono mode
    const chronoSelect = document.getElementById("setting-chrono-display");
    if (chronoSelect) {
        chronoSelect.addEventListener("change", () => onChronoDisplayModeChange(chronoSelect.value));
    }

    // Session mode
    const sessionModeSelect = document.getElementById("setting-session-mode");
    if (sessionModeSelect) {
        sessionModeSelect.addEventListener("change", () => onSessionModeChange(sessionModeSelect.value));
    }

    // Champs texte/select à patcher en live
    const patchMap = {
        "setting-race-name":  "name",
        "setting-session":    "session",
        "setting-weather":    "weather",
        "setting-start-type": "startType",
        "total-laps":         "lapCount",
        "timed-duration":     null, // géré séparément (conversion min→ms)
        "event-duration":     "eventDuration",
    };
    Object.entries(patchMap).forEach(([id, field]) => {
        const el = document.getElementById(id);
        if (!el || !field) return;
        const handler = () => _debouncedPatch(field, el.value);
        el.addEventListener("change", handler);
        el.addEventListener("input",  handler);
    });

    // Durée timed (conversion min → ms)
    const timedDurEl = document.getElementById("timed-duration");
    if (timedDurEl) {
        const handler = () => {
            const ms = parseFloat(timedDurEl.value) * 60000;
            if (!isNaN(ms)) _debouncedPatch("sessionDurationMs", ms);
        };
        timedDurEl.addEventListener("change", handler);
        timedDurEl.addEventListener("input",  handler);
    }

    // Initialiser la UI session mode
    updateSessionModeUI("laps");

    // Chip pilots-toggle : état initial
    const pilotsChip = document.getElementById("btn-pilots-toggle");
    if (pilotsChip) pilotsChip.setAttribute("selected", "");
});
