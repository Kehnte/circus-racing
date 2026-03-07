// leaderboard.js

const socket = io();

// Persistent DOM elements per pilot, keyed by pilotId
const pilotElements = new Map();

function updateLeaderboard(data) {
    const raceList = data.raceList || [];
    const teams = data.teams || [];
    const settings = data.settings || {};
    const teamDisplayMode = data.teamDisplayMode || "color-bar";
    const timingEnabled = data.timingEnabled !== false;
    const chronoDisplayMode = data.chronoDisplayMode || "leader";

    document.getElementById("lb-location").textContent = settings.raceName || "UNKNOWN RACE";
    document.getElementById("lb-session").textContent = settings.session || "Session";
    document.getElementById("lb-start-type").textContent = settings.startType || "Start Type";

    const weatherKey = settings.weather || "Clear";
    const weatherIconContainer = document.getElementById("lb-weather-icon");
    if (weatherIconContainer && typeof WEATHER_ICONS !== "undefined" && WEATHER_ICONS[weatherKey]) {
        weatherIconContainer.innerHTML = WEATHER_ICONS[weatherKey];
    }

    const totalLaps = parseInt(settings.totalLaps) || 0;
    let leaderLaps = raceList.length > 0 ? raceList[0].laps : 0;
    if (totalLaps > 0) leaderLaps = Math.min(leaderLaps, totalLaps);
    document.getElementById("lb-lap-current").textContent = leaderLaps;
    document.getElementById("lb-lap-total").textContent = `/${totalLaps || "0"}`;

    const container = document.getElementById("lb-pilots-container");
    if (!container) return;

    // FLIP step 1: snapshot Y positions before any DOM changes
    const snapshots = new Map();
    pilotElements.forEach((els, pilotId) => {
        if (els.rowEl && els.rowEl.isConnected) {
            snapshots.set(pilotId, els.rowEl.getBoundingClientRect().top);
        }
    });

    raceList.forEach((pilot, index) => {
        const team = teams.find((t) => t.id === pilot.teamId);
        const teamColor = team ? team.color : "#ffffff";
        const teamAcronym = team ? team.acronym : "";
        const rankClass = index === 0 ? "rank-first" : "";
        const dnfClass = pilot.dnf ? "dnf-row" : "";
        const safeCountry = pilot.country ? pilot.country.toLowerCase() : "un";
        const flagHTML = `<span class="fi fi-${safeCountry} fis"></span>`;
        const displayLaps = totalLaps > 0 ? Math.min(pilot.laps, totalLaps) : pilot.laps;

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

        if (!pilotElements.has(pilot.id)) {
            // First render: create the three grid cells
            const leftEl = document.createElement("div");
            leftEl.className = "empty-cell";

            const rowEl = document.createElement("div");
            rowEl.className = `pilot-row ${dnfClass} team-mode-${teamDisplayMode}`;
            rowEl.dataset.pilotId = pilot.id;

            const rightEl = document.createElement("div");

            let teamCellHTML = "";
            if (teamDisplayMode === "color-bar") {
                teamCellHTML = `<div class="team-color" style="background-color: ${teamColor}"></div>`;
            } else if (teamDisplayMode === "acronym") {
                teamCellHTML = `<div class="team-acronym" style="color: ${teamColor}">${teamAcronym}</div>`;
            }

            rowEl.innerHTML = `
                <div class="pilot-rank ${rankClass}">${pilot.position}</div>
                ${teamCellHTML}
                <div class="pilot-infos">
                    <div class="pilot-country">${flagHTML}</div>
                    <div class="pilot-name">${pilot.name}</div>
                </div>
                <div class="pilot-laps">${displayLaps}</div>
                <div class="pilot-chrono${chronoDnfClass}">${chronoContent}</div>
            `;

            if (pilot.finished) {
                rightEl.className = "grid-cell icon-cell status-finished";
                rightEl.innerHTML = RACE_ICONS.finished;
            } else {
                rightEl.className = "empty-cell";
            }

            container.appendChild(leftEl);
            container.appendChild(rowEl);
            container.appendChild(rightEl);

            pilotElements.set(pilot.id, { leftEl, rowEl, rightEl });

        } else {
            // Update content in place
            const { rowEl, rightEl } = pilotElements.get(pilot.id);

            rowEl.className = `pilot-row ${dnfClass} team-mode-${teamDisplayMode}`;

            const rankEl = rowEl.querySelector(".pilot-rank");
            rankEl.className = `pilot-rank ${rankClass}`;
            rankEl.textContent = pilot.position;

            const existingColorBar = rowEl.querySelector(".team-color");
            const existingAcronym = rowEl.querySelector(".team-acronym");
            if (teamDisplayMode === "color-bar") {
                if (existingColorBar) {
                    existingColorBar.style.backgroundColor = teamColor;
                } else {
                    if (existingAcronym) existingAcronym.remove();
                    const tc = document.createElement("div");
                    tc.className = "team-color";
                    tc.style.backgroundColor = teamColor;
                    rankEl.insertAdjacentElement("afterend", tc);
                }
            } else if (teamDisplayMode === "acronym") {
                if (existingAcronym) {
                    existingAcronym.style.color = teamColor;
                    existingAcronym.textContent = teamAcronym;
                } else {
                    if (existingColorBar) existingColorBar.remove();
                    const ta = document.createElement("div");
                    ta.className = "team-acronym";
                    ta.style.color = teamColor;
                    ta.textContent = teamAcronym;
                    rankEl.insertAdjacentElement("afterend", ta);
                }
            } else {
                if (existingColorBar) existingColorBar.remove();
                if (existingAcronym) existingAcronym.remove();
            }

            rowEl.querySelector(".pilot-country").innerHTML = flagHTML;
            rowEl.querySelector(".pilot-name").textContent = pilot.name;
            rowEl.querySelector(".pilot-laps").textContent = displayLaps;

            const chronoEl = rowEl.querySelector(".pilot-chrono");
            chronoEl.className = `pilot-chrono${chronoDnfClass}`;
            chronoEl.textContent = chronoContent;

            if (pilot.finished) {
                rightEl.className = "grid-cell icon-cell status-finished";
                rightEl.innerHTML = RACE_ICONS.finished;
            } else {
                rightEl.className = "empty-cell";
                rightEl.innerHTML = "";
            }
        }
    });

    // Reorder DOM to match new raceList order
    raceList.forEach((pilot) => {
        const els = pilotElements.get(pilot.id);
        if (!els) return;
        container.appendChild(els.leftEl);
        container.appendChild(els.rowEl);
        container.appendChild(els.rightEl);
    });

    // FLIP step 2: measure new positions, apply inverse offset, animate to 0
    const toAnimate = [];
    pilotElements.forEach((els, pilotId) => {
        if (!snapshots.has(pilotId)) return;
        const delta = snapshots.get(pilotId) - els.rowEl.getBoundingClientRect().top;
        if (Math.abs(delta) < 1) return;
        toAnimate.push({ el: els.rowEl, delta });
    });

    if (toAnimate.length > 0 && typeof anime !== "undefined") {
        toAnimate.forEach(({ el, delta }) => { el.style.transform = `translateY(${delta}px)`; });
        toAnimate.forEach(({ el }) => el.getBoundingClientRect()); // force reflow
        anime({
            targets: toAnimate.map(({ el }) => el),
            translateY: 0,
            duration: 400,
            easing: "easeOutQuart",
        });
    }
}

socket.on("race-data", (data) => {
    updateLeaderboard(data);
});