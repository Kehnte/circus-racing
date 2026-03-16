// race.js

const socket = io("/?role=dashboard");

// ---------------------------------------------------------------------------
// AUTO mode state
// ---------------------------------------------------------------------------
let activeRaceId = null;    // DB race ID currently loaded in the dashboard
let trackingMode = "manual"; // "manual" | "auto"

// ---------------------------------------------------------------------------
// Active race state
// ---------------------------------------------------------------------------
let raceList = [];
let previousRaceList = [];
let teamDisplayMode = "color-bar";
let raceStatus = "standby";
let timingEnabled = true;
let chronoDisplayMode = "leader";

// Tracks whether the pilot list is currently visible on the leaderboard
let pilotsVisible = true;

// Emits a socket event to show or hide the pilot list on the leaderboard overlay
function togglePilotsVisibility() {
    const chip = document.getElementById("btn-pilots-toggle");
    // md-filter-chip toggles `selected` before the click handler fires, so read current state
    pilotsVisible = chip ? chip.hasAttribute("selected") : !pilotsVisible;
    socket.emit("toggle-pilots-visibility", { visible: pilotsVisible });
}

// Session mode: "laps" or "timed"
let sessionMode = "laps";
let sessionDurationMs = 30 * 60 * 1000; // default 30 minutes

// Timed session state
let timedSessionEndTime = null;
let timedSessionExpired = false;
let timedSessionInterval = null;

// Timing accumulators shared across all pilots
let globalRaceStartTime = null;
let pauseStartTime = null;
let totalPauseDuration = 0;
let globalFastestLap = null;
let globalFastestLapPilotId = null;

// Pre-race countdown state
let countdownActive = false;
let countdownEndTime = null;
let countdownInterval = null;

// Backward-compat shim so pilots.js can read team visibility as a boolean
Object.defineProperty(window, "isTeamManagementActive", {
    get: () => teamDisplayMode !== "hidden",
    configurable: true,
});

// Timing helpers

// Returns elapsed ms for a pilot, accounting for pauses, DNF freeze and finish snapshot
function getPilotElapsed(pilot) {
    if (!timingEnabled) return null;
    if (pilot.raceStartTime === null || pilot.raceStartTime === undefined) return null;
    if (pilot.frozenTime !== null && pilot.frozenTime !== undefined) return pilot.frozenTime;
    if (pilot.totalTime !== null && pilot.totalTime !== undefined) return pilot.totalTime;
    const pauseOffset = pauseStartTime ? (Date.now() - pauseStartTime) : 0;
    return Date.now() - pilot.raceStartTime - totalPauseDuration - pauseOffset;
}

