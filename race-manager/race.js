// race.js

const socket = io();

// Current race pilot list (ordered by position)
let raceList = [];
// Snapshot of raceList from the previous render cycle, used to detect lap/DNF changes
let previousRaceList = [];
// Whether team management features (columns, dropdowns) are visible
let isTeamManagementActive = true;
// Race lifecycle state: "standby" | "running" | "paused" | "finished"
let raceStatus = "standby";

// Toggle team management on/off, show/hide related UI sections and re-render
function toggleTeamManagement() {
    isTeamManagementActive = !isTeamManagementActive;
    const teamSection = document.getElementById("teams-manager-section");
    const teamSep = document.getElementById("teams-separator");

    if (teamSection) teamSection.style.display = isTeamManagementActive ? "block" : "none";
    if (teamSep) teamSep.style.display = isTeamManagementActive ? "block" : "none";

    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Start or resume the race; initialises laps to 1 on a fresh start
function startRace() {
    if (raceList.length === 0) {
        alert("Please load pilots first");
        return;
    }

    // If every pilot is still on lap 0, it's a fresh start — bump everyone to lap 1
    const isFreshStart = raceList.every((p) => p.laps === 0);
    if (isFreshStart) {
        raceList.forEach((p) => (p.laps = 1));
    }

    raceStatus = "running";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Pause the race (can be resumed with startRace)
function pauseRace() {
    raceStatus = "paused";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Force-end the race regardless of how many pilots have finished
function endRaceManually() {
    raceStatus = "finished";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Reset all pilot lap counts, clear DNF/finished flags and return to standby
function resetRace() {
    raceList.forEach((p) => {
        p.laps = 0;
        p.finished = false;
        p.dnf = false;
    });
    previousRaceList = [];
    raceStatus = "standby";
    recalculatePositions();
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Rebuild raceList from the pilots database with blank race state
function reloadPilots() {
    raceList = pilots.map((p, index) => ({
        ...p,
        laps: 0,
        position: index + 1,
        finished: false,
        dnf: false,
    }));

    previousRaceList = [];
    raceStatus = "standby";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Increment or decrement the lap count for a pilot by delta (+1/-1). Also marks a pilot as finished when their lap count exceeds totalLaps
function changeLap(index, delta) {
    if (raceStatus !== "running") return;

    const pilot = raceList[index];
    const totalLaps = parseInt(document.getElementById("total-laps").value) || 3;
    let newLaps = pilot.laps + delta;

    if (newLaps >= 1 && !pilot.dnf) {
        pilot.laps = newLaps;
        pilot.finished = pilot.laps > totalLaps;

        recalculatePositions();
        checkRaceEnd();
        if (typeof saveAllToLocal === "function") saveAllToLocal();
        displayRace();
    }
}

// Swap a pilot one step up or down in the raceList array
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

// Move a pilot directly to a specific 1-based position entered in the inline input
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

// Toggle the DNF flag for a pilot; removing DNF also clears the finished flag
function toggleDNF(index) {
    raceList[index].dnf = !raceList[index].dnf;
    if (raceList[index].dnf) raceList[index].finished = false;

    recalculatePositions();
    checkRaceEnd();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Sort raceList by race order (DNF last, finished first, then by lap count) and reassign sequential position numbers
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

// Compare current raceList against the previous snapshot to detect DNF and finish events, then emit them to the server via Socket.IO
function detectAndEmitEvents() {
    if (previousRaceList.length === 0) return;

    raceList.forEach((pilot) => {
        const previous = previousRaceList.find((p) => p.id === pilot.id);
        if (!previous) return;

        const team = typeof teams !== "undefined" ? teams.find((t) => t.id === pilot.teamId) : null;
        const ship = typeof ships !== "undefined" ? ships.find((s) => s.id === pilot.shipId) : null;

        const durationInput = document.getElementById("event-duration");
        const displayDuration = durationInput ? parseInt(durationInput.value) || 5 : 5;

        // Base payload shared by all event types
        const eventPayload = {
            pilotId: pilot.id,
            pilotName: pilot.name,
            pilotCountry: pilot.country || "un",
            teamName: team ? team.name : null,
            teamColor: team ? team.color : null,
            shipModel: ship ? ship.model : null,
            displayDuration: displayDuration,
        };

        // Emit an incident event when a pilot is newly marked DNF
        if (!previous.dnf && pilot.dnf) {
            socket.emit("race-event", { ...eventPayload, type: "incident" });
        }

        // Emit a finished event when a pilot crosses the finish line
        if (!previous.finished && pilot.finished) {
            socket.emit("race-event", { ...eventPayload, type: "finished" });
        }
    });
}

// Render the race table, emit the current race state to all connected clients and update the previousRaceList snapshot for event detection
function displayRace() {
    const tableBody = document.getElementById("race-list");
    const pilotCountEl = document.getElementById("pilot-count");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    if (pilotCountEl) pilotCountEl.textContent = raceList.length;

    const isRunning = raceStatus === "running";

    raceList.forEach((pilot, index) => {
        const team = typeof teams !== "undefined" ? teams.find((t) => t.id === pilot.teamId) : null;

        // Show "Finished" label instead of lap count for completed pilots
        const lapDisplay = pilot.finished
            ? `<span class="lap-display finished">Finished</span>`
            : `<span class="lap-display">${pilot.laps}</span>`;

        const posBadgeClass = index === 0 ? "position-badge pos-first" : "position-badge";
        const teamColor = team ? team.color : "inherit";
        const teamAcronym = team ? team.acronym : "-";

        const row = `
        <tr class="${pilot.dnf ? "dnf-row" : ""} ${pilot.finished ? "finished-row" : ""}">
            <td><span class="${posBadgeClass}">${pilot.position}</span></td>
            <td>${pilot.name}</td>
            <td style="color: ${teamColor}; display: ${isTeamManagementActive ? "" : "none"}">
                ${teamAcronym}
            </td>
            <td>${lapDisplay}</td>
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

    // Show/hide all team-related columns across the page
    document.querySelectorAll(".team-ext").forEach((el) => {
        el.style.display = isTeamManagementActive ? "" : "none";
    });

    detectAndEmitEvents();
    // Save a deep copy of raceList as the baseline for the next event detection pass
    previousRaceList = raceList.map((p) => ({ ...p }));

    // Broadcast the full race state to the leaderboard and other overlays
    socket.emit("race-update", {
        raceList: raceList,
        teams: typeof teams !== "undefined" ? teams : [],
        settings: {
            raceName: document.getElementById("setting-race-name")?.value || "",
            session: document.getElementById("setting-session")?.value || "",
            weather: document.getElementById("setting-weather")?.value || "",
            startType: document.getElementById("setting-start-type")?.value || "",
            totalLaps: document.getElementById("total-laps")?.value || "3",
        },
    });
}

// Automatically end the race when every non-DNF pilot has finished
function checkRaceEnd() {
    const stillRacing = raceList.some((p) => !p.finished && !p.dnf);

    if (!stillRacing && raceList.length > 0 && raceStatus === "running") {
        raceStatus = "finished";
        updateControls();
    }
}

// Enable/disable the Start, Pause and Finish buttons to match the current race status
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
        // standby or finished
        btnStart.disabled = false;
        btnPause.disabled = true;
        btnFinish.disabled = true;
    }
}