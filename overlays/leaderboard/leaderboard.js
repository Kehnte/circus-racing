// leaderboard.js

const socket = io();

// per-pilot DOM triplet keyed by pilotId: { leftEl, rowEl, rightEl }
const pilotElements = new Map();

let lastKnownData = null;
let currentData = null;

// id of the pilot currently holding the fastest-lap badge on the left column
let fastestLapPilotId = null;

// pagination state
const ROW_HEIGHT = 32;           // 30px row + 2px gap
const PAGE_TOP_OFFSET = 40;      // grid top position on 1080p
const PAGE_BOTTOM_MARGIN = 40;   // clearance from bottom edge
const VIEWPORT_HEIGHT = 1080;
const PAGE_SWITCH_INTERVAL = 6000;

let totalPages = 1;
let currentPage = 0;
let pageTimer = null;

// measure header height at runtime to compute available rows
function getHeaderHeight() {
    const grid = document.querySelector(".leaderboard-grid");
    const container = document.getElementById("lb-pilots-container");
    if (!grid || !container) return 140;
    let h = 0;
    for (const child of Array.from(grid.children)) {
        if (child === container) break;
        if (getComputedStyle(child).display === "contents") continue;
        h = child.getBoundingClientRect().bottom - grid.getBoundingClientRect().top;
    }
    return h + 4;
}

function computeMaxRowsPerPage() {
    const available = VIEWPORT_HEIGHT - PAGE_TOP_OFFSET - getHeaderHeight() - PAGE_BOTTOM_MARGIN;
    return Math.max(1, Math.floor(available / ROW_HEIGHT));
}

// slide-wrapper open/close (used by the race-status block)
function showWrapper(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("visible");
    requestAnimationFrame(() => el.classList.add("open"));
}

function hideWrapper(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("open");
    el.addEventListener("transitionend", () => {
        if (!el.classList.contains("open")) el.classList.remove("visible");
    }, { once: true });
}

const RSB_HEIGHTS = { countdown: 80, lap: 50, paused: 50 };

function setRaceStatusHeight(state) {
    const inner = document.getElementById("race-status-inner");
    if (inner) inner.style.height = RSB_HEIGHTS[state] + "px";
}

function setRaceStatusBlock(id) {
    ["rsb-countdown", "rsb-lap"].forEach((blockId) => {
        const el = document.getElementById(blockId);
        if (el) el.classList.toggle("active", blockId === id);
    });
}

// amber wipe: slides in when race is paused, out when resumed
let rsbWipeActive = false;

function wipeInPaused() {
    if (rsbWipeActive) return;
    rsbWipeActive = true;
    const wipe = document.getElementById("rsb-lap-wipe");
    if (!wipe) return;
    wipe.style.transition = "none";
    wipe.classList.remove("wipe-in", "wipe-out");
    requestAnimationFrame(() => {
        wipe.style.transition = "";
        wipe.classList.add("wipe-in");
    });
}

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

// red wipe: shown on race reset, locks updates for 3 s
let rsbResetTimer = null;
let rsbResetLocked = false;

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

// green wipe: shown when race resumes, auto-dismisses after 3 s
let rsbResumedTimer = null;

function wipeInResumed() {
    clearTimeout(rsbResumedTimer);
    const amber = document.getElementById("rsb-lap-wipe");
    const green = document.getElementById("rsb-lap-wipe-resumed");
    if (!green) return;
    green.style.transition = "none";
    green.classList.remove("wipe-in", "wipe-out");
    green.getBoundingClientRect();
    green.style.transition = "";
    if (rsbWipeActive && amber) {
        amber.classList.remove("wipe-in");
        amber.classList.add("wipe-out");
        rsbWipeActive = false;
    }
    green.classList.add("wipe-in");
    rsbResumedTimer = setTimeout(wipeOutResumed, 3000);
}

function wipeOutResumed() {
    clearTimeout(rsbResumedTimer);
    rsbResumedTimer = null;
    const wipe = document.getElementById("rsb-lap-wipe-resumed");
    if (!wipe) return;
    wipe.classList.remove("wipe-in");
    wipe.classList.add("wipe-out");
}

// countdown display ticker
let countdownInterval = null;
let countdownEndTime = null;

function formatCountdown(ms) {
    if (ms <= 0) return "0:00";
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

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

function stopCountdownDisplay() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
}

// choose which race-status block to show based on current state
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
        stopCountdownDisplay();
        wipeOutPaused();
        hideWrapper(wrapper);
    }
}

// short label shown in the chrono cell of the leading pilot
function chronoModeLabel(mode) {
    switch (mode) {
        case "leader":   return "LEADER";
        case "gap":      return "GAP";
        case "best-lap": return "BEST LAP";
        case "last-lap": return "LAST LAP";
        default:         return "CHRONO";
    }
}

