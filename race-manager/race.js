// race.js

// Real-time server connection
const socket = io(); 

let raceList = [];
let isTeamManagementActive = true;
let raceStatus = "standby";

// Toggle team management display
function toggleTeamManagement() {
    isTeamManagementActive = !isTeamManagementActive;
    const teamSection = document.getElementById("teams-manager-section");
    const teamSep = document.getElementById("teams-separator");

    if (teamSection)
        teamSection.style.display = isTeamManagementActive ? "block" : "none";
    if (teamSep)
        teamSep.style.display = isTeamManagementActive ? "block" : "none";

    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Start race
function startRace() {
    if (raceList.length === 0) {
        alert("Please load pilots first");
        return;
    }

    const isFreshStart = raceList.every((p) => p.laps === 0);
    if (isFreshStart) {
        raceList.forEach((p) => (p.laps = 1)); // Start at lap 1
    }

    raceStatus = "running";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Pause race
function pauseRace() {
    raceStatus = "paused";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// End race manually
function endRaceManually() {
    if (confirm("End the race and lock the current standings?")) {
        raceStatus = "finished";
        updateControls();
        if (typeof saveAllToLocal === "function") saveAllToLocal();
        displayRace();
    }
}

// Reset race laps
function resetRace() {
    if (confirm("Reset laps for the current race?")) {
        raceList.forEach((p) => {
            p.laps = 0;
            p.finished = false;
            p.dnf = false;
        });
        raceStatus = "standby";
        recalculatePositions();
        updateControls();
        if (typeof saveAllToLocal === "function") saveAllToLocal();
        displayRace();
    }
}

// Reload pilots
function reloadPilots() {
    if (raceList.length > 0 && !confirm("Overwrite current race list?")) return;

    raceList = pilots.map((p, index) => ({
        ...p,
        laps: 0,
        position: index + 1,
        finished: false,
        dnf: false,
    }));

    raceStatus = "standby";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Change pilot laps
function changeLap(index, delta) {
    if (raceStatus !== "running") return;

    const pilot = raceList[index];
    const totalLaps = parseInt(document.getElementById("total-laps").value) || 3;
    let newLaps = pilot.laps + delta;

    // Minimum 1 lap
    if (newLaps >= 1 && !pilot.dnf) {
        pilot.laps = newLaps;
        pilot.finished = pilot.laps > totalLaps; // Check if finished

        recalculatePositions();
        checkRaceEnd();
        if (typeof saveAllToLocal === "function") saveAllToLocal();
        displayRace();
    }
}

// Reorder pilot
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

// Jump to position
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

// Toggle DNF
function toggleDNF(index) {
    raceList[index].dnf = !raceList[index].dnf;
    if (raceList[index].dnf) raceList[index].finished = false;

    recalculatePositions();
    checkRaceEnd();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
}

// Recalculate standings
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

// Update UI and sync server
function displayRace() {
    const tableBody = document.getElementById("race-list");
    const pilotCountEl = document.getElementById("pilot-count");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    if (pilotCountEl) pilotCountEl.textContent = raceList.length;

    raceList.forEach((pilot, index) => {
        const team = typeof teams !== "undefined" ? teams.find((t) => t.id === pilot.teamId) : null;
        const isRunning = raceStatus === "running";
        const lapDisplay = pilot.finished ? "Finished" : pilot.laps;

        const row = `
      <tr class="${pilot.dnf ? "dnf-row" : ""} ${pilot.finished ? "finished-row" : ""}">
        <td><strong>${pilot.position}</strong></td>
        <td>${pilot.name}</td>
        <td class="team-ext" style="color: ${team ? team.color : "inherit"}">
          ${team ? team.acronym : "-"}
        </td>
        <td>${lapDisplay}</td>
        <td>
          <button onclick="changeLap(${index}, -1)" ${!isRunning ? "disabled" : ""}>-</button>
          <button onclick="changeLap(${index}, 1)" ${!isRunning || pilot.finished ? "disabled" : ""}>+</button>
        </td>
        <td>
          <input type="number" value="${pilot.position}" onchange="jumpToPosition(${index}, this.value)" style="width: 40px">
        </td>
        <td>
          <button onclick="movePilot(${index}, -1)" ${index === 0 ? "disabled" : ""}>↑</button>
          <button onclick="movePilot(${index}, 1)" ${index === raceList.length - 1 ? "disabled" : ""}>↓</button>
        </td>
        <td>
          <button onclick="toggleDNF(${index})">${pilot.dnf ? "Reset" : "DNF"}</button>
        </td>
      </tr>`;
        tableBody.insertAdjacentHTML("beforeend", row);
    });

    document.querySelectorAll(".team-ext").forEach((el) => {
        el.style.display = isTeamManagementActive ? "" : "none";
    });

    // Sync data to server
    socket.emit('race-update', {
        raceList: raceList,
        teams: typeof teams !== 'undefined' ? teams : [],
        settings: {
            raceName: document.getElementById("setting-race-name")?.value || "",
            session: document.getElementById("setting-session")?.value || "",
            weather: document.getElementById("setting-weather")?.value || "",
            startType: document.getElementById("setting-start-type")?.value || "",
            totalLaps: document.getElementById("total-laps")?.value || "3"
        }
    });
}

// Check race end conditions
function checkRaceEnd() {
    const stillRacing = raceList.some((p) => !p.finished && !p.dnf);

    if (!stillRacing && raceList.length > 0 && raceStatus === "running") {
        raceStatus = "finished";
        updateControls();
    }
}

// Update control buttons
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