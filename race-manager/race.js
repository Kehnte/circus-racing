// race.js

const socket = io();

// Current race pilot list (ordered by position)
let raceList = [];
// Snapshot of raceList from the previous render cycle, used to detect lap/DNF changes
let previousRaceList = [];
// Team display mode: "hidden" | "color-bar" | "acronym"
let teamDisplayMode = "color-bar";
// Race lifecycle state: "standby" | "running" | "paused" | "finished"
let raceStatus = "standby";
// Timing enabled
let timingEnabled = true;
// Chrono display mode: "gap" | "leader" | "best-lap" | "last-lap"
let chronoDisplayMode = "leader";

// Global race start timestamp (ms) — null until startRace()
let globalRaceStartTime = null;
// Timestamp when the race was paused — used to compute pause delta
let pauseStartTime = null;
// Total accumulated pause duration (ms) across all pauses in the current race
let totalPauseDuration = 0;
// Best lap globally across all pilots (ms) — null if no lap completed yet
let globalFastestLap = null;
// ID of the pilot currently holding the fastest lap
let globalFastestLapPilotId = null;

// isTeamManagementActive kept as a derived getter for backward compat with pilots.js
Object.defineProperty(window, "isTeamManagementActive", {
    get: () => teamDisplayMode !== "hidden",
    configurable: true,
});

// Timing helpers

// Return current race clock in ms (wall time minus all pause durations)
function raceNow() {
    if (globalRaceStartTime === null) return 0;
    const pauseOffset = pauseStartTime ? (Date.now() - pauseStartTime) : 0;
    return Date.now() - globalRaceStartTime - totalPauseDuration - pauseOffset;
}

