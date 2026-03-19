// race-render.js — Rendu du tableau de course à partir de l'état reçu du serveur.
// Aucun calcul de logique course ici ; uniquement la mise en forme et le DOM.

// ---------------------------------------------------------------------------
// Formatage du temps
// ---------------------------------------------------------------------------

function formatTime(ms) {
    if (ms === null || ms === undefined || isNaN(ms) || ms < 0) return "—";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes      = Math.floor(totalSeconds / 60);
    const seconds      = totalSeconds % 60;
    const millis       = Math.floor(ms % 1000);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function formatDelta(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    return `+${formatTime(ms)}`;
}

// ---------------------------------------------------------------------------
// Calcul du chrono à partir de l'état serveur
// ---------------------------------------------------------------------------

/** Retourne le temps écoulé en ms pour la course globale. */
function computeRaceElapsedMs(state) {
    if (!state.startedAt) return null;
    const start = Date.parse(state.startedAt);
    if (state.status === "PAUSED" && state.pausedAt) {
        return Date.parse(state.pausedAt) - start - (state.totalPausedMs ?? 0);
    }
    return Date.now() - start - (state.totalPausedMs ?? 0);
}

/** Retourne le temps personnel d'un pilote (tient compte du frozenTime). */
function computePilotElapsedMs(state, pilot) {
    if (!state.startedAt) return null;
    const start = Date.parse(state.startedAt);
    if (pilot.frozenTime) {
        return Date.parse(pilot.frozenTime) - start - (state.totalPausedMs ?? 0);
    }
    return computeRaceElapsedMs(state);
}

/** Retourne la chaîne de chrono selon le mode d'affichage. */
function getChronoDisplay(state, pilot, index) {
    if (!state.timingEnabled) return "";
    if (pilot.status === "DNF" || pilot.status === "WARNING_DNF") return "DNF";

    const mode = state.chronoDisplayMode;

    switch (mode) {
        case "leader": {
            const myElapsed = computePilotElapsedMs(state, pilot);
            if (index === 0) return myElapsed !== null ? formatTime(myElapsed) : "—";
            const leader    = state.pilots[0];
            const leaderMs  = computePilotElapsedMs(state, leader);
            if (leaderMs === null || myElapsed === null) return "—";
            return formatDelta(myElapsed - leaderMs);
        }
        case "gap": {
            const myElapsed = computePilotElapsedMs(state, pilot);
            if (index === 0) return myElapsed !== null ? formatTime(myElapsed) : "—";
            const prev      = state.pilots[index - 1];
            const prevMs    = computePilotElapsedMs(state, prev);
            if (prevMs === null || myElapsed === null) return "—";
            return formatDelta(myElapsed - prevMs);
        }
        case "best-lap":
            if (!pilot.lapTimes || pilot.lapTimes.length === 0) return "—";
            return formatTime(Math.min(...pilot.lapTimes));
        case "last-lap":
            if (!pilot.lapTimes || pilot.lapTimes.length === 0) return "—";
            return formatTime(pilot.lapTimes[pilot.lapTimes.length - 1]);
        default:
            return "—";
    }
}

// ---------------------------------------------------------------------------
// Rendu principal du tableau
// ---------------------------------------------------------------------------

function renderRaceTable(state) {
    const tableBody    = document.getElementById("race-list");
    const pilotCountEl = document.getElementById("pilot-count");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    const pilots = state.pilots ?? [];
    if (pilotCountEl) pilotCountEl.textContent = pilots.length;

    const isRunning    = state.status === "STARTED";
    const isManual     = state.trackingMode === "manual";
    const showTeams    = state.teamDisplayMode !== "hidden";
    const useAcronym   = state.teamDisplayMode === "acronym";

    pilots.forEach((pilot, index) => {
        const isDnf      = pilot.status === "DNF" || pilot.status === "WARNING_DNF";
        const isFinished = pilot.status === "FINISHED";
        const canAct     = (isRunning || state.status === "PENDING" || state.status === "SCHEDULED") && !isFinished;
        const canReorder = isManual && canAct && !isDnf;

        const teamColor   = pilot.teamSnapshot?.color   ?? "inherit";
        const teamAcronym = pilot.teamSnapshot?.acronym ?? "—";
        const teamName    = pilot.teamSnapshot?.name    ?? "—";
        const teamDisplay = useAcronym ? teamAcronym : teamName;

        const lapDisplay = isFinished
            ? `<span class="lap-display finished">Finished</span>`
            : `<span class="lap-display">${pilot.lap}</span>`;

        const posBadgeClass = index === 0 ? "position-badge pos-first" : "position-badge";

        const chronoDisplay = state.timingEnabled
            ? getChronoDisplay(state, pilot, index)
            : "";

        const dnfTitle = isDnf ? "Reset DNF" : "DNF";
        const dnfIcon  = isDnf ? "restart_alt" : "cancel";
        const dnfStyle = isDnf
            ? "--md-icon-button-icon-color: var(--md-sys-color-tertiary);"
            : "--md-icon-button-icon-color: var(--md-sys-color-error);";

        // Contrôles manuels lap
        const lapDisabled = (!isRunning || isFinished || !isManual) ? "disabled" : "";

        // Contrôles reorder/position
        const reorderDisabled = !canReorder ? "disabled" : "";
        const upDisabled      = (!canReorder || index === 0) ? "disabled" : "";
        const downDisabled    = (!canReorder || index === pilots.length - 1) ? "disabled" : "";

        // DNF uniquement en mode manuel
        const dnfDisabled = (!isManual || isFinished) ? "disabled" : "";

        const row = `
        <tr class="${isDnf ? "dnf-row" : ""} ${isFinished ? "finished-row" : ""}">
            <td><span class="${posBadgeClass}">${pilot.position}</span></td>
            <td>${escHtml(pilot.displayName)}</td>
            <td class="team-col" style="color: ${teamColor}; display: ${showTeams ? "" : "none"}">${escHtml(teamDisplay)}</td>
            <td>${lapDisplay}</td>
            ${state.timingEnabled ? `<td class="chrono-cell" style="${isDnf ? "opacity:0.5;" : ""}">${chronoDisplay}</td>` : ""}
            <td>
                <div class="action-buttons">
                    <md-icon-button onclick="changeLap('${pilot.id}', -1)" ${lapDisabled} title="Remove lap">
                        <md-icon>remove</md-icon>
                    </md-icon-button>
                    <md-icon-button onclick="changeLap('${pilot.id}', 1)" ${lapDisabled} title="Add lap">
                        <md-icon>add</md-icon>
                    </md-icon-button>
                </div>
            </td>
            <td>
                <input
                    class="inline-number"
                    type="number"
                    min="1"
                    max="${pilots.length}"
                    value="${pilot.position}"
                    onchange="jumpToPosition('${pilot.id}', this.value)"
                    ${reorderDisabled}
                    title="Jump to position"
                />
            </td>
            <td>
                <div class="action-buttons">
                    <md-icon-button onclick="movePilot('${pilot.id}', 'up')" ${upDisabled} title="Move up">
                        <md-icon>arrow_upward</md-icon>
                    </md-icon-button>
                    <md-icon-button onclick="movePilot('${pilot.id}', 'down')" ${downDisabled} title="Move down">
                        <md-icon>arrow_downward</md-icon>
                    </md-icon-button>
                </div>
            </td>
            <td>
                <md-icon-button onclick="toggleDNF('${pilot.id}')" ${dnfDisabled} title="${dnfTitle}" style="${dnfStyle}">
                    <md-icon>${dnfIcon}</md-icon>
                </md-icon-button>
            </td>
        </tr>`;
        tableBody.insertAdjacentHTML("beforeend", row);
    });

    const table = tableBody.closest("table");
    if (table) {
        table.classList.toggle("chrono-hidden", !state.timingEnabled);
        table.classList.toggle("teams-hidden",  !showTeams);
    }

    updateControlButtons(state);
    updateChronoButton(state);
    updateChronoSelectVisibility(state.timingEnabled);
    updateStatusBar(state.status);
    updateTrackingModeUI(state.trackingMode, state.status);
}

// ---------------------------------------------------------------------------
// Chrono live (mise à jour des cellules sans re-render complet)
// ---------------------------------------------------------------------------

setInterval(() => {
    const state = window.currentRaceState;
    if (!state || state.status !== "STARTED" || !state.timingEnabled) return;
    const cells   = document.querySelectorAll("#race-list .chrono-cell");
    const pilots  = state.pilots ?? [];
    pilots.forEach((pilot, index) => {
        const cell = cells[index];
        if (!cell) return;
        cell.textContent = getChronoDisplay(state, pilot, index);
    });
}, 100);

// ---------------------------------------------------------------------------
// Boutons et UI
// ---------------------------------------------------------------------------

function updateControlButtons(state) {
    const btnStart  = document.getElementById("btn-start");
    const btnPause  = document.getElementById("btn-pause");
    const btnFinish = document.getElementById("btn-finish");
    if (!btnStart || !btnPause || !btnFinish) return;

    const status = state?.status;
    if (status === "STARTED") {
        btnStart.disabled    = true;
        btnStart.textContent = "Start race";
        btnPause.disabled    = false;
        btnFinish.disabled   = false;
    } else if (status === "PAUSED") {
        btnStart.disabled    = false;
        btnStart.textContent = "Resume race";
        btnPause.disabled    = true;
        btnFinish.disabled   = false;
    } else {
        btnStart.disabled    = false;
        btnStart.textContent = "Start race";
        btnPause.disabled    = true;
        btnFinish.disabled   = true;
    }
}

function updateChronoButton(state) {
    const chip = document.getElementById("btn-chrono-toggle");
    if (!chip) return;
    chip.selected = state?.timingEnabled ?? true;
}

function updateChronoSelectVisibility(enabled) {
    const chronoSelect = document.getElementById("setting-chrono-display");
    if (chronoSelect) chronoSelect.style.display = enabled ? "" : "none";
}

function updateTrackingModeUI(trackingMode, status) {
    const btn = document.getElementById("btn-tracking-mode");
    if (btn) {
        btn.textContent = trackingMode === "auto" ? "Mode AUTO ✓" : "Mode MANUEL";
        btn.disabled    = status === "STARTED" || status === "PAUSED";
    }
}

// ---------------------------------------------------------------------------
// Panel avertissements DNF (mode AUTO)
// ---------------------------------------------------------------------------

function renderDnfWarningPanel() {
    const panel = document.getElementById("dnf-warning-panel");
    if (!panel) return;
    const warnings = window._dnfWarningPilots ?? new Set();
    if (warnings.size === 0) { panel.hidden = true; return; }

    panel.hidden    = false;
    const state     = window.currentRaceState;
    panel.innerHTML = [...warnings].map(pilotId => {
        const pilot = state?.pilots?.find(p => p.id === pilotId);
        const name  = pilot ? escHtml(pilot.displayName) : pilotId;
        return `<div class="dnf-warning-row">
            <span>⚠️ <strong>${name}</strong> hors zone circuit</span>
            <button onclick="confirmDnf('${pilotId}')">Confirmer DNF</button>
            <button onclick="ignoreDnf('${pilotId}')">Ignorer</button>
        </div>`;
    }).join("");
}

// ---------------------------------------------------------------------------
// Barre de statut (open/close registrations)
// ---------------------------------------------------------------------------

function updateStatusBar(status) {
    const bar      = document.getElementById("race-status-bar");
    const chip     = document.getElementById("race-status-chip");
    const btnOpen  = document.getElementById("btn-open-regs");
    const btnClose = document.getElementById("btn-close-regs");
    if (!bar) return;

    if (!status || !window.activeRaceId) { bar.style.display = "none"; return; }

    bar.style.display = "flex";
    const labels = {
        PENDING:   "En attente",
        SCHEDULED: "Inscriptions ouvertes",
        STARTED:   "En cours",
        PAUSED:    "En pause",
        FINISHED:  "Terminée",
    };
    if (chip) chip.textContent = labels[status] ?? status;
    if (btnOpen)  btnOpen.style.display  = status === "PENDING"   ? "" : "none";
    if (btnClose) btnClose.style.display = status === "SCHEDULED" ? "" : "none";
}

// ---------------------------------------------------------------------------
// Utilitaire XSS
// ---------------------------------------------------------------------------

function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
