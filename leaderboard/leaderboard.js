// leaderboard.js

const socket = io();

// Persistent DOM elements per pilot, keyed by pilotId
const pilotElements = new Map();

// Last received data snapshot, used to re-evaluate state after the reset lock expires
let lastKnownData = null;


// Show the slide wrapper with an entrance animation
function showWrapper(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("visible");
    requestAnimationFrame(() => el.classList.add("open"));
}

// Hide the slide wrapper and remove it from grid flow after the transition ends
function hideWrapper(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("open");
    el.addEventListener("transitionend", () => {
        if (!el.classList.contains("open")) el.classList.remove("visible");
    }, { once: true });
}


// Heights in px for each state driving the animated inner container
const RSB_HEIGHTS = { countdown: 80, lap: 50, paused: 50 };

// Set the height of the inner container to animate between states
function setRaceStatusHeight(state) {
    const inner = document.getElementById("race-status-inner");
    if (inner) inner.style.height = RSB_HEIGHTS[state] + "px";
}

// Switch which race-status-block is visible (no wipe, instant)
function setRaceStatusBlock(id) {
    ["rsb-countdown", "rsb-lap"].forEach((blockId) => {
        const el = document.getElementById(blockId);
        if (el) el.classList.toggle("active", blockId === id);
    });
}


let rsbWipeActive = false;

// Slide the amber overlay in from the left (lap → paused)
function wipeInPaused() {
    if (rsbWipeActive) return;
    rsbWipeActive = true;
    const wipe = document.getElementById("rsb-lap-wipe");
    if (!wipe) return;
    // Reset to left side without transition before animating in
    wipe.style.transition = "none";
    wipe.classList.remove("wipe-in", "wipe-out");
    requestAnimationFrame(() => {
        wipe.style.transition = "";
        wipe.classList.add("wipe-in");
    });
}

// Slide the amber overlay out to the right, optionally without transition
function wipeOutPaused(instant = false) {
    if (!rsbWipeActive) return;
    rsbWipeActive = false;
    const wipe = document.getElementById("rsb-lap-wipe");
    if (!wipe) return;
    if (instant) {
        wipe.style.transition = "none";
        wipe.classList.remove("wipe-in", "wipe-out");
        requestAnimationFrame(() => { wipe.style.transition = ""; });
    } else {
        wipe.classList.remove("wipe-in");
        wipe.classList.add("wipe-out");
    }
}


let rsbResetTimer = null;
// While true, incoming race-update status changes are ignored
let rsbResetLocked = false;

// Slide the red overlay in, lock status updates, auto-dismiss after 3s
function wipeInReset() {
    clearTimeout(rsbResetTimer);
    rsbResetLocked = true;
    wipeOutPaused(true);
    setRaceStatusBlock("rsb-lap");
    setRaceStatusHeight("lap");
    showWrapper("race-status-wrapper");
    const wipe = document.getElementById("rsb-lap-wipe-reset");
    if (!wipe) return;
    wipe.style.transition = "none";
    wipe.classList.remove("wipe-in", "wipe-out");
    requestAnimationFrame(() => {
        wipe.style.transition = "";
        wipe.classList.add("wipe-in");
    });
    rsbResetTimer = setTimeout(wipeOutReset, 3000);
}

// Slide the whole wrapper up (avoids revealing lap underneath), reset red silently, then unlock
function wipeOutReset() {
    clearTimeout(rsbResetTimer);
    rsbResetTimer = null;
    const wrapper = document.getElementById("race-status-wrapper");
    if (!wrapper) { rsbResetLocked = false; return; }
    wrapper.classList.remove("open");
    wrapper.addEventListener("transitionend", () => {
        if (!wrapper.classList.contains("open")) {
            wrapper.classList.remove("visible");
            rsbResetLocked = false;
            // Reset red overlay silently for next use
            const wipe = document.getElementById("rsb-lap-wipe-reset");
            if (wipe) {
                wipe.style.transition = "none";
                wipe.classList.remove("wipe-in", "wipe-out");
                requestAnimationFrame(() => { wipe.style.transition = ""; });
            }
            if (lastKnownData) updateRaceStatusBlock(
                lastKnownData.raceStatus || "standby",
                lastKnownData.countdown || null,
                lastKnownData.settings || {}
            );
        }
    }, { once: true });
}


