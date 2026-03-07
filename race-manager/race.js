// race.js

const socket = io();

let raceList = [];
let previousRaceList = [];
let teamDisplayMode = "color-bar";
let raceStatus = "standby";
let timingEnabled = true;
let chronoDisplayMode = "leader";

let globalRaceStartTime = null;
let pauseStartTime = null;
let totalPauseDuration = 0;
let globalFastestLap = null;
let globalFastestLapPilotId = null;

// ── Pre-race countdown ────────────────────────────────────────
let countdownActive = false;
let countdownEndTime = null;
let countdownInterval = null;

// backward compat with pilots.js
Object.defineProperty(window, "isTeamManagementActive", {
    get: () => teamDisplayMode !== "hidden",
    configurable: true,
});

// -- Timing helpers -----------------------------------------------------------

function getPilotElapsed(pilot) {
    if (!timingEnabled) return null;
    if (pilot.raceStartTime === null || pilot.raceStartTime === undefined) return null;
    if (pilot.frozenTime !== null && pilot.frozenTime !== undefined) return pilot.frozenTime;
    if (pilot.totalTime !== null && pilot.totalTime !== undefined) return pilot.totalTime;
    const pauseOffset = pauseStartTime ? (Date.now() - pauseStartTime) : 0;
    return Date.now() - pilot.raceStartTime - totalPauseDuration - pauseOffset;
}