// tracks which pilots have finished, used to restore state after a rebuild
const finishedPilotIds = new Set();

// marks a pilot as finished and shows the flag icon
function setFinishedIcon(pilotId) {
    finishedPilotIds.add(pilotId);
    const els = pilotElements.get(pilotId);
    if (!els || els.rightEl.classList.contains("status-finished")) return;
    els.rightEl.className = "icon-cell status-finished";
    els.rightEl.innerHTML = RACE_ICONS.finished;
}

// updates the fastest-lap badge to the new holder, clears the previous one
function setFastestLapIcon(newPilotId) {
    if (fastestLapPilotId !== null && fastestLapPilotId !== newPilotId) {
        const prev = pilotElements.get(fastestLapPilotId);
        if (prev) { prev.leftEl.className = "empty-cell"; prev.leftEl.innerHTML = ""; }
    }

    fastestLapPilotId = newPilotId;
    if (newPilotId === null) return;

    const els = pilotElements.get(newPilotId);
    if (!els || els.leftEl.classList.contains("status-fastest-lap")) return;
    els.leftEl.className = "icon-cell status-fastest-lap";
    els.leftEl.innerHTML = RACE_ICONS["fastest-lap"];
}

// pagination: update the dot indicator below the list
function updatePageIndicator(page, total) {
    const old = document.getElementById("lb-page-indicator");
    if (old) old.remove();
    if (total <= 1) return;

    const indicator = document.createElement("div");
    indicator.id = "lb-page-indicator";
    indicator.className = "page-indicator";
    indicator.style.gridColumn = "2";

    for (let i = 0; i < total; i++) {
        const dot = document.createElement("div");
        dot.className = "page-dot" + (i === page ? " active" : "");
        indicator.appendChild(dot);
    }

    const grid = document.querySelector(".leaderboard-grid");
    if (grid) grid.appendChild(indicator);
}

// full DOM build — always creates empty icon cells; applyIconStates restores badges after
function buildPage(pageSlice, teams, start, chronoDisplayMode, timingEnabled, totalLapsVal, teamDisplayMode) {
    const container = document.getElementById("lb-pilots-container");
    if (!container) return;

    container.innerHTML = "";
    pilotElements.clear();

    pageSlice.forEach((pilot, index) => {
        const globalIndex = start + index;
        const team = teams.find((t) => t.id === pilot.teamId);
        const teamColor = team ? team.color : "#ffffff";
        const teamAcronym = team ? team.acronym : "";
        const dnfClass = pilot.dnf ? " dnf-row" : "";
        const rankClass = globalIndex === 0 ? " rank-first" : "";
        const safeCountry = pilot.country ? pilot.country.toLowerCase() : "un";
        const displayLaps = totalLapsVal > 0 ? Math.min(pilot.laps, totalLapsVal) : pilot.laps;
        const { chronoContent, chronoExtraClass } = buildChronoCell(pilot, globalIndex, chronoDisplayMode, timingEnabled);

        // left cell: restore fastest-lap badge if this pilot holds it, no animation on rebuild
        const leftEl = document.createElement("div");
        if (pilot.id === fastestLapPilotId) {
            leftEl.className = "icon-cell status-fastest-lap";
            leftEl.innerHTML = RACE_ICONS["fastest-lap"];
        } else {
            leftEl.className = "empty-cell";
        }

        const rowEl = document.createElement("div");
        rowEl.className = `pilot-row${dnfClass}`;
        rowEl.dataset.pilotId = pilot.id;

        let teamCellHTML = "";
        if (teamDisplayMode === "color-bar") {
            teamCellHTML = `<div class="team-color" style="background-color: ${teamColor}"></div>`;
        } else if (teamDisplayMode === "acronym") {
            teamCellHTML = `<div class="team-acronym" style="color: ${teamColor}">${teamAcronym}</div>`;
        }

        rowEl.innerHTML = `
            <div class="pilot-rank${rankClass}">${pilot.position}</div>
            ${teamCellHTML}
            <div class="pilot-infos">
                <div class="pilot-country"><span class="fi fi-${safeCountry} fis"></span></div>
                <div class="pilot-name">${pilot.name}</div>
            </div>
            <div class="pilot-laps">${displayLaps}</div>
            <div class="pilot-chrono${chronoExtraClass}">${chronoContent}</div>
        `;

        // right cell: restore finished state if already known, no animation on rebuild
        const rightEl = document.createElement("div");
        if (finishedPilotIds.has(pilot.id)) {
            rightEl.className = "icon-cell status-finished";
            rightEl.innerHTML = RACE_ICONS.finished;
        } else {
            rightEl.className = "empty-cell";
        }

        container.appendChild(leftEl);
        container.appendChild(rowEl);
        container.appendChild(rightEl);

        pilotElements.set(pilot.id, { leftEl, rowEl, rightEl });
    });
}