let countdownInterval = null;
let countdownEndTime = null;

// Timer handle for the resumed overlay auto-dismiss
let rsbResumedTimer = null;

// Push jaune → vert: jump green to left side instantly (it's offscreen so invisible), then push both right
function wipeInResumed() {
    clearTimeout(rsbResumedTimer);
    const amber = document.getElementById("rsb-lap-wipe");
    const green = document.getElementById("rsb-lap-wipe-resumed");
    if (!green) return;

    // Teleport green to left side with no transition — safe because it's offscreen
    green.style.transition = "none";
    green.classList.remove("wipe-in", "wipe-out");
    // Force reflow so the browser commits the position before we re-enable transition
    green.getBoundingClientRect();
    green.style.transition = "";

    if (rsbWipeActive && amber) {
        // Amber is visible at translateX(0): push both right simultaneously
        amber.classList.remove("wipe-in");
        amber.classList.add("wipe-out");
        rsbWipeActive = false;
    }
    green.classList.add("wipe-in");
    rsbResumedTimer = setTimeout(wipeOutResumed, 3000);
}

// Slide the green overlay out to the right — leave it there, next wipeIn will reset
function wipeOutResumed() {
    clearTimeout(rsbResumedTimer);
    rsbResumedTimer = null;
    const wipe = document.getElementById("rsb-lap-wipe-resumed");
    if (!wipe) return;
    wipe.classList.remove("wipe-in");
    wipe.classList.add("wipe-out");
}

// Format milliseconds as M:SS for the countdown display
function formatCountdown(ms) {
    if (ms <= 0) return "0:00";
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

// Start ticking the countdown timer from a given remaining duration
function startCountdownDisplay(remainingMs) {
    stopCountdownDisplay();
    countdownEndTime = Date.now() + remainingMs;
    const timerEl = document.getElementById("lb-countdown-timer");
    function tick() {
        const remaining = countdownEndTime - Date.now();
        if (timerEl) timerEl.textContent = formatCountdown(remaining);
        if (remaining <= 0) stopCountdownDisplay();
    }
    tick();
    countdownInterval = setInterval(tick, 200);
}

// Stop the countdown tick interval
function stopCountdownDisplay() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}


// Decide which state to show; no-op while the reset banner is locked
function updateRaceStatusBlock(raceStatus, countdown, settings) {
    if (rsbResetLocked) return;
    const wrapper = "race-status-wrapper";

    if (raceStatus === "standby" && countdown && countdown.active && countdown.remainingMs > 0) {
        startCountdownDisplay(countdown.remainingMs);
        wipeOutPaused();
        setRaceStatusBlock("rsb-countdown");
        setRaceStatusHeight("countdown");
        showWrapper(wrapper);

    } else if (raceStatus === "running" || raceStatus === "finished") {
        stopCountdownDisplay();
        wipeOutPaused();
        setRaceStatusBlock("rsb-lap");
        setRaceStatusHeight("lap");
        showWrapper(wrapper);

    } else if (raceStatus === "paused") {
        stopCountdownDisplay();
        setRaceStatusBlock("rsb-lap");
        setRaceStatusHeight("paused");
        showWrapper(wrapper);
        wipeInPaused();

    } else {
        // standby with no countdown: hide the whole block
        stopCountdownDisplay();
        wipeOutPaused();
        hideWrapper(wrapper);
    }
}


