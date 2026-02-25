// leaderboard.js

const STORAGE_KEYS = {
    TEAMS: "circusRacing_teams",
    RACE_LIST: "circusRacing_raceList",
    SETTINGS: "circusRacing_settings",
};

const ICONS = {
    fastest: `
        <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 40C30.9413 40 40 30.9217 40 20C40 9.05884 30.9608 0 20.0196 0C18.9805 0 18.4707 0.627452 18.4707 1.64706V9.23531C18.4707 10.0981 19.0588 10.7647 19.9019 10.7647C20.7648 10.7647 21.353 10.0981 21.353 9.23531V1.60785L19.9804 3.33334C29.2746 3.33334 36.6471 10.7451 36.6471 20C36.6471 29.255 29.255 36.6668 20 36.6668C10.7451 36.6668 3.31373 29.255 3.33334 20C3.35295 15.8628 4.82353 12.1177 7.29414 9.23531C7.88237 8.4706 7.92159 7.54904 7.27453 6.86275C6.62747 6.17649 5.54904 6.2353 4.82354 7.09806C1.84314 10.5882 0 15.1177 0 20C0 30.9217 9.07845 40 20 40Z" fill="white"/>
            <path d="M23.1375 22.8238C24.6866 21.1965 24.3728 19.02 22.5101 17.7259L12.1375 10.4709C11.1571 9.78465 10.1375 10.8239 10.8238 11.7847L18.0592 22.1572C19.3728 24.02 21.5493 24.3533 23.1375 22.8238Z" fill="white"/>
        </svg>`,
    finished: `
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="7.5" height="7.5" fill="white" /><rect x="7.5" y="7.5" width="7.5" height="7.5" fill="white" /><rect x="15" width="7.5" height="7.5" fill="white" /><rect x="22.5" y="7.5" width="7.5" height="7.5" fill="white" /><rect y="15" width="7.5" height="7.5" fill="white" /><rect x="7.5" y="22.5" width="7.5" height="7.5" fill="white" /><rect x="15" y="15" width="7.5" height="7.5" fill="white" /><rect x="22.5" y="22.5" width="7.5" height="7.5" fill="white" /><rect x="7.5" width="7.5" height="7.5" fill="black" /><rect y="7.5" width="7.5" height="7.5" fill="black" /><rect x="22.5" width="7.5" height="7.5" fill="black" /><rect x="15" y="7.5" width="7.5" height="7.5" fill="black" /><rect x="7.5" y="15" width="7.5" height="7.5" fill="black" /><rect y="22.5" width="7.5" height="7.5" fill="black" /><rect x="22.5" y="15" width="7.5" height="7.5" fill="black" /><rect x="15" y="22.5" width="7.5" height="7.5" fill="black" />
        </svg>`,
};

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function updateLeaderboard() {
    const raceList = readJSON(STORAGE_KEYS.RACE_LIST, []);
    const teams = readJSON(STORAGE_KEYS.TEAMS, []);
    const settings = readJSON(STORAGE_KEYS.SETTINGS, {});

    // Correction ici : on utilise raceName au lieu de location
    document.getElementById("lb-location").textContent =
        settings.raceName || "UNKNOWN RACE";
    document.getElementById("lb-session").textContent =
        settings.session || "Session";
    document.getElementById("lb-start-type").textContent =
        settings.startType || "Start Type";

    const totalLaps = parseInt(settings.totalLaps) || 0;
    let leaderLaps = raceList.length > 0 ? raceList[0].laps : 0;
    if (totalLaps > 0) {
        leaderLaps = Math.min(leaderLaps, totalLaps);
    }

    document.getElementById("lb-lap-current").textContent = leaderLaps;
    document.getElementById("lb-lap-total").textContent =
        `/${totalLaps || "0"}`;

    const container = document.getElementById("lb-pilots-container");
    if (!container) return;
    container.innerHTML = "";

    raceList.forEach((pilot, index) => {
        const team = teams.find((t) => t.id === pilot.teamId);
        const teamColor = team ? team.color : "#ffffff";
        const rankClass = index === 0 ? "rank-first" : "";

        let leftCell = `<div class="empty-cell"></div>`;
        let rightCell = `<div class="empty-cell"></div>`;

        if (pilot.finished) {
            rightCell = `<div class="grid-cell icon-cell status-finished">${ICONS.finished}</div>`;
        }

        const flagHTML = `<span class="fi fi-un fis"></span>`;

        // Correction ici : DNF remplace le chrono, et on affiche bien le nombre de tours effectués
        const chronoDisplay = pilot.dnf ? "DNF" : "00:00.000";

        const pilotRow = `
            <div class="pilot-row">
                <div class="pilot-rank ${rankClass}">${pilot.position}</div>
                <div class="team-color" style="background-color: ${teamColor}"></div>
                <div class="pilot-infos">
                    <div class="pilot-country">${flagHTML}</div>
                    <div class="pilot-name">${pilot.name}</div>
                </div>
                <div class="pilot-laps">${pilot.laps}</div>
                <div class="pilot-chrono">${chronoDisplay}</div>
            </div>
        `;

        container.insertAdjacentHTML(
            "beforeend",
            leftCell + pilotRow + rightCell,
        );
    });
}

window.addEventListener("storage", (e) => {
    if (Object.values(STORAGE_KEYS).includes(e.key)) {
        updateLeaderboard();
    }
});

setInterval(updateLeaderboard, 500);
document.addEventListener("DOMContentLoaded", updateLeaderboard);