// Formats a millisecond duration as M:SS.mmm
function formatTime(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = Math.floor(ms % 1000);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

// Formats a gap as +M:SS.mmm
function formatDelta(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    return `+${formatTime(ms)}`;
}

// Formats remaining ms as M:SS for the session countdown (no milliseconds)
function formatSessionCountdown(ms) {
    if (ms <= 0) return "0:00";
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

// Returns remaining ms in the timed session (0 if expired or not active)
function getSessionRemainingMs() {
    if (sessionMode !== "timed" || timedSessionEndTime === null) return null;
    if (raceStatus === "paused") {
        // remaining was frozen at pause start
        return Math.max(0, timedSessionEndTime - pauseStartTime - totalPauseDuration);
    }
    return Math.max(0, timedSessionEndTime - Date.now());
}

// Settings callbacks

// Applies team display mode change, hides/shows the Teams section and re-renders
function onTeamDisplayModeChange(value) {
    teamDisplayMode = value;
    const teamSection = document.getElementById("teams-manager-section");
    if (teamSection) teamSection.style.display = teamDisplayMode !== "hidden" ? "block" : "none";
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    if (typeof displayPilots === "function") displayPilots();
    displayRace();
}

// Toggles live timing on/off and re-renders
function onTimingEnabledChange(value) {
    timingEnabled = value;
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Switches the chrono column display mode and re-renders
function onChronoDisplayModeChange(value) {
    chronoDisplayMode = value;
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Switches between "laps" and "timed" session modes, toggling the relevant fields
function onSessionModeChange(value) {
    sessionMode = value;
    updateSessionModeUI();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Shows/hides Total Laps vs Session Duration fields based on current sessionMode
function updateSessionModeUI() {
    const lapsField = document.getElementById("total-laps");
    const timedField = document.getElementById("session-duration");
    if (lapsField) lapsField.style.display = sessionMode === "laps" ? "" : "none";
    if (timedField) timedField.style.display = sessionMode === "timed" ? "" : "none";
}

// Pre-race countdown

// Starts the pre-race countdown timer; fires startRace() when it reaches zero
function startCountdown() {
    if (raceList.length === 0) {
        alert("Please load pilots first");
        return;
    }
    if (raceStatus !== "standby") {
        alert("Countdown can only be started before the race begins.");
        return;
    }

    const durationInput = document.getElementById("countdown-duration");
    const durationSec = parseInt(durationInput?.value) || 0;

    if (durationSec <= 0) {
        startRace();
        return;
    }

    stopCountdown(false);
    countdownActive = true;
    countdownEndTime = Date.now() + durationSec * 1000;

    updateCountdownUI();

    countdownInterval = setInterval(() => {
        const remaining = countdownEndTime - Date.now();
        updateCountdownUI();
        if (remaining <= 0) {
            stopCountdown(false);
            startRace();
        }
    }, 200);

    displayRace();
}

// Cancels an active countdown; optionally broadcasts the cancellation
function stopCountdown(broadcast = true) {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    countdownActive = false;
    countdownEndTime = null;
    updateCountdownUI();
    if (broadcast) displayRace();
}

// Syncs the countdown button and stop-link visibility with current state
function updateCountdownUI() {
    const btn = document.getElementById("btn-countdown");
    const stopBtn = document.getElementById("btn-countdown-stop");
    if (btn) btn.disabled = countdownActive || raceStatus !== "standby";
    if (stopBtn) stopBtn.style.display = countdownActive ? "" : "none";
}

// Returns the countdown payload to embed in every race-update broadcast
function getCountdownPayload() {
    if (!countdownActive || countdownEndTime === null) {
        return { active: false, remainingMs: 0 };
    }
    return {
        active: true,
        remainingMs: Math.max(0, countdownEndTime - Date.now()),
    };
}

// Timed session helpers

// Starts the session countdown interval that ticks every 200ms
function startTimedSession() {
    stopTimedSession();
    const durationInput = document.getElementById("session-duration");
    const durationMin = parseFloat(durationInput?.value) || 30;
    sessionDurationMs = durationMin * 60 * 1000;

    timedSessionEndTime = Date.now() + sessionDurationMs;
    timedSessionExpired = false;

    timedSessionInterval = setInterval(() => {
        const remaining = getSessionRemainingMs();
        if (remaining !== null && remaining <= 0 && !timedSessionExpired) {
            timedSessionExpired = true;
            onSessionTimerExpired();
        }
        // Broadcast updated countdown every tick
        broadcastRaceUpdate();
    }, 200);
}

// Clears the session timer interval
function stopTimedSession() {
    if (timedSessionInterval) {
        clearInterval(timedSessionInterval);
        timedSessionInterval = null;
    }
}

// Called when the session timer reaches zero: marks active pilots as "awaiting last lap"
function onSessionTimerExpired() {
    // Each pilot that is still racing will be finished as soon as their next lap is registered
    // We just set the flag here; changeLap() will call checkRaceEnd() which handles the rest
    displayRace();
}

// Resumes the timed session after a pause by recalculating the end time
function resumeTimedSession() {
    if (timedSessionEndTime === null) return;
    // Shift end time forward by the pause duration
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

// Race lifecycle

// Starts the race or resumes it from pause; initialises pilot timestamps on a fresh grid start
function startRace() {
    if (trackingMode === "auto") {
        if (!activeRaceId) { alert("No race loaded"); return; }
        const endpoint = raceStatus === "paused"
            ? `/api/races/${activeRaceId}/resume`
            : `/api/races/${activeRaceId}/start`;
        apiRequest("POST", endpoint).then(() => updateControls()).catch(e => alert(e.message));
        return;
    }

    if (raceList.length === 0) {
        alert("Please load pilots first");
        return;
    }

    stopCountdown(false);

    // Resume from pause: accumulate pause duration and continue
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
    const startType = document.getElementById("setting-start-type")?.value || "Grid Start";
    const isRolling = startType === "Rolling Start";

    if (isFreshStart) {
        globalRaceStartTime = Date.now();
        totalPauseDuration = 0;
        pauseStartTime = null;
        timedSessionExpired = false;

        raceList.forEach((p) => {
            if (isRolling) {
                p.raceStartTime = null;
                p.lastSplitTimestamp = null;
                p.laps = 0;
            } else {
                p.raceStartTime = globalRaceStartTime;
                p.lastSplitTimestamp = globalRaceStartTime;
                p.laps = 1;
            }
            p.lapTimes = [];
            p.totalTime = null;
            p.frozenTime = null;
        });

        if (sessionMode === "timed") startTimedSession();
    }

    raceStatus = "running";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Pauses the race and records the pause start timestamp
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
    raceStatus = "paused";
    pauseStartTime = Date.now();
    // Pause the timed session interval but keep timedSessionEndTime intact
    stopTimedSession();
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Force-finishes the race and snapshots total time for all pilots still running
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

// Resets all pilot lap data and timing state back to standby without removing pilots
function resetRace() {
    stopCountdown(false);
    stopTimedSession();
    socket.emit("race-restarted");
    raceList.forEach((p) => {
        p.laps = 0;
        p.finished = false;
        p.dnf = false;
        p.raceStartTime = null;
        p.lastSplitTimestamp = null;
        p.lapTimes = [];
        p.totalTime = null;
        p.frozenTime = null;
    });
    previousRaceList = [];
    globalRaceStartTime = null;
    pauseStartTime = null;
    totalPauseDuration = 0;
    globalFastestLap = null;
    globalFastestLapPilotId = null;
    timedSessionEndTime = null;
    timedSessionExpired = false;
    raceStatus = "standby";
    recalculatePositions();
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Rebuilds raceList from the pilots roster, resetting all race data
function reloadPilots() {
    stopCountdown(false);
    stopTimedSession();
    raceList = pilots.map((p, index) => ({
        ...p,
        laps: 0,
        position: index + 1,
        finished: false,
        dnf: false,
        raceStartTime: null,
        lastSplitTimestamp: null,
        lapTimes: [],
        totalTime: null,
        frozenTime: null,
    }));
    previousRaceList = [];
    globalRaceStartTime = null;
    pauseStartTime = null;
    totalPauseDuration = 0;
    globalFastestLap = null;
    globalFastestLapPilotId = null;
    timedSessionEndTime = null;
    timedSessionExpired = false;
    raceStatus = "standby";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Lap management

// Increments or decrements a pilot's lap count, records split times and checks for race end
function changeLap(index, delta) {
    if (trackingMode === "auto") return; // engine handles laps in AUTO mode
    if (raceStatus !== "running") return;

    const pilot = raceList[index];
    const totalLaps = parseInt(document.getElementById("total-laps").value) || 3;
    const isRolling = (document.getElementById("setting-start-type")?.value || "Grid Start") === "Rolling Start";
    const newLaps = pilot.laps + delta;

    if (newLaps < 0) return;
    if (newLaps >= 1 && !pilot.dnf && !(delta === 1 && pilot.finished)) {

        // Rolling start: start the clock on the pilot's first lap crossing
        if (isRolling && pilot.laps === 0 && delta === 1 && timingEnabled) {
            pilot.raceStartTime = Date.now();
            pilot.lastSplitTimestamp = Date.now();
        }

        // Record split time when completing a lap
        if (delta === 1 && pilot.laps >= 1 && timingEnabled && pilot.raceStartTime !== null) {
            const now = Date.now();
            const split = now - pilot.lastSplitTimestamp;
            pilot.lapTimes.push(split);
            pilot.lastSplitTimestamp = now;
            checkFastestLap(pilot, split);
        }

        // Undo the last split when removing a lap
        if (delta === -1 && timingEnabled && pilot.lapTimes && pilot.lapTimes.length > 0) {
            const removed = pilot.lapTimes.pop();
            if (pilot.lastSplitTimestamp !== null) {
                pilot.lastSplitTimestamp -= removed;
            }
            recomputeGlobalFastestLap();
        }

        pilot.laps = newLaps;

        // In laps mode: finished when pilot exceeds totalLaps
        // In timed mode: finished when the timer has expired and a new lap is registered
        if (sessionMode === "laps") {
            pilot.finished = pilot.laps > totalLaps;
        } else {
            // Timer expired: this lap crossing finishes the pilot
            pilot.finished = timedSessionExpired && delta === 1;
        }

        // Snapshot finish time the moment the pilot crosses the finish line
        if (pilot.finished && timingEnabled && pilot.raceStartTime !== null && pilot.totalTime === null) {
            pilot.totalTime = getPilotElapsed(pilot);
        }

        recalculatePositions();
        checkRaceEnd();
        if (typeof saveAllToLocal === "function") saveAllToLocal();
        displayRace();
    }
}

// Emits a fastest-lap event if the given split beats the current global record
function checkFastestLap(pilot, splitMs) {
    if (globalFastestLap === null || splitMs < globalFastestLap) {
        globalFastestLap = splitMs;
        globalFastestLapPilotId = pilot.id;

        const team = typeof teams !== "undefined" ? teams.find((t) => t.id === pilot.teamId) : null;
        const ship = typeof vehicles !== "undefined" ? vehicles.find((s) => s.id === pilot.shipId) : null;
        const displayDuration = parseInt(document.getElementById("event-duration")?.value) || 5;

        socket.emit("race-event", {
            type: "fastest-lap",
            pilotId: pilot.id,
            pilotName: pilot.name,
            pilotCountry: pilot.country || "un",
            teamName: team ? team.name : null,
            teamColor: team ? team.color : null,
            shipModel: ship ? ship.model : null,
            time: formatTime(splitMs),
            displayDuration,
        });
    }
}

// Scans all pilots' lap times to recompute the global fastest lap after a lap removal
function recomputeGlobalFastestLap() {
    globalFastestLap = null;
    globalFastestLapPilotId = null;
    raceList.forEach((p) => {
        if (p.lapTimes && p.lapTimes.length > 0) {
            const best = Math.min(...p.lapTimes);
            if (globalFastestLap === null || best < globalFastestLap) {
                globalFastestLap = best;
                globalFastestLapPilotId = p.id;
            }
        }
    });
}

// Position & reorder

// Swaps a pilot one step up or down in the list; allowed in standby and running
function movePilot(index, delta) {
    if (raceStatus === "finished") return;
    const pilot = raceList[index];
    if (pilot.finished) return;
    const newPos = index + delta;
    if (newPos < 0 || newPos >= raceList.length) return;
    const temp = raceList[index];
    raceList[index] = raceList[newPos];
    raceList[newPos] = temp;
    recalculatePositions();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Moves a pilot directly to an arbitrary position; allowed in standby and running
function jumpToPosition(index, newPosValue) {
    if (raceStatus === "finished") { displayRace(); return; }
    const pilot = raceList[index];
    if (pilot.finished) { displayRace(); return; }
    const newPos = parseInt(newPosValue);
    if (isNaN(newPos) || newPos < 1 || newPos > raceList.length) {
        displayRace();
        return;
    }
    const spliced = raceList.splice(index, 1)[0];
    raceList.splice(newPos - 1, 0, spliced);
    recalculatePositions();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Toggles a pilot's DNF flag; freezes their elapsed time when set
function toggleDNF(index) {
    if (trackingMode === "auto") return; // use confirm-dnf API in AUTO mode
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

// Sorts raceList by DNF → finished → laps desc, then reassigns position numbers
function recalculatePositions() {
    raceList.sort((a, b) => {
        if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.laps !== b.laps) return b.laps - a.laps;
        return 0;
    });
    raceList.forEach((p, idx) => { p.position = idx + 1; });
}

// Chrono display

// Returns the formatted chrono string for a pilot according to the active display mode
function getChronoDisplay(pilot, index) {
    if (!timingEnabled) return "";

    switch (chronoDisplayMode) {
        case "leader": {
            if (index === 0) {
                const t = getPilotElapsed(pilot);
                return t !== null ? formatTime(t) : "—";
            }
            const leaderElapsed = getPilotElapsed(raceList[0]);
            const myElapsed = getPilotElapsed(pilot);
            if (leaderElapsed === null || myElapsed === null) return "—";
            return formatDelta(myElapsed - leaderElapsed);
        }
        case "gap": {
            if (index === 0) {
                const t = getPilotElapsed(pilot);
                return t !== null ? formatTime(t) : "—";
            }
            const prevElapsed = getPilotElapsed(raceList[index - 1]);
            const myElapsed = getPilotElapsed(pilot);
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

// Event detection

// Diffs raceList against previousRaceList and emits incident/finished events for state changes
function detectAndEmitEvents() {
    if (previousRaceList.length === 0) return;

    raceList.forEach((pilot) => {
        const previous = previousRaceList.find((p) => p.id === pilot.id);
        if (!previous) return;

        const team = typeof teams !== "undefined" ? teams.find((t) => t.id === pilot.teamId) : null;
        const ship = typeof vehicles !== "undefined" ? vehicles.find((s) => s.id === pilot.shipId) : null;
        const displayDuration = parseInt(document.getElementById("event-duration")?.value) || 5;

        const payload = {
            pilotId: pilot.id,
            pilotName: pilot.name,
            pilotCountry: pilot.country || "un",
            teamName: team ? team.name : null,
            teamColor: team ? team.color : null,
            shipModel: ship ? ship.model : null,
            displayDuration,
        };

        if (!previous.dnf && pilot.dnf) {
            socket.emit("race-event", { ...payload, type: "incident" });
        }
        if (!previous.finished && pilot.finished) {
            socket.emit("race-event", { ...payload, type: "finished" });
        }
    });
}

// Render

// Rebuilds the race table, updates column visibility and broadcasts full state to overlays
function displayRace() {
    const tableBody = document.getElementById("race-list");
    const pilotCountEl = document.getElementById("pilot-count");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    if (pilotCountEl) pilotCountEl.textContent = raceList.length;

    const isRunning = raceStatus === "running";
    const showTeams = teamDisplayMode !== "hidden";

    raceList.forEach((pilot, index) => {
        const team = typeof teams !== "undefined" ? teams.find((t) => t.id === (pilot.teamId ?? null)) : null;
        const lapDisplay = pilot.finished
            ? `<span class="lap-display finished">Finished</span>`
            : `<span class="lap-display">${pilot.laps}</span>`;
        const posBadgeClass = index === 0 ? "position-badge pos-first" : "position-badge";
        const teamColor = team ? team.color : "inherit";
        const teamAcronym = team ? team.acronym : "-";
        const canReorder = (raceStatus === "running" || raceStatus === "standby") && !pilot.finished;
        const canSetPos  = (raceStatus === "running" || raceStatus === "standby") && !pilot.finished;
        const chronoCell = timingEnabled
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
                    ${!canSetPos ? "disabled" : ""}
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

    // Toggle chrono and team column visibility via CSS classes
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

// Broadcast helper — emits current race state to all overlays
function broadcastRaceUpdate() {
    socket.emit("race-update", {
        raceList: raceList.map((p) => ({
            ...p,
            chronoDisplay: getChronoDisplay(p, raceList.indexOf(p)),
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
            active: raceStatus === "running" || raceStatus === "paused",
            remainingMs: getSessionRemainingMs() ?? 0,
            expired: timedSessionExpired,
        } : null,
        settings: {
            raceName: document.getElementById("setting-race-name")?.value || "",
            session: document.getElementById("setting-session")?.value || "",
            weather: document.getElementById("setting-weather")?.value || "",
            startType: document.getElementById("setting-start-type")?.value || "",
            totalLaps: document.getElementById("total-laps")?.value || "3",
        },
    });
}

// Race end

// Automatically marks the race finished when every pilot has either finished or DNF'd
// In timed mode, waits until timer has expired before allowing auto-finish
function checkRaceEnd() {
    if (raceStatus !== "running") return;

    if (sessionMode === "timed") {
        // Only auto-finish once the timer has expired and all pilots are done
        if (!timedSessionExpired) return;
    }

    const stillRacing = raceList.some((p) => !p.finished && !p.dnf);
    if (!stillRacing && raceList.length > 0) {
        raceStatus = "finished";
        stopTimedSession();
        updateControls();
    }
}

// Syncs Start/Pause/Finish button states with the current raceStatus
function updateControls() {
    const btnStart  = document.getElementById("btn-start");
    const btnPause  = document.getElementById("btn-pause");
    const btnFinish = document.getElementById("btn-finish");
    if (!btnStart || !btnPause || !btnFinish) return;

    if (raceStatus === "running") {
        btnStart.disabled = true;
        btnStart.textContent = "Start race";
        btnPause.disabled = false;
        btnFinish.disabled = false;
    } else if (raceStatus === "paused") {
        btnStart.disabled = false;
        btnStart.textContent = "Resume race";
        btnPause.disabled = true;
        btnFinish.disabled = false;
    } else {
        btnStart.disabled = false;
        btnStart.textContent = "Start race";
        btnPause.disabled = true;
        btnFinish.disabled = true;
    }

    updateCountdownUI();

    // AUTO mode: disable manual lap/reorder/DNF buttons
    if (trackingMode === "auto") {
        document.querySelectorAll(".lap-btn, .reorder-btn, .dnf-btn").forEach(el => { el.disabled = true; });
    }
}

// Intervals

// Refreshes chrono cells in the dashboard table every 100 ms while the race is running
setInterval(() => {
    if (raceStatus !== "running" || !timingEnabled) return;
    const cells = document.querySelectorAll("#race-list .chrono-cell");
    raceList.forEach((pilot, index) => {
        const cell = cells[index];
        if (!cell) return;
        cell.textContent = pilot.dnf ? "DNF" : getChronoDisplay(pilot, index);
    });
}, 100);

// Keeps the leaderboard countdown display in sync by broadcasting state every 500 ms
setInterval(() => {
    if (!countdownActive) return;
    broadcastRaceUpdate();
}, 500);

// Settings live broadcast

// Attaches change/input listeners to all settings fields so the leaderboard updates immediately on any edit
document.addEventListener("DOMContentLoaded", () => {
    const settingIds = [
        "setting-race-name",
        "setting-session",
        "setting-weather",
        "setting-start-type",
        "total-laps",
    ];

    settingIds.forEach((id) => {
        const handler = () => setTimeout(displayRace, 0);
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", handler);
        el.addEventListener("input", handler);
    });

    // Session mode selector
    const sessionModeSelect = document.getElementById("setting-session-mode");
    if (sessionModeSelect) {
        sessionModeSelect.addEventListener("change", () => {
            onSessionModeChange(sessionModeSelect.value);
        });
    }

    // Session duration field
    const sessionDurationEl = document.getElementById("session-duration");
    if (sessionDurationEl) {
        sessionDurationEl.addEventListener("change", () => setTimeout(displayRace, 0));
        sessionDurationEl.addEventListener("input", () => setTimeout(displayRace, 0));
    }

    // Apply initial UI state
    updateSessionModeUI();

    // Initialise pilots toggle chip to selected (pilots visible by default)
    const pilotsChip = document.getElementById("btn-pilots-toggle");
    if (pilotsChip) pilotsChip.setAttribute("selected", "");
});

// ---------------------------------------------------------------------------
// AUTO mode — active race selector
// ---------------------------------------------------------------------------

async function loadActiveRaceList() {
    const races = await apiRequest("GET", "/api/races?status=PENDING,SCHEDULED,STARTED,PAUSED");
    const select = document.getElementById("active-race-select");
    if (!select) return;
    select.innerHTML = '<option value="">— Sélectionner une course —</option>';
    races.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = `${r.name} [${r.status}]`;
        select.appendChild(opt);
    });
}

async function loadActiveRace(raceId) {
    if (!raceId) {
        activeRaceId = null;
        trackingMode = "manual";
        updateControls();
        return;
    }
    const r = await apiRequest("GET", `/api/races/${raceId}`);
    activeRaceId = r.id;
    trackingMode = r.trackingMode ?? "manual";

    // Populate settings fields from DB race
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
    setVal("setting-race-name", r.name);
    setVal("setting-session", r.session);
    setVal("setting-weather", r.weather);
    setVal("setting-start-type", r.startType);
    setVal("total-laps", r.lapCount);
    setVal("setting-session-mode", r.sessionMode);

    // Reflect current race status
    const statusMap = { STARTED: "running", PAUSED: "paused", FINISHED: "finished" };
    raceStatus = statusMap[r.status] ?? "standby";

    updateTrackingModeUI();
    updateControls();
    displayRace();
}

function updateTrackingModeUI() {
    const btn = document.getElementById("btn-tracking-mode");
    if (btn) btn.textContent = trackingMode === "auto" ? "Mode AUTO ✓" : "Mode MANUEL";
    // Disable manual interaction buttons in AUTO mode
    const manualOnly = document.querySelectorAll(".lap-btn, .reorder-btn");
    manualOnly.forEach(el => el.disabled = (trackingMode === "auto"));
}

async function toggleTrackingMode() {
    if (!activeRaceId) { alert("Charger une course d'abord"); return; }
    const newMode = trackingMode === "manual" ? "auto" : "manual";
    await apiRequest("PATCH", `/api/races/${activeRaceId}/tracking-mode`, { trackingMode: newMode });
    trackingMode = newMode;
    updateTrackingModeUI();
    updateControls();
    displayRace();
}

// ---------------------------------------------------------------------------
// AUTO mode — DNF warning panel
// ---------------------------------------------------------------------------

const _dnfWarningPilots = new Set();

function handleDnfWarning({ pilotId, cleared }) {
    if (cleared) {
        _dnfWarningPilots.delete(pilotId);
    } else {
        _dnfWarningPilots.add(pilotId);
    }
    renderDnfWarningPanel();
}

function renderDnfWarningPanel() {
    const panel = document.getElementById("dnf-warning-panel");
    if (!panel) return;
    if (_dnfWarningPilots.size === 0) { panel.hidden = true; return; }
    panel.hidden = false;
    panel.innerHTML = [..._dnfWarningPilots].map(pilotId => {
        const pilot = raceList.find(p => p.id === pilotId);
        const name = pilot?.name ?? pilotId;
        return `<div class="dnf-warning-row">
            <span>⚠️ <strong>${name}</strong> hors zone circuit</span>
            <button onclick="confirmDnf('${pilotId}')">Confirmer DNF</button>
            <button onclick="ignoreDnf('${pilotId}')">Ignorer</button>
        </div>`;
    }).join("");
}

async function confirmDnf(pilotId) {
    if (!activeRaceId) return;
    await apiRequest("POST", `/api/race-events/races/${activeRaceId}/confirm-dnf/${pilotId}`);
    _dnfWarningPilots.delete(pilotId);
    renderDnfWarningPanel();
}

async function ignoreDnf(pilotId) {
    if (!activeRaceId) return;
    await apiRequest("POST", `/api/race-events/races/${activeRaceId}/ignore-dnf/${pilotId}`);
    _dnfWarningPilots.delete(pilotId);
    renderDnfWarningPanel();
}

// ---------------------------------------------------------------------------
// Socket listeners — AUTO mode server events
// ---------------------------------------------------------------------------

// Server pushes race state in AUTO mode → update dashboard table
socket.on("race-data", (data) => {
    if (trackingMode !== "auto") return;
    if (data.raceList) raceList = data.raceList;
    if (data.raceStatus) raceStatus = data.raceStatus;
    if (data.globalFastestLap !== undefined) globalFastestLap = data.globalFastestLap;
    if (data.globalFastestLapPilotId !== undefined) globalFastestLapPilotId = data.globalFastestLapPilotId;
    displayRace();
});

// DNF warning from engine
socket.on("dnf-warning", (data) => handleDnfWarning(data));

// Admin toggled mode from another session
socket.on("tracking-mode-changed", ({ trackingMode: m }) => {
    trackingMode = m;
    updateTrackingModeUI();
    updateControls();
});

// All pilots finished automatically (AUTO mode)
socket.on("race-auto-finished", () => {
    raceStatus = "finished";
    updateControls();
});