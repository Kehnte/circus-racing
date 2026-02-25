// leaderboard.js

const socket = io(); // Connect to the Node.js server

const ICONS = {
    fastest: `<svg ... > ... </svg>`, // Keep your existing SVG icons
    finished: `<svg ... > ... </svg>`,
};

// This function now receives data directly from the socket
function updateLeaderboard(data) {
    const raceList = data.raceList || [];
    const teams = data.teams || [];
    const settings = data.settings || {};

    // Update Header info
    document.getElementById("lb-location").textContent = settings.raceName || "UNKNOWN RACE";
    document.getElementById("lb-session").textContent = settings.session || "Session";
    document.getElementById("lb-start-type").textContent = settings.startType || "Start Type";

    // Update Weather
    const weatherKey = settings.weather || "Clear";
    const weatherIconContainer = document.getElementById("lb-weather-icon");
    if (weatherIconContainer && typeof WEATHER_ICONS !== 'undefined' && WEATHER_ICONS[weatherKey]) {
        weatherIconContainer.innerHTML = WEATHER_ICONS[weatherKey];
    }

    // Update Lap counter
    const totalLaps = parseInt(settings.totalLaps) || 0;
    let leaderLaps = raceList.length > 0 ? raceList[0].laps : 0;
    if (totalLaps > 0) {
        leaderLaps = Math.min(leaderLaps, totalLaps);
    }

    document.getElementById("lb-lap-current").textContent = leaderLaps;
    document.getElementById("lb-lap-total").textContent = `/${totalLaps || "0"}`;

    const container = document.getElementById("lb-pilots-container");
    if (!container) return;
    container.innerHTML = "";

    // Render pilot rows
    raceList.forEach((pilot, index) => {
        const team = teams.find((t) => t.id === pilot.teamId);
        const teamColor = team ? team.color : "#ffffff";
        const rankClass = index === 0 ? "rank-first" : "";
        const dnfClass = pilot.dnf ? "dnf-row" : "";

        let rightCell = `<div class="empty-cell"></div>`;
        if (pilot.finished) {
            rightCell = `<div class="grid-cell icon-cell status-finished">${ICONS.finished}</div>`;
        }

        const safeCountry = pilot.country ? pilot.country.toLowerCase() : "un";
        const flagHTML = `<span class="fi fi-${safeCountry} fis"></span>`;
        const chronoDisplay = pilot.dnf ? "DNF" : "00:00.000";
        const displayLaps = (totalLaps > 0) ? Math.min(pilot.laps, totalLaps) : pilot.laps;

        const pilotRow = `
            <div class="empty-cell"></div>
            <div class="pilot-row ${dnfClass}">
                <div class="pilot-rank ${rankClass}">${pilot.position}</div>
                <div class="team-color" style="background-color: ${teamColor}"></div>
                <div class="pilot-infos">
                    <div class="pilot-country">${flagHTML}</div>
                    <div class="pilot-name">${pilot.name}</div>
                </div>
                <div class="pilot-laps">${displayLaps}</div>
                <div class="pilot-chrono">${chronoDisplay}</div>
            </div>
            ${rightCell}
        `;

        container.insertAdjacentHTML("beforeend", pilotRow);
    });
}

// Listen for real-time updates from the server
socket.on('race-data', (data) => {
    updateLeaderboard(data);
});