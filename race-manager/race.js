// race.js

let raceList = [];
let isTeamManagementActive = true;
let raceStatus = "standby";

// Toggles the visibility of the team management section and updates the local storage
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

// Starts the race if there are pilots loaded
function startRace() {
  if (raceList.length === 0) {
    alert("Please load pilots first");
    return;
  }
  raceStatus = "running";
  updateControls();
  if (typeof saveAllToLocal === "function") saveAllToLocal();
  displayRace();
}

// Pauses the race
function pauseRace() {
  raceStatus = "paused";
  updateControls();
  if (typeof saveAllToLocal === "function") saveAllToLocal();
  displayRace();
}

// Ends the race manually and locks the current standings
function endRaceManually() {
  if (confirm("End the race and lock the current standings?")) {
    raceStatus = "finished";
    updateControls();
    if (typeof saveAllToLocal === "function") saveAllToLocal();
    displayRace();
  }
}

// Resets the laps for the current race
function resetRace() {
  if (confirm("Reset laps for the current race?")) {
    raceList.forEach((p) => {
      p.laps = 1;
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

// Reloads the pilots into the race list
function reloadPilots() {
  if (raceList.length > 0 && !confirm("Overwrite current race list?")) return;

  raceList = pilots.map((p, index) => ({
    ...p,
    laps: 1,
    position: index + 1,
    finished: false,
    dnf: false,
  }));

  raceStatus = "standby";
  updateControls();
  if (typeof saveAllToLocal === "function") saveAllToLocal();
  displayRace();
}

// Changes the lap count for a pilot
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

// Moves a pilot up or down in the race list
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

// Jumps a pilot to a new position in the race list
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

// Toggles the DNF status for a pilot
function toggleDNF(index) {
  raceList[index].dnf = !raceList[index].dnf;
  if (raceList[index].dnf) raceList[index].finished = false;

  recalculatePositions();
  checkRaceEnd();
  if (typeof saveAllToLocal === "function") saveAllToLocal();
  displayRace();
}

// Recalculates the positions of all pilots based on their lap counts and DNF status
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

// Displays the current state of the race in the UI
function displayRace() {
  const tableBody = document.getElementById("race-list");
  const pilotCountEl = document.getElementById("pilot-count");
  if (!tableBody) return;

  // Clear existing rows from the table body
  tableBody.innerHTML = "";

  // Update the pilot count element with the current number of pilots
  if (pilotCountEl) pilotCountEl.textContent = raceList.length;

  // Iterate over each pilot in the race list and create a row for them
  raceList.forEach((pilot, index) => {
    const team =
      typeof teams !== "undefined"
        ? teams.find((t) => t.id === pilot.teamId)
        : null;
    const isRunning = raceStatus === "running";

    // Determine the display value for laps (Finished if finished, otherwise current lap count)
    const lapDisplay = pilot.finished ? "Finished" : pilot.laps;

    // Create an HTML row for the pilot
    const row = `
      <tr class="${pilot.dnf ? "dnf-row" : ""} ${
        pilot.finished ? "finished-row" : ""
      }">
        <td><strong>${pilot.position}</strong></td>
        <td>${pilot.name}</td>
        <td class="team-ext" style="color: ${team ? team.color : "inherit"}">
          ${team ? team.acronym : "-"}
        </td>
        <td>${lapDisplay}</td>
        <td>
          <button onclick="changeLap(${index}, -1)" ${
            !isRunning ? "disabled" : ""
          }>-</button>
          <button onclick="changeLap(${index}, 1)" ${
            !isRunning || pilot.finished ? "disabled" : ""
          }>+</button>
        </td>
        <td>
          <input type="number" value="${pilot.position}" 
            onchange="jumpToPosition(${index}, this.value)" style="width: 40px">
        </td>
        <td>
          <button onclick="movePilot(${index}, -1)" ${
            index === 0 ? "disabled" : ""
          }>↑</button>
          <button onclick="movePilot(${index}, 1)" ${
            index === raceList.length - 1 ? "disabled" : ""
          }>↓</button>
        </td>
        <td>
          <button onclick="toggleDNF(${index})">${
            pilot.dnf ? "Reset" : "DNF"
          }</button>
        </td>
      </tr>`;
    // Insert the row into the table body
    tableBody.insertAdjacentHTML("beforeend", row);
  });

  // Toggle the visibility of team extensions based on whether team management is active
  document.querySelectorAll(".team-ext").forEach((el) => {
    el.style.display = isTeamManagementActive ? "" : "none";
  });
}

// Checks if the race has ended and updates the status accordingly
function checkRaceEnd() {
  const activePilots = raceList.filter((p) => !p.dnf);
  const allFinished =
    activePilots.length > 0 && activePilots.every((p) => p.finished);

  if (allFinished && raceStatus === "running") {
    raceStatus = "finished";
    updateControls();
  }
}

// Updates the controls based on the current race status
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
