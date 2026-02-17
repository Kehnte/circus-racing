// overlay.js

const STORAGE_KEYS = {
    TEAMS: "circusRacing_teams",
    RACE_LIST: "circusRacing_raceList",
    SETTINGS: "circusRacing_settings",
    TEAM_MGMT: "circusRacing_teamMgmt",
};

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

    const lapEl = document.getElementById("ov-laps");
    lapEl.textContent = settings.totalLaps ? `/ ${settings.totalLaps}` : "x";

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
                ? `L${pilot.laps}`
                : "—";

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

// Event listener for storage changes to update the overlay
window.addEventListener("storage", (e) => {
    if (Object.values(STORAGE_KEYS).includes(e.key)) updateOverlay();
});

// Initial update of the overlay on DOMContentLoaded event
document.addEventListener("DOMContentLoaded", updateOverlay);

// Periodic update of the overlay every ms
setInterval(updateOverlay, 500);