// in-place update — only touches row content, never icon cells
function updatePage(pageSlice, teams, start, chronoDisplayMode, timingEnabled, totalLapsVal, teamDisplayMode) {
    pageSlice.forEach((pilot, index) => {
        const els = pilotElements.get(pilot.id);
        if (!els) return;

        const globalIndex = start + index;
        const team = teams.find((t) => t.id === pilot.teamId);
        const teamColor = team ? team.color : "#ffffff";
        const teamAcronym = team ? team.acronym : "";
        const displayLaps = totalLapsVal > 0 ? Math.min(pilot.laps, totalLapsVal) : pilot.laps;
        const safeCountry = pilot.country ? pilot.country.toLowerCase() : "un";
        const { chronoContent, chronoExtraClass } = buildChronoCell(pilot, globalIndex, chronoDisplayMode, timingEnabled);

        const rowEl = els.rowEl;
        rowEl.className = `pilot-row${pilot.dnf ? " dnf-row" : ""}`;

        const rankEl = rowEl.querySelector(".pilot-rank");
        rankEl.className = `pilot-rank${globalIndex === 0 ? " rank-first" : ""}`;
        rankEl.textContent = pilot.position;

        rowEl.querySelector(".pilot-country").innerHTML = `<span class="fi fi-${safeCountry} fis"></span>`;
        rowEl.querySelector(".pilot-name").textContent = pilot.name;
        rowEl.querySelector(".pilot-laps").textContent = displayLaps;

        const chronoEl = rowEl.querySelector(".pilot-chrono");
        chronoEl.className = `pilot-chrono${chronoExtraClass}`;
        chronoEl.textContent = chronoContent;

        const teamColorEl = rowEl.querySelector(".team-color");
        if (teamColorEl) teamColorEl.style.backgroundColor = teamColor;
        const teamAcronymEl = rowEl.querySelector(".team-acronym");
        if (teamAcronymEl) { teamAcronymEl.style.color = teamColor; teamAcronymEl.textContent = teamAcronym; }
    });
}

// shared chrono cell content builder
function buildChronoCell(pilot, globalIndex, chronoDisplayMode, timingEnabled) {
    let chronoContent = "—";
    let chronoExtraClass = "";
    if (timingEnabled) {
        if (pilot.dnf) {
            chronoContent = "DNF";
            chronoExtraClass = " chrono-dnf";
        } else if (globalIndex === 0) {
            chronoContent = chronoModeLabel(chronoDisplayMode);
            chronoExtraClass = " chrono-mode-label";
        } else {
            chronoContent = pilot.chronoDisplay || "—";
        }
    }
    return { chronoContent, chronoExtraClass };
}

// rebuild if pilot set changed; FLIP-animate if only order changed; update in place if nothing moved
function renderPage(raceList, teams, page, chronoDisplayMode, timingEnabled, settings) {
    const maxRows = computeMaxRowsPerPage();
    const start = page * maxRows;
    const pageSlice = raceList.slice(start, start + maxRows);
    const totalLapsVal = parseInt((settings || {}).totalLaps) || 0;
    const teamDisplayMode = currentData ? (currentData.teamDisplayMode || "color-bar") : "color-bar";

    const incomingIds = pageSlice.map((p) => p.id);
    const renderedIds = Array.from(pilotElements.keys());
    const renderedSet = new Set(renderedIds);

    // sets differ → full rebuild (pilot entered or left this page)
    const setChanged = incomingIds.length !== renderedIds.length
        || incomingIds.some((id) => !renderedSet.has(id));

    if (setChanged) {
        buildPage(pageSlice, teams, start, chronoDisplayMode, timingEnabled, totalLapsVal, teamDisplayMode);
        return;
    }

    // FLIP step 1 — snapshot Y positions before any DOM change
    const snapshots = new Map();
    pilotElements.forEach((els, pilotId) => {
        if (els.rowEl.isConnected) snapshots.set(pilotId, els.rowEl.getBoundingClientRect().top);
    });

    // update content in place
    updatePage(pageSlice, teams, start, chronoDisplayMode, timingEnabled, totalLapsVal, teamDisplayMode);

    // reorder DOM nodes to match new order
    const container = document.getElementById("lb-pilots-container");
    if (container) {
        pageSlice.forEach((pilot) => {
            const els = pilotElements.get(pilot.id);
            if (!els) return;
            container.appendChild(els.leftEl);
            container.appendChild(els.rowEl);
            container.appendChild(els.rightEl);
        });
    }

    // FLIP step 2 — animate each row from its old Y to its new Y
    if (typeof anime === "undefined") return;
    const toAnimate = [];
    pilotElements.forEach((els, pilotId) => {
        if (!snapshots.has(pilotId)) return;
        const delta = snapshots.get(pilotId) - els.rowEl.getBoundingClientRect().top;
        if (Math.abs(delta) < 1) return;
        toAnimate.push({ el: els.rowEl, delta });
    });
    if (toAnimate.length === 0) return;
    toAnimate.forEach(({ el, delta }) => { el.style.transform = `translateY(${delta}px)`; });
    toAnimate.forEach(({ el }) => el.getBoundingClientRect()); // force reflow
    anime({
        targets: toAnimate.map(({ el }) => el),
        translateY: 0,
        duration: 400,
        easing: "easeOutQuart",
    });
}

