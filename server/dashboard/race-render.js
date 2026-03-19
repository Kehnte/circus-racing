// race-render.js — Race table rendering from server state.
// No race logic here; only formatting and DOM manipulation.

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

// returns elapsed ms for the overall race
function computeRaceElapsedMs(state) {
    if (!state.startedAt) return null;
    const start = Date.parse(state.startedAt);
    if (state.status === "PAUSED" && state.pausedAt) {
        return Date.parse(state.pausedAt) - start - (state.totalPausedMs ?? 0);
    }
    return Date.now() - start - (state.totalPausedMs ?? 0);
}

// returns a pilot's personal elapsed time (accounts for frozenTime)
function computePilotElapsedMs(state, pilot) {
    if (!state.startedAt) return null;
    const start = Date.parse(state.startedAt);
    if (pilot.frozenTime) {
        return Date.parse(pilot.frozenTime) - start - (state.totalPausedMs ?? 0);
    }
    return computeRaceElapsedMs(state);
}

// returns the chrono display string based on the display mode
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

// main table rendering

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
    const canRemove    = state.status === "PENDING" || state.status === "SCHEDULED";

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

        // manual lap controls
        const lapDisabled = (!isRunning || isFinished || !isManual) ? "disabled" : "";

        // reorder/position controls
        const reorderDisabled = !canReorder ? "disabled" : "";
        const upDisabled      = (!canReorder || index === 0) ? "disabled" : "";
        const downDisabled    = (!canReorder || index === pilots.length - 1) ? "disabled" : "";

        // DNF only in manual mode
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
            <td class="remove-col">
                ${canRemove && pilot.entryId
                    ? `<md-icon-button onclick="removeFromRace('${pilot.entryId}')" title="Remove from race" style="--md-icon-button-icon-color: var(--md-sys-color-error);"><md-icon>person_remove</md-icon></md-icon-button>`
                    : ""}
            </td>
        </tr>`;
        tableBody.insertAdjacentHTML("beforeend", row);
    });

    const table = tableBody.closest("table");
    if (table) {
        table.classList.toggle("chrono-hidden", !state.timingEnabled);
        table.classList.toggle("teams-hidden",  !showTeams);
        table.classList.toggle("remove-hidden", !canRemove);
    }

    updateControlButtons(state);
    updateChronoButton(state);
    updateChronoSelectVisibility(state.timingEnabled);
    updateStatusBar(state.status);
    updateTrackingModeUI(state.trackingMode, state.status);
}

// live chrono update (patch cells without full re-render)

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

// buttons and UI state

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
    const toggle = document.getElementById("tracking-mode-toggle");
    if (!toggle) return;
    const disabled = status === "STARTED" || status === "PAUSED";
    toggle.querySelectorAll(".seg-btn").forEach(btn => {
        btn.classList.toggle("selected", btn.dataset.value === trackingMode);
        btn.disabled = disabled;
    });
}

// DNF warning panel (AUTO mode)

function renderDnfWarningPanel() {
    const panel = document.getElementById("dnf-warning-panel");
    if (!panel) return;
    const warnings = window._dnfWarningPilots ?? new Set();
    if (warnings.size === 0) { panel.hidden = true; panel.style.display = ""; return; }

    panel.hidden        = false;
    panel.style.display = "flex";
    const state     = window.currentRaceState;
    panel.innerHTML = [...warnings].map(pilotId => {
        const pilot = state?.pilots?.find(p => p.id === pilotId);
        const name  = pilot ? escHtml(pilot.displayName) : pilotId;
        return `<div class="dnf-warning-row">
            <span>⚠️ <strong>${name}</strong> out of track zone</span>
            <button onclick="confirmDnf('${pilotId}')">Confirm DNF</button>
            <button onclick="ignoreDnf('${pilotId}')">Ignore</button>
        </div>`;
    }).join("");
}

// status bar (open/close registrations)

function updateStatusBar(status) {
    const bar      = document.getElementById("race-status-bar");
    const chip     = document.getElementById("race-status-chip");
    const btnOpen  = document.getElementById("btn-open-regs");
    const btnClose = document.getElementById("btn-close-regs");
    if (!bar) return;

    if (!status || !window.activeRaceId) { bar.style.display = "none"; return; }

    bar.style.display = "flex";
    const labels = {
        PENDING:   "Pending",
        SCHEDULED: "Registrations open",
        STARTED:   "In progress",
        PAUSED:    "Paused",
        FINISHED:  "Finished",
    };
    if (chip) chip.textContent = labels[status] ?? status;
    if (btnOpen)  btnOpen.style.display  = status === "PENDING"   ? "" : "none";
    if (btnClose) btnClose.style.display = status === "SCHEDULED" ? "" : "none";
}

// XSS escaping utility

function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