function formatTime(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = Math.floor(ms % 1000);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function formatDelta(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    return `+${formatTime(ms)}`;
}

// -- Settings callbacks -------------------------------------------------------

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

// -- Pre-race countdown -------------------------------------------------------

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
        // No duration set — start race immediately
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

function updateCountdownUI() {
    const btn = document.getElementById("btn-countdown");
    const stopBtn = document.getElementById("btn-countdown-stop");
    if (btn) btn.disabled = countdownActive || raceStatus !== "standby";
    if (stopBtn) stopBtn.style.display = countdownActive ? "" : "none";
}

function getCountdownPayload() {
    if (!countdownActive || countdownEndTime === null) {
        return { active: false, remainingMs: 0 };
    }
    return {
        active: true,
        remainingMs: Math.max(0, countdownEndTime - Date.now()),
    };
}

// -- Race lifecycle -----------------------------------------------------------

function startRace() {
    if (raceList.length === 0) {
        alert("Please load pilots first");
        return;
    }

    // Cancel any running countdown silently
    stopCountdown(false);

    // Resume from pause
    if (raceStatus === "paused" && pauseStartTime !== null) {
        totalPauseDuration += Date.now() - pauseStartTime;
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
    stopCountdown(false);
    // Notify the leaderboard so it can flash the "Race restarted" banner
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
    raceStatus = "standby";
    recalculatePositions();
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

function reloadPilots() {
    stopCountdown(false);
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

// -- Lap management ----------------------------------------------------------

function changeLap(index, delta) {
    if (raceStatus !== "running") return;

    const pilot = raceList[index];
    const totalLaps = parseInt(document.getElementById("total-laps").value) || 3;
    const isRolling = (document.getElementById("setting-start-type")?.value || "Grid Start") === "Rolling Start";
    const newLaps = pilot.laps + delta;

    if (newLaps < 0) return;
    if (newLaps >= 1 && !pilot.dnf) {

        if (isRolling && pilot.laps === 0 && delta === 1 && timingEnabled) {
            pilot.raceStartTime = Date.now();
            pilot.lastSplitTimestamp = Date.now();
        }

        if (delta === 1 && pilot.laps >= 1 && timingEnabled && pilot.raceStartTime !== null) {
            const now = Date.now();
            const split = now - pilot.lastSplitTimestamp;
            pilot.lapTimes.push(split);
            pilot.lastSplitTimestamp = now;
            checkFastestLap(pilot, split);
        }

        if (delta === -1 && timingEnabled && pilot.lapTimes && pilot.lapTimes.length > 0) {
            const removed = pilot.lapTimes.pop();
            if (pilot.lastSplitTimestamp !== null) {
                pilot.lastSplitTimestamp -= removed;
            }
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

function checkFastestLap(pilot, splitMs) {
    if (globalFastestLap === null || splitMs < globalFastestLap) {
        globalFastestLap = splitMs;
        globalFastestLapPilotId = pilot.id;

        const team = typeof teams !== "undefined" ? teams.find((t) => t.id === pilot.teamId) : null;
        const ship = typeof ships !== "undefined" ? ships.find((s) => s.id === pilot.shipId) : null;
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

// -- Position & reorder ------------------------------------------------------

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
    raceList.forEach((p, idx) => { p.position = idx + 1; });
}

// -- Chrono display ----------------------------------------------------------

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

// -- Event detection ---------------------------------------------------------

function detectAndEmitEvents() {
    if (previousRaceList.length === 0) return;

    raceList.forEach((pilot) => {
        const previous = previousRaceList.find((p) => p.id === pilot.id);
        if (!previous) return;

        const team = typeof teams !== "undefined" ? teams.find((t) => t.id === pilot.teamId) : null;
        const ship = typeof ships !== "undefined" ? ships.find((s) => s.id === pilot.shipId) : null;
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

// -- Render ------------------------------------------------------------------

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
        const chronoCell = timingEnabled
            ? `<td class="chrono-cell" style="${pilot.dnf ? "opacity:0.5;" : ""}">${pilot.dnf ? "DNF" : getChronoDisplay(pilot, index)}</td>`
            : "";

        const dnfTitle = pilot.dnf ? "Reset DNF" : "DNF";
        const dnfIcon = pilot.dnf ? "restart_alt" : "cancel";
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
                    <md-icon-button onclick="changeLap(${index}, -1)" ${!isRunning ? "disabled" : ""} title="Remove lap"><md-icon>remove</md-icon></md-icon-button>
                    <md-icon-button onclick="changeLap(${index}, 1)" ${!isRunning || pilot.finished ? "disabled" : ""} title="Add lap"><md-icon>add</md-icon></md-icon-button>
                </div>
            </td>
            <td>
                <input class="inline-number" type="number" value="${pilot.position}" min="1" max="${raceList.length}" onchange="jumpToPosition(${index}, this.value)" />
            </td>
            <td>
                <div class="action-buttons">
                    <md-icon-button onclick="movePilot(${index}, -1)" ${index === 0 ? "disabled" : ""} title="Move up"><md-icon>arrow_upward</md-icon></md-icon-button>
                    <md-icon-button onclick="movePilot(${index}, 1)" ${index === raceList.length - 1 ? "disabled" : ""} title="Move down"><md-icon>arrow_downward</md-icon></md-icon-button>
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

    document.querySelectorAll("table.m3-table").forEach((t) => t.classList.toggle("teams-hidden", !showTeams));

    const raceTable = document.getElementById("race-list")?.closest("table");
    if (raceTable) raceTable.classList.toggle("chrono-hidden", !timingEnabled);

    const chronoTh = document.getElementById("race-chrono-th");
    if (chronoTh) chronoTh.style.display = timingEnabled ? "" : "none";

    detectAndEmitEvents();
    previousRaceList = raceList.map((p) => ({ ...p, lapTimes: [...(p.lapTimes || [])] }));

    // Update countdown button states
    updateCountdownUI();

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
        settings: {
            raceName: document.getElementById("setting-race-name")?.value || "",
            session: document.getElementById("setting-session")?.value || "",
            weather: document.getElementById("setting-weather")?.value || "",
            startType: document.getElementById("setting-start-type")?.value || "",
            totalLaps: document.getElementById("total-laps")?.value || "3",
        },
    });
}

// -- Race end ----------------------------------------------------------------

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
}

// -- Live chrono refresh -----------------------------------------------------

setInterval(() => {
    if (raceStatus !== "running" || !timingEnabled) return;
    const cells = document.querySelectorAll("#race-list .chrono-cell");
    raceList.forEach((pilot, index) => {
        const cell = cells[index];
        if (!cell) return;
        cell.textContent = pilot.dnf ? "DNF" : getChronoDisplay(pilot, index);
    });
}, 100);

// -- Countdown broadcast refresh ---------------------------------------------
// Re-broadcast remaining time every second while countdown is active so the
// leaderboard stays in sync even if no lap events occur.
setInterval(() => {
    if (!countdownActive) return;
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
        settings: {
            raceName: document.getElementById("setting-race-name")?.value || "",
            session: document.getElementById("setting-session")?.value || "",
            weather: document.getElementById("setting-weather")?.value || "",
            startType: document.getElementById("setting-start-type")?.value || "",
            totalLaps: document.getElementById("total-laps")?.value || "3",
        },
    });
}, 500);