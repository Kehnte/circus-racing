// overlay.js

const STORAGE_KEYS = {
    TEAMS: "circusRacing_teams",
    SHIPS: "circusRacing_ships",
    RACE_LIST: "circusRacing_raceList",
    SETTINGS: "circusRacing_settings",
    TEAM_MGMT: "circusRacing_teamMgmt",
};

let lastDnfId = null;
let dnfTimeout = null;

// Read JSON data from localStorage with a fallback
function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

// Update the overlay content based on stored data
function updateOverlay() {
    const raceList = readJSON(STORAGE_KEYS.RACE_LIST, []);
    const teams = readJSON(STORAGE_KEYS.TEAMS, []);
    const ships = readJSON(STORAGE_KEYS.SHIPS, []);
    const settings = readJSON(STORAGE_KEYS.SETTINGS, {});
    const showTeams = localStorage.getItem(STORAGE_KEYS.TEAM_MGMT) !== "false";

    document.getElementById("ov-race-name").textContent =
        settings.raceName || "Race name";
    document.getElementById("ov-location").textContent =
        settings.location || "Location";
    document.getElementById("ov-session").textContent =
        settings.session || "Session";
    document.getElementById("ov-tod").textContent =
        settings.tod || "Time of day";
    document.getElementById("ov-start-type").textContent =
        settings.startType || "Start type";

    const totalLaps = parseInt(settings.totalLaps) || 0;
    let leaderLaps = raceList.length > 0 ? raceList[0].laps : 0;

    if (totalLaps > 0) {
        leaderLaps = Math.min(leaderLaps, totalLaps);
    }

    const lapEl = document.getElementById("ov-laps");
    if (lapEl) {
        lapEl.textContent = `${leaderLaps} / ${totalLaps || "x"}`;
    }

    const currentDnfPilot = raceList.find((p) => p.dnf === true);
    if (currentDnfPilot && currentDnfPilot.id !== lastDnfId) {
        triggerDnfAlert(currentDnfPilot, ships);
        lastDnfId = currentDnfPilot.id;
    } else if (!currentDnfPilot) {
        lastDnfId = null;
    }

    const body = document.getElementById("overlay-body");
    if (!body) return;
    body.innerHTML = "";

    raceList.forEach((pilot, idx) => {
        const team = teams.find((t) => t.id === pilot.teamId);
        const isDnf = pilot.dnf;
        const isDone = pilot.finished;

        const lapText = isDnf
            ? "DNF"
            : isDone
              ? "END"
              : pilot.laps != null
                ? `${pilot.laps}`
                : "0";

        const rowClass = isDnf
            ? "row-dnf"
            : isDone
              ? "row-done"
              : idx === 0
                ? "row-lead"
                : "";

        const teamCell = showTeams
            ? `<td class="col-team" style="--team-color: ${
                  team ? team.color : "#ffffff"
              }">
           <span class="team-bar"></span>
           <span class="team-acro">${team ? team.acronym : "—"}</span>
         </td>`
            : "";

        const row = `
      <tr class="standing-row ${rowClass}" style="--row-index: ${idx}">
        <td class="col-pos">${pilot.position}</td>
        ${teamCell}
        <td class="col-name">${pilot.name}</td>
        <td class="col-lap ${
            isDnf ? "laps-dnf" : isDone ? "laps-done" : ""
        }">${lapText}</td>
      </tr>`;

        body.insertAdjacentHTML("beforeend", row);
    });
}

// Triggers the DNF alert panel
function triggerDnfAlert(pilot, ships) {
    const alertZone = document.getElementById("dnf-panel");
    const nameEl = document.getElementById("dnf-pilot");
    const shipEl = document.getElementById("dnf-ship");
    const imgEl = document.getElementById("dnf-ship-img");

    if (!alertZone) return;

    if (dnfTimeout) {
        clearTimeout(dnfTimeout);
    }

    const ship = ships.find((s) => s.id === pilot.shipId);

    nameEl.textContent = pilot.name;
    shipEl.textContent = ship ? `${ship.brand} ${ship.model}` : "Unknown Ship";
    imgEl.src = ship ? ship.img : "";

    alertZone.style.display = "block";

    dnfTimeout = setTimeout(() => {
        alertZone.style.display = "none";
        dnfTimeout = null;
    }, 5000);
}

// Event listener for storage changes to update the overlay
window.addEventListener("storage", (e) => {
    if (Object.values(STORAGE_KEYS).includes(e.key)) {
        updateOverlay();
    }
});

// Periodic update as a fallback
setInterval(updateOverlay, 500);

// Initial call
document.addEventListener("DOMContentLoaded", updateOverlay);