// Format ms to M:SS.mmm
function formatTime(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = Math.floor(ms % 1000);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

// Format ms delta to +M:SS.mmm
function formatDelta(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    return `+${formatTime(ms)}`;
}

// Compute the elapsed ms for a pilot from their personal raceStartTime
function getPilotElapsed(pilot) {
    if (!timingEnabled) return null;
    if (pilot.raceStartTime === null || pilot.raceStartTime === undefined) return null;
    if (pilot.frozenTime !== null && pilot.frozenTime !== undefined) return pilot.frozenTime;
    if (pilot.totalTime !== null && pilot.totalTime !== undefined) return pilot.totalTime;
    // Adjust for pauses: pilot start time is in wall-clock ms, so we subtract global race start offset
    const pauseOffset = pauseStartTime ? (Date.now() - pauseStartTime) : 0;
    return Date.now() - pilot.raceStartTime - totalPauseDuration - pauseOffset;
}

// Settings callbacks

function onTeamDisplayModeChange(value) {
    teamDisplayMode = value;
    const teamSection = document.getElementById("teams-manager-section");
    if (teamSection) teamSection.style.display = teamDisplayMode !== "hidden" ? "block" : "none";
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    if (typeof displayPilots === "function") displayPilots();
    displayRace();
}

function onTimingEnabledChange(value) {
    timingEnabled = value;
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

function onChronoDisplayModeChange(value) {
    chronoDisplayMode = value;
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Race lifecycle

function startRace() {
    if (raceList.length === 0) {
        alert("Please load pilots first");
        return;
    }

    // Resume from pause
    if (raceStatus === "paused" && pauseStartTime !== null) {
        totalPauseDuration += Date.now() - pauseStartTime;
        pauseStartTime = null;
        raceStatus = "running";
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

        raceList.forEach((p) => {
            if (isRolling) {
                // Rolling: pilot stays at lap 0 until they cross the start line
                p.raceStartTime = null;
                p.lastSplitTimestamp = null;
                p.laps = 0;
            } else {
                // Grid: everyone starts at lap 1 simultaneously
                p.raceStartTime = globalRaceStartTime;
                p.lastSplitTimestamp = globalRaceStartTime;
                p.laps = 1;
            }
            p.lapTimes = [];
            p.totalTime = null;
            p.frozenTime = null;
        });
    }

    raceStatus = "running";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

function pauseRace() {
    if (raceStatus !== "running") return;
    raceStatus = "paused";
    pauseStartTime = Date.now();
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

function endRaceManually() {
    raceStatus = "finished";
    // Freeze any pilot still running
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

function resetRace() {
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
    raceStatus = "standby";
    recalculatePositions();
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

function reloadPilots() {
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
    raceStatus = "standby";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Lap management

function changeLap(index, delta) {
    if (raceStatus !== "running") return;

    const pilot = raceList[index];
    const totalLaps = parseInt(document.getElementById("total-laps").value) || 3;
    const startType = document.getElementById("setting-start-type")?.value || "Grid Start";
    const isRolling = startType === "Rolling Start";
    let newLaps = pilot.laps + delta;

    if (newLaps < 0) return;
    if (newLaps >= 1 && !pilot.dnf) {

        // Rolling start: pilot crossing start line for the first time (0 → 1)
        if (isRolling && pilot.laps === 0 && delta === 1 && timingEnabled) {
            pilot.raceStartTime = Date.now();
            pilot.lastSplitTimestamp = Date.now();
        }

        // Recording a new lap split (not the first lap in rolling, not going backwards)
        if (delta === 1 && pilot.laps >= 1 && timingEnabled && pilot.raceStartTime !== null) {
            const now = Date.now();
            const split = now - pilot.lastSplitTimestamp - (raceStatus === "paused" ? (Date.now() - pauseStartTime) : 0);
            // Correct split: time since last split, accounting for pauses
            const correctedSplit = now - pilot.lastSplitTimestamp;
            pilot.lapTimes.push(correctedSplit);
            pilot.lastSplitTimestamp = now;

            // Check for new fastest lap
            if (timingEnabled) {
                checkFastestLap(pilot, correctedSplit);
            }
        }

        // Removing a lap: pop last split and restore lastSplitTimestamp
        if (delta === -1 && timingEnabled && pilot.lapTimes && pilot.lapTimes.length > 0) {
            const removedSplit = pilot.lapTimes.pop();
            if (pilot.lastSplitTimestamp !== null) {
                pilot.lastSplitTimestamp = pilot.lastSplitTimestamp - removedSplit;
            }
            // Recompute fastest lap globally in case this was the record
            recomputeGlobalFastestLap();
        }

        pilot.laps = newLaps;
        pilot.finished = pilot.laps > totalLaps;

        if (pilot.finished && timingEnabled && pilot.raceStartTime !== null && pilot.totalTime === null) {
            pilot.totalTime = getPilotElapsed(pilot);
        }

        recalculatePositions();
        checkRaceEnd();
        if (typeof saveAllToLocal === "function") saveAllToLocal();
        displayRace();
    }
}

// Check if a new split beats the global fastest lap and emit event if so
function checkFastestLap(pilot, splitMs) {
    if (globalFastestLap === null || splitMs < globalFastestLap) {
        globalFastestLap = splitMs;
        globalFastestLapPilotId = pilot.id;

        const team = typeof teams !== "undefined" ? teams.find((t) => t.id === pilot.teamId) : null;
        const ship = typeof ships !== "undefined" ? ships.find((s) => s.id === pilot.shipId) : null;
        const durationInput = document.getElementById("event-duration");
        const displayDuration = durationInput ? parseInt(durationInput.value) || 5 : 5;

        socket.emit("race-event", {
            type: "fastest-lap",
            pilotId: pilot.id,
            pilotName: pilot.name,
            pilotCountry: pilot.country || "un",
            teamName: team ? team.name : null,
            teamColor: team ? team.color : null,
            shipModel: ship ? ship.model : null,
            time: formatTime(splitMs),
            displayDuration: displayDuration,
        });
    }
}

// Recompute globalFastestLap from scratch after a lap is removed
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

function movePilot(index, delta) {
    const newPos = index + delta;
    if (newPos < 0 || newPos >= raceList.length) return;
    const temp = raceList[index];
    raceList[index] = raceList[newPos];
    raceList[newPos] = temp;
    recalculatePositions();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

function jumpToPosition(index, newPosValue) {
    const newPos = parseInt(newPosValue);
    if (isNaN(newPos) || newPos < 1 || newPos > raceList.length) {
        displayRace();
        return;
    }
    const pilot = raceList.splice(index, 1)[0];
    raceList.splice(newPos - 1, 0, pilot);
    recalculatePositions();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

function toggleDNF(index) {
    const pilot = raceList[index];
    pilot.dnf = !pilot.dnf;

    if (pilot.dnf) {
        pilot.finished = false;
        if (timingEnabled && pilot.raceStartTime !== null && pilot.frozenTime === null) {
            pilot.frozenTime = getPilotElapsed(pilot);
        }
    } else {
        // Un-DNF: unfreeze
        pilot.frozenTime = null;
    }

    recalculatePositions();
    checkRaceEnd();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

function recalculatePositions() {
    raceList.sort((a, b) => {
        if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.laps !== b.laps) return b.laps - a.laps;
        return 0;
    });
    raceList.forEach((p, idx) => {
        p.position = idx + 1;
    });
}

// Chrono display helpers

// Build the chrono string for a pilot based on current chronoDisplayMode
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
        case "best-lap": {
            if (!pilot.lapTimes || pilot.lapTimes.length === 0) return "—";
            return formatTime(Math.min(...pilot.lapTimes));
        }
        case "last-lap": {
            if (!pilot.lapTimes || pilot.lapTimes.length === 0) return "—";
            return formatTime(pilot.lapTimes[pilot.lapTimes.length - 1]);
        }
        default:
            return "—";
    }
}

// Event detection

function detectAndEmitEvents() {
    if (previousRaceList.length === 0) return;

    raceList.forEach((pilot) => {
        const previous = previousRaceList.find((p) => p.id === pilot.id);
        if (!previous) return;

        const team = typeof teams !== "undefined" ? teams.find((t) => t.id === pilot.teamId) : null;
        const ship = typeof ships !== "undefined" ? ships.find((s) => s.id === pilot.shipId) : null;
        const durationInput = document.getElementById("event-duration");
        const displayDuration = durationInput ? parseInt(durationInput.value) || 5 : 5;

        const eventPayload = {
            pilotId: pilot.id,
            pilotName: pilot.name,
            pilotCountry: pilot.country || "un",
            teamName: team ? team.name : null,
            teamColor: team ? team.color : null,
            shipModel: ship ? ship.model : null,
            displayDuration: displayDuration,
        };

        if (!previous.dnf && pilot.dnf) {
            socket.emit("race-event", { ...eventPayload, type: "incident" });
        }

        if (!previous.finished && pilot.finished) {
            socket.emit("race-event", { ...eventPayload, type: "finished" });
        }
    });
}

// Render

function displayRace() {
    const tableBody = document.getElementById("race-list");
    const pilotCountEl = document.getElementById("pilot-count");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    if (pilotCountEl) pilotCountEl.textContent = raceList.length;

    const isRunning = raceStatus === "running";
    const showTeams = teamDisplayMode !== "hidden";

    raceList.forEach((pilot, index) => {
        const team = typeof teams !== "undefined" ? teams.find((t) => t.id === pilot.teamId) : null;

        const lapDisplay = pilot.finished
            ? `<span class="lap-display finished">Finished</span>`
            : `<span class="lap-display">${pilot.laps}</span>`;

        const posBadgeClass = index === 0 ? "position-badge pos-first" : "position-badge";
        const teamColor = team ? team.color : "inherit";
        const teamAcronym = team ? team.acronym : "-";

        // Chrono column
        const chronoDisplay = timingEnabled ? getChronoDisplay(pilot, index) : "";
        const chronoCell = timingEnabled
            ? `<td class="chrono-cell" style="${pilot.dnf ? "opacity:0.5;" : ""}">${pilot.dnf ? "DNF" : chronoDisplay}</td>`
            : "";

        const chronoHeader = timingEnabled ? "" : ""; // handled via CSS class on table

        const row = `
        <tr class="${pilot.dnf ? "dnf-row" : ""} ${pilot.finished ? "finished-row" : ""}">
            <td><span class="${posBadgeClass}">${pilot.position}</span></td>
            <td>${pilot.name}</td>
            <td style="color: ${teamColor}; display: ${showTeams ? "" : "none"}">
                ${teamAcronym}
            </td>
            <td>${lapDisplay}</td>
            ${chronoCell}
            <td>
                <div class="action-buttons">
                    <md-icon-button onclick="changeLap(${index}, -1)" ${!isRunning ? "disabled" : ""} title="Remove lap">
                        <md-icon>remove</md-icon>
                    </md-icon-button>
                    <md-icon-button onclick="changeLap(${index}, 1)" ${!isRunning || pilot.finished ? "disabled" : ""} title="Add lap">
                        <md-icon>add</md-icon>
                    </md-icon-button>
                </div>
            </td>
            <td>
                <input
                    class="inline-number"
                    type="number"
                    value="${pilot.position}"
                    min="1"
                    max="${raceList.length}"
                    onchange="jumpToPosition(${index}, this.value)"
                />
            </td>
            <td>
                <div class="action-buttons">
                    <md-icon-button onclick="movePilot(${index}, -1)" ${index === 0 ? "disabled" : ""} title="Move up">
                        <md-icon>arrow_upward</md-icon>
                    </md-icon-button>
                    <md-icon-button onclick="movePilot(${index}, 1)" ${index === raceList.length - 1 ? "disabled" : ""} title="Move down">
                        <md-icon>arrow_downward</md-icon>
                    </md-icon-button>
                </div>
            </td>
            <td>
                <md-icon-button
                    onclick="toggleDNF(${index})"
                    title="${pilot.dnf ? "Reset DNF" : "DNF"}"
                    style="${pilot.dnf ? "--md-icon-button-icon-color: var(--md-sys-color-tertiary);" : "--md-icon-button-icon-color: var(--md-sys-color-error);"}"
                >
                    <md-icon>${pilot.dnf ? "restart_alt" : "cancel"}</md-icon>
                </md-icon-button>
            </td>
        </tr>`;

        tableBody.insertAdjacentHTML("beforeend", row);
    });

    // Show/hide team columns
    document.querySelectorAll("table.m3-table").forEach((table) => {
        table.classList.toggle("teams-hidden", !showTeams);
    });

    // Show/hide chrono column in race table
    const raceTable = document.getElementById("race-list")?.closest("table");
    if (raceTable) {
        raceTable.classList.toggle("chrono-hidden", !timingEnabled);
    }

    // Update chrono column header visibility
    const chronoTh = document.getElementById("race-chrono-th");
    if (chronoTh) chronoTh.style.display = timingEnabled ? "" : "none";

    detectAndEmitEvents();
    previousRaceList = raceList.map((p) => ({ ...p, lapTimes: [...(p.lapTimes || [])] }));

    // Broadcast full state
    socket.emit("race-update", {
        raceList: raceList.map((p) => ({
            ...p,
            chronoDisplay: getChronoDisplay(p, raceList.indexOf(p)),
        })),
        teams: typeof teams !== "undefined" ? teams : [],
        teamDisplayMode: teamDisplayMode,
        timingEnabled: timingEnabled,
        chronoDisplayMode: chronoDisplayMode,
        globalFastestLap: globalFastestLap,
        globalFastestLapPilotId: globalFastestLapPilotId,
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

function checkRaceEnd() {
    const stillRacing = raceList.some((p) => !p.finished && !p.dnf);
    if (!stillRacing && raceList.length > 0 && raceStatus === "running") {
        raceStatus = "finished";
        updateControls();
    }
}

function updateControls() {
    const btnStart = document.getElementById("btn-start");
    const btnPause = document.getElementById("btn-pause");
    const btnFinish = document.getElementById("btn-finish");
    if (!btnStart || !btnPause || !btnFinish) return;

    if (raceStatus === "running") {
        btnStart.disabled = true;
        btnPause.disabled = false;
        btnFinish.disabled = false;
    } else if (raceStatus === "paused") {
        btnStart.disabled = false;
        btnPause.disabled = true;
        btnFinish.disabled = false;
    } else {
        btnStart.disabled = false;
        btnPause.disabled = true;
        btnFinish.disabled = true;
    }
}

// Live chrono refresh

// Refresh chrono cells every 100ms while race is running
setInterval(() => {
    if (raceStatus !== "running" || !timingEnabled) return;
    const cells = document.querySelectorAll("#race-list .chrono-cell");
    raceList.forEach((pilot, index) => {
        const cell = cells[index];
        if (!cell) return;
        if (pilot.dnf) {
            cell.textContent = "DNF";
            return;
        }
        cell.textContent = getChronoDisplay(pilot, index);
    });
}, 100);