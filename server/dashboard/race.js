// race.js

const socket = io("/?role=dashboard");

let activeRaceId  = null;
let trackingMode  = "manual"; // "manual" | "auto"

let raceList          = [];
let previousRaceList  = [];
let teamDisplayMode   = "color-bar";
let raceStatus        = "standby";
let timingEnabled     = true;
let chronoDisplayMode = "leader";
let pilotsVisible     = true;

// emit toggle to show/hide the pilot list on the leaderboard overlay
function togglePilotsVisibility() {
    const chip = document.getElementById("btn-pilots-toggle");
    // md-filter-chip toggles `selected` before the click handler fires
    pilotsVisible = chip ? chip.hasAttribute("selected") : !pilotsVisible;
    socket.emit("toggle-pilots-visibility", { visible: pilotsVisible });
}

let sessionMode       = "laps";
let sessionDurationMs = 30 * 60 * 1000;

let timedSessionEndTime  = null;
let timedSessionExpired  = false;
let timedSessionInterval = null;

let globalRaceStartTime     = null;
let pauseStartTime          = null;
let totalPauseDuration      = 0;
let globalFastestLap        = null;
let globalFastestLapPilotId = null;

let countdownActive   = false;
let countdownEndTime  = null;
let countdownInterval = null;

// backward-compat shim: pilots.js reads teamDisplayMode via this boolean property
Object.defineProperty(window, "isTeamManagementActive", {
    get: () => teamDisplayMode !== "hidden",
    configurable: true,
});

// returns elapsed ms for a pilot, accounting for pauses, DNF freeze and finish snapshot
function getPilotElapsed(pilot) {
    if (!timingEnabled) return null;
    if (pilot.raceStartTime === null || pilot.raceStartTime === undefined) return null;
    if (pilot.frozenTime !== null && pilot.frozenTime !== undefined) return pilot.frozenTime;
    if (pilot.totalTime  !== null && pilot.totalTime  !== undefined) return pilot.totalTime;
    const pauseOffset = pauseStartTime ? (Date.now() - pauseStartTime) : 0;
    return Date.now() - pilot.raceStartTime - totalPauseDuration - pauseOffset;
}

