// leaderboard.js

const socket = io();

function updateLeaderboard(data) {
    const raceList = data.raceList || [];
    const teams = data.teams || [];
    const settings = data.settings || {};
    const teamDisplayMode = data.teamDisplayMode || "color-bar";
    const timingEnabled = data.timingEnabled !== false;
    const chronoDisplayMode = data.chronoDisplayMode || "leader";

    // Update header info
    document.getElementById("lb-location").textContent = settings.raceName || "UNKNOWN RACE";
    document.getElementById("lb-session").textContent = settings.session || "Session";
    document.getElementById("lb-start-type").textContent = settings.startType || "Start Type";

    // Weather icon
    const weatherKey = settings.weather || "Clear";
    const weatherIconContainer = document.getElementById("lb-weather-icon");
    if (weatherIconContainer && typeof WEATHER_ICONS !== "undefined" && WEATHER_ICONS[weatherKey]) {
        weatherIconContainer.innerHTML = WEATHER_ICONS[weatherKey];
    }

    // Lap counter
    const totalLaps = parseInt(settings.totalLaps) || 0;
    let leaderLaps = raceList.length > 0 ? raceList[0].laps : 0;
    if (totalLaps > 0) leaderLaps = Math.min(leaderLaps, totalLaps);
    document.getElementById("lb-lap-current").textContent = leaderLaps;
    document.getElementById("lb-lap-total").textContent = `/${totalLaps || "0"}`;

    const container = document.getElementById("lb-pilots-container");
    if (!container) return;
    container.innerHTML = "";

    raceList.forEach((pilot, index) => {
        const team = teams.find((t) => t.id === pilot.teamId);
        const teamColor = team ? team.color : "#ffffff";
        const teamAcronym = team ? team.acronym : "";
        const rankClass = index === 0 ? "rank-first" : "";
        const dnfClass = pilot.dnf ? "dnf-row" : "";

        let rightCell = `<div class="empty-cell"></div>`;
        if (pilot.finished) {
            rightCell = `<div class="grid-cell icon-cell status-finished">${RACE_ICONS.finished}</div>`;
        }

        const safeCountry = pilot.country ? pilot.country.toLowerCase() : "un";
        const flagHTML = `<span class="fi fi-${safeCountry} fis"></span>`;
        const displayLaps = totalLaps > 0 ? Math.min(pilot.laps, totalLaps) : pilot.laps;

        // Team cell
        let teamCell = "";
        if (teamDisplayMode === "color-bar") {
            teamCell = `<div class="team-color" style="background-color: ${teamColor}"></div>`;
        } else if (teamDisplayMode === "acronym") {
            teamCell = `<div class="team-acronym" style="color: ${teamColor}">${teamAcronym}</div>`;
        }

        // Chrono cell — always rendered, shows — when timing disabled or no data
        let chronoContent = "—";
        let chronoDnfClass = "";
        if (timingEnabled) {
            if (pilot.dnf) {
                chronoContent = "DNF";
                chronoDnfClass = " chrono-dnf";
            } else if (index === 0 && chronoDisplayMode === "leader") {
                chronoContent = "LEADER";
            } else {
                chronoContent = pilot.chronoDisplay || "—";
            }
        }
        const chronoCell = `<div class="pilot-chrono${chronoDnfClass}">${chronoContent}</div>`;

        const pilotRow = `
            <div class="empty-cell"></div>
            <div class="pilot-row ${dnfClass} team-mode-${teamDisplayMode}">
                <div class="pilot-rank ${rankClass}">${pilot.position}</div>
                ${teamCell}
                <div class="pilot-infos">
                    <div class="pilot-country">${flagHTML}</div>
                    <div class="pilot-name">${pilot.name}</div>
                </div>
                <div class="pilot-laps">${displayLaps}</div>
                ${chronoCell}
            </div>
            ${rightCell}
        `;

        container.insertAdjacentHTML("beforeend", pilotRow);
    });
}

socket.on("race-data", (data) => {
    updateLeaderboard(data);
});