// start or restart the page-cycling timer
function startPageCycle(data) {
    if (pageTimer) { clearInterval(pageTimer); pageTimer = null; }

    const raceList = data.raceList || [];
    totalPages = Math.max(1, Math.ceil(raceList.length / computeMaxRowsPerPage()));

    updatePageIndicator(currentPage, totalPages);
    if (totalPages <= 1) return;

    pageTimer = setInterval(() => {
        currentPage = (currentPage + 1) % totalPages;
        if (currentData) {
            renderPage(
                currentData.raceList || [],
                currentData.teams || [],
                currentPage,
                currentData.chronoDisplayMode || "leader",
                currentData.timingEnabled !== false,
                currentData.settings || {}
            );
            updatePageIndicator(currentPage, totalPages);
        }
    }, PAGE_SWITCH_INTERVAL);
}

// main handler: update all leaderboard sections from a race-data payload
function updateLeaderboard(data) {
    lastKnownData = data;
    currentData = data;

    const raceList = data.raceList || [];
    const teams = data.teams || [];
    const settings = data.settings || {};
    const timingEnabled = data.timingEnabled !== false;
    const chronoDisplayMode = data.chronoDisplayMode || "leader";
    const raceStatus = data.raceStatus || "standby";
    const countdown = data.countdown || null;

    document.getElementById("lb-location").textContent = settings.raceName || "UNKNOWN RACE";
    document.getElementById("lb-session").textContent = settings.session || "Session";
    document.getElementById("lb-start-type").textContent = settings.startType || "Start Type";

    const weatherIconContainer = document.getElementById("lb-weather-icon");
    const weatherKey = settings.weather || "Clear";
    if (weatherIconContainer && WEATHER_ICONS[weatherKey]) {
        weatherIconContainer.innerHTML = WEATHER_ICONS[weatherKey];
    }

    if (raceStatus === "running" || raceStatus === "paused" || raceStatus === "finished") {
        const totalLaps = parseInt(settings.totalLaps) || 0;
        let leaderLaps = raceList.length > 0 ? raceList[0].laps : 0;
        if (totalLaps > 0) leaderLaps = Math.min(leaderLaps, totalLaps);
        document.getElementById("lb-lap-current").textContent = leaderLaps;
    }

    updateRaceStatusBlock(raceStatus, countdown, settings);

    // recompute pagination and re-render if page count changed
    const newTotalPages = Math.max(1, Math.ceil(raceList.length / computeMaxRowsPerPage()));
    if (newTotalPages !== totalPages) {
        currentPage = 0;
        totalPages = newTotalPages;
        startPageCycle(data);
    }

    // render first so pilotElements always points to live DOM nodes
    renderPage(raceList, teams, currentPage, chronoDisplayMode, timingEnabled, settings);
    updatePageIndicator(currentPage, totalPages);

    // icons after render — pilotElements is guaranteed up to date
    raceList.forEach((pilot) => {
        if (pilot.finished) setFinishedIcon(pilot.id);
    });

    const newFastest = data.globalFastestLapPilotId ?? null;
    if (newFastest !== fastestLapPilotId) {
        setFastestLapIcon(newFastest);
    }
}

socket.on("race-data", (data) => {
    updateLeaderboard(data);
});

socket.on("race-restarted", () => {
    wipeInReset();
    currentPage = 0;
    totalPages = 1;
    fastestLapPilotId = null;
    finishedPilotIds.clear();
    if (pageTimer) { clearInterval(pageTimer); pageTimer = null; }
    pilotElements.clear();
    const container = document.getElementById("lb-pilots-container");
    if (container) container.innerHTML = "";
    updatePageIndicator(0, 1);
});

socket.on("race-resumed", () => {
    wipeInResumed();
});