// formats a millisecond duration as M:SS.mmm
function formatTime(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis  = Math.floor(ms % 1000);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

// formats a gap as +M:SS.mmm
function formatDelta(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    return `+${formatTime(ms)}`;
}

// formats remaining ms as M:SS for the session countdown (no milliseconds)
function formatSessionCountdown(ms) {
    if (ms <= 0) return "0:00";
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

// returns remaining ms in the timed session, or null if not applicable
function getSessionRemainingMs() {
    if (sessionMode !== "timed" || timedSessionEndTime === null) return null;
    if (raceStatus === "paused") {
        return Math.max(0, timedSessionEndTime - pauseStartTime - totalPauseDuration);
    }
    return Math.max(0, timedSessionEndTime - Date.now());
}

// applies team display mode change, hides/shows the Teams section and re-renders
function onTeamDisplayModeChange(value) {
    teamDisplayMode = value;
    const teamSection = document.getElementById("teams-manager-section");
    if (teamSection) teamSection.style.display = teamDisplayMode !== "hidden" ? "block" : "none";
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    if (typeof displayPilots === "function") displayPilots();
    displayRace();
}

// toggles live timing on/off and re-renders
function onTimingEnabledChange(value) {
    timingEnabled = value;
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// switches the chrono column display mode and re-renders
function onChronoDisplayModeChange(value) {
    chronoDisplayMode = value;
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// switches between "laps" and "timed" session modes
function onSessionModeChange(value) {
    sessionMode = value;
    updateSessionModeUI();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// shows/hides Total Laps vs Session Duration fields based on sessionMode
function updateSessionModeUI() {
    const lapsField  = document.getElementById("total-laps");
    const timedField = document.getElementById("timed-duration");
    if (lapsField)  lapsField.style.display  = sessionMode === "laps"  ? "" : "none";
    if (timedField) timedField.style.display = sessionMode === "timed" ? "" : "none";
}

// starts the pre-race countdown; calls startRace() at zero
function startCountdown() {
    if (raceList.length === 0) { alert("Please load pilots first"); return; }
    if (raceStatus !== "standby") { alert("Countdown can only be started before the race begins."); return; }

    const durationSec = parseInt(document.getElementById("countdown-duration")?.value) || 0;
    if (durationSec <= 0) { startRace(); return; }

    stopCountdown(false);
    countdownActive  = true;
    countdownEndTime = Date.now() + durationSec * 1000;
    updateCountdownUI();

    countdownInterval = setInterval(() => {
        updateCountdownUI();
        if (countdownEndTime - Date.now() <= 0) {
            stopCountdown(false);
            startRace();
        }
    }, 200);

    displayRace();
}

// cancels an active countdown; optionally broadcasts the cancellation
function stopCountdown(broadcast = true) {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    countdownActive  = false;
    countdownEndTime = null;
    updateCountdownUI();
    if (broadcast) displayRace();
}

// syncs the countdown button visibility with current state
function updateCountdownUI() {
    const btn     = document.getElementById("btn-countdown");
    const stopBtn = document.getElementById("btn-countdown-stop");
    if (btn)     btn.disabled          = countdownActive || raceStatus !== "standby";
    if (stopBtn) stopBtn.style.display = countdownActive ? "" : "none";
}

// returns the countdown payload to embed in race-update broadcasts
function getCountdownPayload() {
    if (!countdownActive || countdownEndTime === null) return { active: false, remainingMs: 0 };
    return { active: true, remainingMs: Math.max(0, countdownEndTime - Date.now()) };
}

// starts the 200ms timed session interval
function startTimedSession() {
    stopTimedSession();
    const durationMin    = parseFloat(document.getElementById("timed-duration")?.value) || 30;
    sessionDurationMs    = durationMin * 60 * 1000;
    timedSessionEndTime  = Date.now() + sessionDurationMs;
    timedSessionExpired  = false;
    timedSessionInterval = setInterval(() => {
        const remaining = getSessionRemainingMs();
        if (remaining !== null && remaining <= 0 && !timedSessionExpired) {
            timedSessionExpired = true;
            onSessionTimerExpired();
        }
        broadcastRaceUpdate();
    }, 200);
}

// clears the session timer interval
function stopTimedSession() {
    if (timedSessionInterval) { clearInterval(timedSessionInterval); timedSessionInterval = null; }
}

// called when the session timer reaches zero; triggers finish on next lap crossing
function onSessionTimerExpired() {
    displayRace();
}

// resumes the timed session after a pause by recalculating the end time
function resumeTimedSession() {
    if (timedSessionEndTime === null) return;
    timedSessionEndTime += Date.now() - pauseStartTime;
    if (!timedSessionInterval) {
        timedSessionInterval = setInterval(() => {
            const remaining = getSessionRemainingMs();
            if (remaining !== null && remaining <= 0 && !timedSessionExpired) {
                timedSessionExpired = true;
                onSessionTimerExpired();
            }
            broadcastRaceUpdate();
        }, 200);
    }
}

// starts the race or resumes from pause; initialises pilot timestamps on a fresh grid start
function startRace() {
    if (trackingMode === "auto") {
        if (!activeRaceId) { alert("No race loaded"); return; }
        const endpoint = raceStatus === "paused"
            ? `/api/races/${activeRaceId}/resume`
            : `/api/races/${activeRaceId}/start`;
        apiRequest("POST", endpoint).then(() => updateControls()).catch(e => alert(e.message));
        return;
    }

    if (raceList.length === 0) { alert("Please load pilots first"); return; }
    stopCountdown(false);

    if (raceStatus === "paused" && pauseStartTime !== null) {
        totalPauseDuration += Date.now() - pauseStartTime;
        if (sessionMode === "timed") resumeTimedSession();
        pauseStartTime = null;
        raceStatus = "running";
        socket.emit("race-resumed");
        updateControls();
        if (typeof saveAllToLocal === "function") saveAllToLocal();
        displayRace();
        return;
    }

    const isFreshStart = raceList.every((p) => p.laps === 0);
    const startType    = document.getElementById("setting-start-type")?.value || "Grid Start";
    const isRolling    = startType === "Rolling Start";

    if (isFreshStart) {
        globalRaceStartTime = Date.now();
        totalPauseDuration  = 0;
        pauseStartTime      = null;
        timedSessionExpired = false;

        raceList.forEach((p) => {
            if (isRolling) {
                p.raceStartTime      = null;
                p.lastSplitTimestamp = null;
                p.laps               = 0;
            } else {
                p.raceStartTime      = globalRaceStartTime;
                p.lastSplitTimestamp = globalRaceStartTime;
                p.laps               = 1;
            }
            p.lapTimes   = [];
            p.totalTime  = null;
            p.frozenTime = null;
        });

        if (sessionMode === "timed") startTimedSession();
    }

    raceStatus = "running";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// pauses the race and records the pause start timestamp
function pauseRace() {
    if (trackingMode === "auto") {
        if (!activeRaceId) return;
        apiRequest("POST", `/api/races/${activeRaceId}/pause`).then(() => {
            raceStatus = "paused";
            updateControls();
        }).catch(e => alert(e.message));
        return;
    }
    if (raceStatus !== "running") return;
    raceStatus     = "paused";
    pauseStartTime = Date.now();
    stopTimedSession();
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// force-finishes the race and snapshots total time for all pilots still running
function endRaceManually() {
    if (trackingMode === "auto") {
        if (!activeRaceId) return;
        apiRequest("POST", `/api/races/${activeRaceId}/finish`).then(() => {
            raceStatus = "finished";
            updateControls();
        }).catch(e => alert(e.message));
        return;
    }
    raceStatus = "finished";
    stopTimedSession();
    if (timingEnabled) {
        raceList.forEach((p) => {
            if (p.raceStartTime !== null && p.totalTime === null && !p.dnf) {
                p.totalTime = getPilotElapsed(p);
            }
        });
    }
    if (pauseStartTime !== null) {
        totalPauseDuration += Date.now() - pauseStartTime;
        pauseStartTime = null;
    }
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// resets lap data and timing state back to standby without removing pilots
function resetRace() {
    stopCountdown(false);
    stopTimedSession();
    socket.emit("race-restarted");
    raceList.forEach((p) => {
        p.laps = 0; p.finished = false; p.dnf = false;
        p.raceStartTime = null; p.lastSplitTimestamp = null;
        p.lapTimes = []; p.totalTime = null; p.frozenTime = null;
    });
    previousRaceList        = [];
    globalRaceStartTime     = null;
    pauseStartTime          = null;
    totalPauseDuration      = 0;
    globalFastestLap        = null;
    globalFastestLapPilotId = null;
    timedSessionEndTime     = null;
    timedSessionExpired     = false;
    raceStatus              = "standby";
    recalculatePositions();
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// rebuilds raceList from the full pilots roster (all system pilots), resetting all race data
function reloadPilots() {
    stopCountdown(false);
    stopTimedSession();
    raceList = pilots.map((p, index) => ({
        ...p,
        laps: 0, position: index + 1, finished: false, dnf: false,
        raceStartTime: null, lastSplitTimestamp: null,
        lapTimes: [], totalTime: null, frozenTime: null,
    }));
    previousRaceList        = [];
    globalRaceStartTime     = null;
    pauseStartTime          = null;
    totalPauseDuration      = 0;
    globalFastestLap        = null;
    globalFastestLapPilotId = null;
    timedSessionEndTime     = null;
    timedSessionExpired     = false;
    raceStatus              = "standby";
    updateControls();
    updateAddPilotSelect();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// populates the "add pilot" select with pilots not already in the race
function updateAddPilotSelect() {
    const select = document.getElementById("add-pilot-select");
    if (!select) return;
    const inRace = new Set(raceList.map(p => p.id));
    select.innerHTML = '<option value="">— Sélectionner un pilote —</option>';
    pilots.forEach(p => {
        if (inRace.has(p.id)) return;
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name ?? p.displayName ?? p.id;
        select.appendChild(opt);
    });
}

// admin direct-adds a pilot to the current race (creates VALIDATED entry)
async function adminAddPilot() {
    if (!activeRaceId) { alert("Charger une course d'abord"); return; }
    const select = document.getElementById("add-pilot-select");
    const pilotId = select?.value;
    if (!pilotId) { alert("Sélectionner un pilote"); return; }
    try {
        await apiRequest("POST", `/api/races/${activeRaceId}/entries/admin`, { pilotId });
        await loadActiveRace(activeRaceId);
    } catch (e) { alert(e.message); }
}

// increments or decrements a pilot's lap count, records split times and checks for race end
function changeLap(index, delta) {
    if (trackingMode === "auto") return;
    if (raceStatus !== "running") return;

    const pilot     = raceList[index];
    const totalLaps = parseInt(document.getElementById("total-laps").value) || 3;
    const isRolling = (document.getElementById("setting-start-type")?.value || "Grid Start") === "Rolling Start";
    const newLaps   = pilot.laps + delta;

    if (newLaps < 0) return;
    if (newLaps >= 1 && !pilot.dnf && !(delta === 1 && pilot.finished)) {

        // rolling start: start the clock on the pilot's first lap crossing
        if (isRolling && pilot.laps === 0 && delta === 1 && timingEnabled) {
            pilot.raceStartTime      = Date.now();
            pilot.lastSplitTimestamp = Date.now();
        }

        // record split time when completing a lap
        if (delta === 1 && pilot.laps >= 1 && timingEnabled && pilot.raceStartTime !== null) {
            const now   = Date.now();
            const split = now - pilot.lastSplitTimestamp;
            pilot.lapTimes.push(split);
            pilot.lastSplitTimestamp = now;
            checkFastestLap(pilot, split);
        }

        // undo the last split when removing a lap
        if (delta === -1 && timingEnabled && pilot.lapTimes && pilot.lapTimes.length > 0) {
            const removed = pilot.lapTimes.pop();
            if (pilot.lastSplitTimestamp !== null) pilot.lastSplitTimestamp -= removed;
            recomputeGlobalFastestLap();
        }

        pilot.laps = newLaps;

        if (sessionMode === "laps") {
            pilot.finished = pilot.laps > totalLaps;
        } else {
            // timer expired: this lap crossing finishes the pilot
            pilot.finished = timedSessionExpired && delta === 1;
        }

        // snapshot finish time the moment the pilot crosses the finish line
        if (pilot.finished && timingEnabled && pilot.raceStartTime !== null && pilot.totalTime === null) {
            pilot.totalTime = getPilotElapsed(pilot);
        }

        recalculatePositions();
        checkRaceEnd();
        if (typeof saveAllToLocal === "function") saveAllToLocal();
        displayRace();
    }
}

// emits a fastest-lap event if the given split beats the current global record
function checkFastestLap(pilot, splitMs) {
    if (globalFastestLap === null || splitMs < globalFastestLap) {
        globalFastestLap        = splitMs;
        globalFastestLapPilotId = pilot.id;

        const team            = typeof teams    !== "undefined" ? teams.find((t) => t.id === pilot.teamId)    : null;
        const ship            = typeof vehicles !== "undefined" ? vehicles.find((s) => s.id === pilot.shipId) : null;
        const displayDuration = parseInt(document.getElementById("event-duration")?.value) || 5;

        socket.emit("race-event", {
            type:         "fastest-lap",
            pilotId:      pilot.id,
            pilotName:    pilot.name,
            pilotCountry: pilot.country || "un",
            teamName:     team ? team.name  : null,
            teamColor:    team ? team.color : null,
            shipModel:    ship ? ship.model : null,
            time:         formatTime(splitMs),
            displayDuration,
        });
    }
}

// scans all pilots' lap times to recompute the global fastest lap after a lap removal
function recomputeGlobalFastestLap() {
    globalFastestLap        = null;
    globalFastestLapPilotId = null;
    raceList.forEach((p) => {
        if (p.lapTimes && p.lapTimes.length > 0) {
            const best = Math.min(...p.lapTimes);
            if (globalFastestLap === null || best < globalFastestLap) {
                globalFastestLap        = best;
                globalFastestLapPilotId = p.id;
            }
        }
    });
}

// swaps a pilot one step up or down in the list
function movePilot(index, delta) {
    if (raceStatus === "finished") return;
    const pilot = raceList[index];
    if (pilot.finished) return;
    const newPos = index + delta;
    if (newPos < 0 || newPos >= raceList.length) return;
    const temp       = raceList[index];
    raceList[index]  = raceList[newPos];
    raceList[newPos] = temp;
    recalculatePositions();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// moves a pilot directly to an arbitrary position
function jumpToPosition(index, newPosValue) {
    if (raceStatus === "finished") { displayRace(); return; }
    const pilot = raceList[index];
    if (pilot.finished) { displayRace(); return; }
    const newPos = parseInt(newPosValue);
    if (isNaN(newPos) || newPos < 1 || newPos > raceList.length) { displayRace(); return; }
    const spliced = raceList.splice(index, 1)[0];
    raceList.splice(newPos - 1, 0, spliced);
    recalculatePositions();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// toggles a pilot's DNF flag; freezes their elapsed time when set
function toggleDNF(index) {
    if (trackingMode === "auto") return;
    const pilot = raceList[index];
    pilot.dnf = !pilot.dnf;
    if (pilot.dnf) {
        pilot.finished = false;
        if (timingEnabled && pilot.raceStartTime !== null && pilot.frozenTime === null) {
            pilot.frozenTime = getPilotElapsed(pilot);
        }
    } else {
        pilot.frozenTime = null;
    }
    recalculatePositions();
    checkRaceEnd();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// sorts raceList by DNF → finished → laps desc, then reassigns position numbers
function recalculatePositions() {
    raceList.sort((a, b) => {
        if (a.dnf !== b.dnf)           return a.dnf ? 1 : -1;
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.laps !== b.laps)         return b.laps - a.laps;
        return 0;
    });
    raceList.forEach((p, idx) => { p.position = idx + 1; });
}

// returns the formatted chrono string for a pilot according to the active display mode
function getChronoDisplay(pilot, index) {
    if (!timingEnabled) return "";

    switch (chronoDisplayMode) {
        case "leader": {
            if (index === 0) {
                const t = getPilotElapsed(pilot);
                return t !== null ? formatTime(t) : "—";
            }
            const leaderElapsed = getPilotElapsed(raceList[0]);
            const myElapsed     = getPilotElapsed(pilot);
            if (leaderElapsed === null || myElapsed === null) return "—";
            return formatDelta(myElapsed - leaderElapsed);
        }
        case "gap": {
            if (index === 0) {
                const t = getPilotElapsed(pilot);
                return t !== null ? formatTime(t) : "—";
            }
            const prevElapsed = getPilotElapsed(raceList[index - 1]);
            const myElapsed   = getPilotElapsed(pilot);
            if (prevElapsed === null || myElapsed === null) return "—";
            return formatDelta(myElapsed - prevElapsed);
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

// diffs raceList against previousRaceList and emits incident/finished socket events
function detectAndEmitEvents() {
    if (previousRaceList.length === 0) return;

    raceList.forEach((pilot) => {
        const previous = previousRaceList.find((p) => p.id === pilot.id);
        if (!previous) return;

        const team            = typeof teams    !== "undefined" ? teams.find((t) => t.id === pilot.teamId)    : null;
        const ship            = typeof vehicles !== "undefined" ? vehicles.find((s) => s.id === pilot.shipId) : null;
        const displayDuration = parseInt(document.getElementById("event-duration")?.value) || 5;

        const payload = {
            pilotId:      pilot.id,
            pilotName:    pilot.name,
            pilotCountry: pilot.country || "un",
            teamName:     team ? team.name  : null,
            teamColor:    team ? team.color : null,
            shipModel:    ship ? ship.model : null,
            displayDuration,
        };

        if (!previous.dnf      && pilot.dnf)      socket.emit("race-event", { ...payload, type: "incident" });
        if (!previous.finished && pilot.finished)  socket.emit("race-event", { ...payload, type: "finished" });
    });
}

// rebuilds the race table, updates column visibility and broadcasts state to overlays
function displayRace() {
    const tableBody    = document.getElementById("race-list");
    const pilotCountEl = document.getElementById("pilot-count");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    if (pilotCountEl) pilotCountEl.textContent = raceList.length;

    const isRunning = raceStatus === "running";
    const showTeams = teamDisplayMode !== "hidden";

    raceList.forEach((pilot, index) => {
        const team       = typeof teams !== "undefined" ? teams.find((t) => t.id === (pilot.teamId ?? null)) : null;
        const lapDisplay = pilot.finished
            ? `<span class="lap-display finished">Finished</span>`
            : `<span class="lap-display">${pilot.laps}</span>`;
        const posBadgeClass = index === 0 ? "position-badge pos-first" : "position-badge";
        const teamColor     = team ? team.color   : "inherit";
        const teamAcronym   = team ? team.acronym : "-";
        const canReorder    = (raceStatus === "running" || raceStatus === "standby") && !pilot.finished;
        const chronoCell    = timingEnabled
            ? `<td class="chrono-cell" style="${pilot.dnf ? "opacity:0.5;" : ""}">${pilot.dnf ? "DNF" : getChronoDisplay(pilot, index)}</td>`
            : "";
        const dnfTitle = pilot.dnf ? "Reset DNF" : "DNF";
        const dnfIcon  = pilot.dnf ? "restart_alt" : "cancel";
        const dnfStyle = pilot.dnf
            ? "--md-icon-button-icon-color: var(--md-sys-color-tertiary);"
            : "--md-icon-button-icon-color: var(--md-sys-color-error);";

        const row = `
        <tr class="${pilot.dnf ? "dnf-row" : ""} ${pilot.finished ? "finished-row" : ""}">
            <td><span class="${posBadgeClass}">${pilot.position}</span></td>
            <td>${pilot.name}</td>
            <td style="color: ${teamColor}; display: ${showTeams ? "" : "none"}">${teamAcronym}</td>
            <td>${lapDisplay}</td>
            ${chronoCell}
            <td>
                <div class="action-buttons">
                    <md-icon-button onclick="changeLap(${index}, -1)" ${(!isRunning || pilot.finished) ? "disabled" : ""} title="Remove lap">
                        <md-icon>remove</md-icon>
                    </md-icon-button>
                    <md-icon-button onclick="changeLap(${index}, 1)" ${(!isRunning || pilot.finished) ? "disabled" : ""} title="Add lap">
                        <md-icon>add</md-icon>
                    </md-icon-button>
                </div>
            </td>
            <td>
                <input
                    class="inline-number"
                    type="number"
                    min="1"
                    max="${raceList.length}"
                    value="${pilot.position}"
                    onchange="jumpToPosition(${index}, this.value)"
                    ${!canReorder ? "disabled" : ""}
                    title="Jump to position"
                />
            </td>
            <td>
                <div class="action-buttons">
                    <md-icon-button onclick="movePilot(${index}, -1)" ${(!canReorder || index === 0) ? "disabled" : ""} title="Move up">
                        <md-icon>arrow_upward</md-icon>
                    </md-icon-button>
                    <md-icon-button onclick="movePilot(${index}, 1)" ${(!canReorder || index === raceList.length - 1) ? "disabled" : ""} title="Move down">
                        <md-icon>arrow_downward</md-icon>
                    </md-icon-button>
                </div>
            </td>
            <td>
                <md-icon-button onclick="toggleDNF(${index})" title="${dnfTitle}" style="${dnfStyle}">
                    <md-icon>${dnfIcon}</md-icon>
                </md-icon-button>
            </td>
        </tr>`;
        tableBody.insertAdjacentHTML("beforeend", row);
    });

    const table = tableBody.closest("table");
    if (table) {
        table.classList.toggle("chrono-hidden", !timingEnabled);
        table.classList.toggle("teams-hidden", !showTeams);
    }

    detectAndEmitEvents();
    previousRaceList = raceList.map((p) => ({ ...p, lapTimes: [...(p.lapTimes || [])] }));

    updateCountdownUI();
    broadcastRaceUpdate();
}

// emits current race state to all overlays via socket
function broadcastRaceUpdate() {
    socket.emit("race-update", {
        raceList: raceList.map((p, i) => ({
            ...p,
            chronoDisplay: getChronoDisplay(p, i),
        })),
        teams: typeof teams !== "undefined" ? teams : [],
        teamDisplayMode,
        timingEnabled,
        chronoDisplayMode,
        globalFastestLap,
        globalFastestLapPilotId,
        raceStatus,
        countdown: getCountdownPayload(),
        sessionMode,
        sessionCountdown: sessionMode === "timed" ? {
            active:      raceStatus === "running" || raceStatus === "paused",
            remainingMs: getSessionRemainingMs() ?? 0,
            expired:     timedSessionExpired,
        } : null,
        settings: {
            raceName:  document.getElementById("setting-race-name")?.value  || "",
            session:   document.getElementById("setting-session")?.value    || "",
            weather:   document.getElementById("setting-weather")?.value    || "",
            startType: document.getElementById("setting-start-type")?.value || "",
            totalLaps: document.getElementById("total-laps")?.value         || "3",
        },
    });
}

// automatically marks the race finished when all pilots have finished or DNF'd
function checkRaceEnd() {
    if (raceStatus !== "running") return;
    if (sessionMode === "timed" && !timedSessionExpired) return;
    const stillRacing = raceList.some((p) => !p.finished && !p.dnf);
    if (!stillRacing && raceList.length > 0) {
        raceStatus = "finished";
        stopTimedSession();
        updateControls();
    }
}

// syncs Start/Pause/Finish button states with the current raceStatus
function updateControls() {
    const btnStart  = document.getElementById("btn-start");
    const btnPause  = document.getElementById("btn-pause");
    const btnFinish = document.getElementById("btn-finish");
    if (!btnStart || !btnPause || !btnFinish) return;

    if (raceStatus === "running") {
        btnStart.disabled    = true;
        btnStart.textContent = "Start race";
        btnPause.disabled    = false;
        btnFinish.disabled   = false;
    } else if (raceStatus === "paused") {
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

    updateCountdownUI();

    if (trackingMode === "auto") {
        document.querySelectorAll(".lap-btn, .reorder-btn, .dnf-btn").forEach(el => { el.disabled = true; });
    }

    const btnMode = document.getElementById("btn-tracking-mode");
    if (btnMode) btnMode.disabled = !activeRaceId || raceStatus === "running";
}

// refreshes chrono cells every 100ms while the race is running
setInterval(() => {
    if (raceStatus !== "running" || !timingEnabled) return;
    const cells = document.querySelectorAll("#race-list .chrono-cell");
    raceList.forEach((pilot, index) => {
        const cell = cells[index];
        if (!cell) return;
        cell.textContent = pilot.dnf ? "DNF" : getChronoDisplay(pilot, index);
    });
}, 100);

// broadcasts race state every 500ms during active countdown
setInterval(() => {
    if (!countdownActive) return;
    broadcastRaceUpdate();
}, 500);

// attaches change/input listeners to settings fields so the leaderboard updates immediately
document.addEventListener("DOMContentLoaded", () => {
    const settingIds = [
        "setting-race-name", "setting-session", "setting-weather",
        "setting-start-type", "total-laps",
    ];
    settingIds.forEach((id) => {
        const handler = () => setTimeout(displayRace, 0);
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", handler);
        el.addEventListener("input",  handler);
    });

    const sessionModeSelect = document.getElementById("setting-session-mode");
    if (sessionModeSelect) {
        sessionModeSelect.addEventListener("change", () => onSessionModeChange(sessionModeSelect.value));
    }

    const sessionDurationEl = document.getElementById("timed-duration");
    if (sessionDurationEl) {
        sessionDurationEl.addEventListener("change", () => setTimeout(displayRace, 0));
        sessionDurationEl.addEventListener("input",  () => setTimeout(displayRace, 0));
    }

    updateSessionModeUI();

    const pilotsChip = document.getElementById("btn-pilots-toggle");
    if (pilotsChip) pilotsChip.setAttribute("selected", "");
});

// ---------------------------------------------------------------------------
// Create race form
// ---------------------------------------------------------------------------

let _createRaceFormVisible = false;
let _pendingCircuitCheckpoints = null; // checkpoints parsed from JSON file

function toggleCreateRaceForm() {
    _createRaceFormVisible = !_createRaceFormVisible;
    const form = document.getElementById("create-race-form");
    if (!form) return;
    form.style.display = _createRaceFormVisible ? "block" : "none";
    if (_createRaceFormVisible) {
        loadRacetracksForSelect();
        document.getElementById("new-race-name")?.focus();
        document.getElementById("create-race-error").textContent = "";
    }
}

// populate the racetrack dropdown in the create race form
async function loadRacetracksForSelect() {
    const select = document.getElementById("new-race-racetrack");
    if (!select) return;
    try {
        const tracks = await apiRequest("GET", "/api/racetracks");
        select.querySelectorAll("md-select-option:not([value=''])").forEach(o => o.remove());
        tracks.forEach(t => {
            const opt = document.createElement("md-select-option");
            opt.value = t.id;
            opt.innerHTML = `<div slot="headline">${t.name}</div><div slot="supporting-text">${(t.checkpoints?.length ?? 0)} checkpoints</div>`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.warn("loadRacetracksForSelect:", e.message);
    }
}

function onNewRaceTrackingModeChange(value) {
    const racetracksSelect = document.getElementById("new-race-racetrack");
    if (racetracksSelect) {
        const label = racetracksSelect.shadowRoot?.querySelector("label") ?? racetracksSelect;
        // Visually mark circuit as required when auto is selected
        racetracksSelect.style.borderColor = value === "auto" ? "var(--md-sys-color-error)" : "";
    }
}

function onNewRaceSessionModeChange(value) {
    const lapField = document.getElementById("new-race-lap-count");
    const durField = document.getElementById("new-race-duration");
    if (lapField) lapField.style.display = value === "laps" ? "" : "none";
    if (durField) durField.style.display = value === "timed" ? "" : "none";
}

async function submitCreateRace() {
    const errorEl = document.getElementById("create-race-error");
    if (errorEl) errorEl.textContent = "";

    const name         = document.getElementById("new-race-name")?.value?.trim();
    const racetrackId  = document.getElementById("new-race-racetrack")?.value || null;
    const trackingMode = document.getElementById("new-race-tracking-mode")?.value || "manual";
    const session      = document.getElementById("new-race-session")?.value || "Race";
    const weather      = document.getElementById("new-race-weather")?.value || "Clear";
    const startType    = document.getElementById("new-race-start-type")?.value || "Grid Start";
    const sessionMode  = document.getElementById("new-race-session-mode")?.value || "laps";
    const lapCount     = parseInt(document.getElementById("new-race-lap-count")?.value) || 3;
    const durationMin  = parseFloat(document.getElementById("new-race-duration")?.value) || 30;

    if (!name) { if (errorEl) errorEl.textContent = "Le nom est requis."; return; }
    if (trackingMode === "auto" && !racetrackId) {
        if (errorEl) errorEl.textContent = "Un circuit est requis pour le mode Auto (OCR).";
        return;
    }

    const body = {
        name, racetrackId, trackingMode, session, weather,
        startType, sessionMode, lapCount,
        sessionDurationMs: sessionMode === "timed" ? durationMin * 60 * 1000 : null,
    };

    try {
        const created = await apiRequest("POST", "/api/races", body);
        toggleCreateRaceForm();
        await loadActiveRaceList();
        // auto-select the newly created race
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
// Race status bar: open/close registrations
// ---------------------------------------------------------------------------

let _loadedRaceStatus = null; // track the DB status of the currently loaded race

function updateStatusBar(status) {
    _loadedRaceStatus = status;
    const bar   = document.getElementById("race-status-bar");
    const chip  = document.getElementById("race-status-chip");
    const btnOpen  = document.getElementById("btn-open-regs");
    const btnClose = document.getElementById("btn-close-regs");
    if (!bar) return;

    if (!status || !activeRaceId) {
        bar.style.display = "none";
        return;
    }

    bar.style.display = "flex";
    const labels = { PENDING: "En attente", SCHEDULED: "Inscriptions ouvertes", STARTED: "En cours", PAUSED: "En pause", FINISHED: "Terminée" };
    if (chip) chip.textContent = labels[status] ?? status;

    if (btnOpen)  btnOpen.style.display  = status === "PENDING"   ? ""     : "none";
    if (btnClose) btnClose.style.display = status === "SCHEDULED" ? ""     : "none";
}

async function openRegistrations() {
    if (!activeRaceId) return;
    try {
        const updated = await apiRequest("POST", `/api/races/${activeRaceId}/open-registrations`);
        updateStatusBar(updated.status);
        await loadActiveRaceList();
    } catch (e) { alert(e.message); }
}

async function closeRegistrations() {
    if (!activeRaceId) return;
    try {
        const updated = await apiRequest("POST", `/api/races/${activeRaceId}/close-registrations`);
        updateStatusBar(updated.status);
        await loadActiveRaceList();
    } catch (e) { alert(e.message); }
}

// ---------------------------------------------------------------------------
// load open/active races into the race selector dropdown
// ---------------------------------------------------------------------------

// load open/active races into the race selector dropdown
async function loadActiveRaceList() {
    const races  = await apiRequest("GET", "/api/races?status=PENDING,SCHEDULED,STARTED,PAUSED");
    const select = document.getElementById("active-race-select");
    if (!select) return;
    select.innerHTML = '<option value="">— Sélectionner une course —</option>';
    races.forEach(r => {
        const opt       = document.createElement("option");
        opt.value       = r.id;
        opt.textContent = `${r.name} [${r.status}]`;
        select.appendChild(opt);
    });
}

// load a race by ID and populate dashboard settings from DB data
async function loadActiveRace(raceId) {
    if (!raceId) {
        activeRaceId = null;
        trackingMode = "manual";
        updateStatusBar(null);
        updateControls();
        return;
    }
    const r      = await apiRequest("GET", `/api/races/${raceId}`);
    activeRaceId = r.id;
    trackingMode = r.trackingMode ?? "manual";

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
    setVal("setting-race-name",    r.name);
    setVal("setting-session",      r.session);
    setVal("setting-weather",      r.weather);
    setVal("setting-start-type",   r.startType);
    setVal("total-laps",           r.lapCount);
    setVal("setting-session-mode", r.sessionMode);

    const statusMap = { STARTED: "running", PAUSED: "paused", FINISHED: "finished" };
    raceStatus = statusMap[r.status] ?? "standby";

    updateStatusBar(r.status);
    updateTrackingModeUI();
    updateControls();

    // auto-populate raceList from VALIDATED entries for this race
    try {
        const entries = await apiRequest("GET", `/api/races/${raceId}/entries`);
        const validated = entries.filter(e => e.status === "VALIDATED");
        if (validated.length > 0) {
            raceList = validated.map((e, index) => ({
                id:       e.pilot?.id ?? e.pilotId,
                name:     e.pilot?.displayName ?? e.pilotId,
                country:  e.pilot?.country ?? "un",
                team:     e.teamSnapshot ?? null,
                vehicle:  e.vehicleSnapshot ?? null,
                controls: e.controlsSnapshot ?? null,
                laps: 0, position: index + 1, finished: false, dnf: false,
                raceStartTime: null, lastSplitTimestamp: null,
                lapTimes: [], totalTime: null, frozenTime: null,
            }));
        } else {
            raceList = [];
        }
        updateAddPilotSelect();
    } catch (_) { /* silently ignore if entries can't be loaded */ }

    displayRace();
}

// update the tracking mode button label and disable manual controls in AUTO mode
function updateTrackingModeUI() {
    const btn = document.getElementById("btn-tracking-mode");
    if (btn) btn.textContent = trackingMode === "auto" ? "Mode AUTO ✓" : "Mode MANUEL";
    document.querySelectorAll(".lap-btn, .reorder-btn").forEach(el => el.disabled = (trackingMode === "auto"));
}

// toggle between manual and auto tracking modes via API
async function toggleTrackingMode() {
    if (!activeRaceId) { alert("Charger une course d'abord"); return; }
    const newMode = trackingMode === "manual" ? "auto" : "manual";
    await apiRequest("PATCH", `/api/races/${activeRaceId}/tracking-mode`, { trackingMode: newMode });
    trackingMode = newMode;
    updateTrackingModeUI();
    updateControls();
    displayRace();
}

const _dnfWarningPilots = new Set();

// update DNF warning set and re-render the panel
function handleDnfWarning({ pilotId, cleared }) {
    if (cleared) _dnfWarningPilots.delete(pilotId);
    else         _dnfWarningPilots.add(pilotId);
    renderDnfWarningPanel();
}

// render the DNF warning panel with confirm/ignore buttons per pilot
function renderDnfWarningPanel() {
    const panel = document.getElementById("dnf-warning-panel");
    if (!panel) return;
    if (_dnfWarningPilots.size === 0) { panel.hidden = true; return; }
    panel.hidden    = false;
    panel.innerHTML = [..._dnfWarningPilots].map(pilotId => {
        const pilot = raceList.find(p => p.id === pilotId);
        const name  = pilot?.name ?? pilotId;
        return `<div class="dnf-warning-row">
            <span>⚠️ <strong>${name}</strong> hors zone circuit</span>
            <button onclick="confirmDnf('${pilotId}')">Confirmer DNF</button>
            <button onclick="ignoreDnf('${pilotId}')">Ignorer</button>
        </div>`;
    }).join("");
}

// confirm a DNF warning via API and remove from panel
async function confirmDnf(pilotId) {
    if (!activeRaceId) return;
    await apiRequest("POST", `/api/race-events/races/${activeRaceId}/confirm-dnf/${pilotId}`);
    _dnfWarningPilots.delete(pilotId);
    renderDnfWarningPanel();
}

// dismiss a DNF warning via API and remove from panel
async function ignoreDnf(pilotId) {
    if (!activeRaceId) return;
    await apiRequest("POST", `/api/race-events/races/${activeRaceId}/ignore-dnf/${pilotId}`);
    _dnfWarningPilots.delete(pilotId);
    renderDnfWarningPanel();
}

// server pushes race state in AUTO mode → update dashboard table
socket.on("race-data", (data) => {
    if (trackingMode !== "auto") return;
    if (data.raceList)                           raceList             = data.raceList;
    if (data.raceStatus)                         raceStatus           = data.raceStatus;
    if (data.globalFastestLap        !== undefined) globalFastestLap        = data.globalFastestLap;
    if (data.globalFastestLapPilotId !== undefined) globalFastestLapPilotId = data.globalFastestLapPilotId;
    displayRace();
});

socket.on("dnf-warning",           (data)                => handleDnfWarning(data));
socket.on("tracking-mode-changed", ({ trackingMode: m }) => { trackingMode = m; updateTrackingModeUI(); updateControls(); });
socket.on("race-auto-finished",    ()                    => { raceStatus = "finished"; updateStatusBar("FINISHED"); updateControls(); });