// Receive and render a full race state update from the manager
function updateLeaderboard(data) {
    lastKnownData = data;

    const raceList = data.raceList || [];
    const teams = data.teams || [];
    const settings = data.settings || {};
    const teamDisplayMode = data.teamDisplayMode || "color-bar";
    const timingEnabled = data.timingEnabled !== false;
    const chronoDisplayMode = data.chronoDisplayMode || "leader";
    const raceStatus = data.raceStatus || "standby";
    const countdown = data.countdown || null;

    document.getElementById("lb-location").textContent = settings.raceName || "UNKNOWN RACE";
    document.getElementById("lb-session").textContent = settings.session || "Session";
    document.getElementById("lb-start-type").textContent = settings.startType || "Start Type";

    const weatherKey = settings.weather || "Clear";
    const weatherIconContainer = document.getElementById("lb-weather-icon");
    if (weatherIconContainer && typeof WEATHER_ICONS !== "undefined" && WEATHER_ICONS[weatherKey]) {
        weatherIconContainer.innerHTML = WEATHER_ICONS[weatherKey];
    }

    // Keep lap counter up to date whenever the race is live
    if (raceStatus === "running" || raceStatus === "paused" || raceStatus === "finished") {
        const totalLaps = parseInt(settings.totalLaps) || 0;
        let leaderLaps = raceList.length > 0 ? raceList[0].laps : 0;
        if (totalLaps > 0) leaderLaps = Math.min(leaderLaps, totalLaps);
        document.getElementById("lb-lap-current").textContent = leaderLaps;
    }

    updateRaceStatusBlock(raceStatus, countdown, settings);

    const container = document.getElementById("lb-pilots-container");
    if (!container) return;

    // FLIP step 1: snapshot Y positions before DOM changes
    const snapshots = new Map();
    pilotElements.forEach((els, pilotId) => {
        if (els.rowEl && els.rowEl.isConnected) {
            snapshots.set(pilotId, els.rowEl.getBoundingClientRect().top);
        }
    });

    const totalLapsVal = parseInt(settings.totalLaps) || 0;

    raceList.forEach((pilot, index) => {
        const team = teams.find((t) => t.id === pilot.teamId);
        const teamColor = team ? team.color : "#ffffff";
        const teamAcronym = team ? team.acronym : "";
        const rankClass = index === 0 ? "rank-first" : "";
        const dnfClass = pilot.dnf ? "dnf-row" : "";
        const safeCountry = pilot.country ? pilot.country.toLowerCase() : "un";
        const flagHTML = `<span class="fi fi-${safeCountry} fis"></span>`;
        const displayLaps = totalLapsVal > 0 ? Math.min(pilot.laps, totalLapsVal) : pilot.laps;

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
            // First render: create all three grid cells for this pilot
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
            // Update existing cells in place
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

    // Reorder DOM nodes to match raceList order
    raceList.forEach((pilot) => {
        const els = pilotElements.get(pilot.id);
        if (!els) return;
        container.appendChild(els.leftEl);
        container.appendChild(els.rowEl);
        container.appendChild(els.rightEl);
    });

    // FLIP step 2: animate pilots to their new positions
    const toAnimate = [];
    pilotElements.forEach((els, pilotId) => {
        if (!snapshots.has(pilotId)) return;
        const delta = snapshots.get(pilotId) - els.rowEl.getBoundingClientRect().top;
        if (Math.abs(delta) < 1) return;
        toAnimate.push({ el: els.rowEl, delta });
    });

    if (toAnimate.length > 0 && typeof anime !== "undefined") {
        toAnimate.forEach(({ el, delta }) => { el.style.transform = `translateY(${delta}px)`; });
        toAnimate.forEach(({ el }) => el.getBoundingClientRect());
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

// Trigger the red wipe banner when the manager resets the race
socket.on("race-restarted", () => {
    wipeInReset();
});

// Trigger the green wipe banner when the manager resumes after pause
socket.on("race-resumed", () => {
    wipeInResumed();
});