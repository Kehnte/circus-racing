// leaderboard.js — Real-time OBS leaderboard overlay.
// Listens to "race-state" via Socket.IO and updates the pilot standings.

const socket = io();

// Per-pilot DOM triplet keyed by pilotId: { leftEl, rowEl, rightEl }
const pilotElements = new Map();

let lastKnownData = null;
let currentData = null;

// Pilot ID currently holding the fastest-lap badge on the left icon column
let fastestLapPilotId = null;

// Tracks previous teamDisplayMode to detect structural row changes requiring a full rebuild
let lastTeamDisplayMode = null;

// Pagination state
const ROW_HEIGHT = 32;           // 30px row + 2px gap
const PAGE_TOP_OFFSET = 40;      // grid top position on 1080p
const PAGE_BOTTOM_MARGIN = 40;   // clearance from bottom edge
const VIEWPORT_HEIGHT = 1080;
const PAGE_SWITCH_INTERVAL = 6000;

let totalPages = 1;
let currentPage = 0;
let pageTimer = null;

// Session countdown ticker (timed mode only)
let sessionCountdownInterval = null;
let sessionCountdownEndTime = null;
let sessionCountdownExpired = false;

// Phase 4/5: race-state unified format
let lastRaceState = null;
let chronoTicker = null;
let currentCountdown = null;

// chrono computation helpers — race-state format

function lbFormatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const millis = ms % 1000;
    return `${m}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function computePilotElapsed(pilot, raceState, now) {
    if (!raceState.startedAt) return 0;
    if (pilot.frozenTime) {
        return new Date(pilot.frozenTime).getTime() - new Date(raceState.startedAt).getTime() - raceState.totalPausedMs;
    }
    const pauseOffset = raceState.pausedAt
        ? raceState.totalPausedMs + (now - new Date(raceState.pausedAt).getTime())
        : raceState.totalPausedMs;
    return Math.max(0, now - new Date(raceState.startedAt).getTime() - pauseOffset);
}

function computeRaceElapsed(raceState, now) {
    if (!raceState.startedAt) return 0;
    const pauseOffset = raceState.pausedAt
        ? raceState.totalPausedMs + (now - new Date(raceState.pausedAt).getTime())
        : raceState.totalPausedMs;
    return Math.max(0, now - new Date(raceState.startedAt).getTime() - pauseOffset);
}

function computeChronoDisplay(pilot, raceState, leaderElapsedMs, now) {
    const isDnf = pilot.status === "DNF" || pilot.status === "WARNING_DNF";
    if (!raceState.startedAt || isDnf) return "";
    const elapsedMs = computePilotElapsed(pilot, raceState, now);
    switch (raceState.chronoDisplayMode) {
        case "leader":
            return elapsedMs === leaderElapsedMs
                ? lbFormatTime(elapsedMs)
                : `+${lbFormatTime(Math.max(0, elapsedMs - leaderElapsedMs))}`;
        case "gap":
            return lbFormatTime(elapsedMs);
        case "best-lap": {
            const best = pilot.lapTimes.length ? Math.min(...pilot.lapTimes) : null;
            return best !== null ? lbFormatTime(best) : "--:--.---";
        }
        case "last-lap": {
            const times = pilot.lapTimes;
            const last = times.length ? times[times.length - 1] : null;
            return last !== null ? lbFormatTime(last) : "--:--.---";
        }
        default:
            return lbFormatTime(elapsedMs);
    }
}

// Converts a race-state broadcast to the legacy format expected by updateLeaderboard
function adaptRaceState(raceState) {
    const now = Date.now();
    const statusMap = {
        PENDING: "standby", SCHEDULED: "standby",
        STARTED: "running", PAUSED: "paused", FINISHED: "finished",
    };
    const raceStatus = statusMap[raceState.status] || "standby";

    const activePilots = raceState.pilots.filter(p => p.status === "RUNNING" || p.status === "WARNING_DNF");
    const leaderPilot = activePilots[0] ?? raceState.pilots[0];
    const leaderElapsedMs = leaderPilot ? computePilotElapsed(leaderPilot, raceState, now) : 0;

    const raceList = raceState.pilots.map(pilot => ({
        id: pilot.id,
        name: pilot.displayName,
        country: pilot.country,
        teamColor: pilot.teamSnapshot ? pilot.teamSnapshot.color : null,
        teamAcronym: pilot.teamSnapshot ? pilot.teamSnapshot.acronym : null,
        shipModel: pilot.vehicleSnapshot ? pilot.vehicleSnapshot.model : null,
        position: pilot.position,
        laps: pilot.lap,
        lapTimes: pilot.lapTimes,
        finished: pilot.status === "FINISHED",
        dnf: pilot.status === "DNF" || pilot.status === "WARNING_DNF",
        frozenTime: pilot.frozenTime,
        chronoDisplay: computeChronoDisplay(pilot, raceState, leaderElapsedMs, now),
    }));

    let sessionCountdown = null;
    if (raceState.sessionMode === "timed" && raceState.sessionDurationMs) {
        if (raceStatus === "standby") {
            sessionCountdown = { active: false, remainingMs: raceState.sessionDurationMs, expired: false };
        } else if (raceStatus === "finished") {
            sessionCountdown = { active: false, remainingMs: 0, expired: true };
        } else if (raceState.startedAt) {
            const elapsed = computeRaceElapsed(raceState, now);
            const remaining = Math.max(0, raceState.sessionDurationMs - elapsed);
            sessionCountdown = { active: raceStatus === "running", remainingMs: remaining, expired: remaining <= 0 };
        }
    }

    return {
        raceList,
        teams: [],
        teamDisplayMode: raceState.teamDisplayMode,
        timingEnabled: raceState.timingEnabled,
        chronoDisplayMode: raceState.chronoDisplayMode,
        globalFastestLap: raceState.globalFastestLapMs,
        globalFastestLapPilotId: raceState.globalFastestLapPilotId,
        raceStatus,
        countdown: currentCountdown || { active: false, remainingMs: 0 },
        sessionMode: raceState.sessionMode,
        sessionCountdown,
        settings: {
            raceName: raceState.raceName,
            session: raceState.session,
            weather: raceState.weather,
            startType: raceState.startType,
            totalLaps: String(raceState.lapCount ?? 0),
        },
    };
}

// 200ms ticker that refreshes only chrono cells (smooth display between server broadcasts)
function startChronoTicker() {
    stopChronoTicker();
    chronoTicker = setInterval(refreshChronos, 200);
}

function stopChronoTicker() {
    if (chronoTicker) { clearInterval(chronoTicker); chronoTicker = null; }
}

function refreshChronos() {
    if (!lastRaceState || !lastRaceState.startedAt || lastRaceState.status !== "STARTED") return;
    const raceState = lastRaceState;
    const now = Date.now();

    if (raceState.sessionMode === "timed" && raceState.sessionDurationMs) {
        const elapsed = computeRaceElapsed(raceState, now);
        setLapContainerToCountdown(Math.max(0, raceState.sessionDurationMs - elapsed), elapsed >= raceState.sessionDurationMs);
    }

    const activePilots = raceState.pilots.filter(p => p.status === "RUNNING" || p.status === "WARNING_DNF");
    const leaderPilot = activePilots[0] ?? raceState.pilots[0];
    const leaderElapsedMs = leaderPilot ? computePilotElapsed(leaderPilot, raceState, now) : 0;

    pilotElements.forEach((els, pilotId) => {
        const pilot = raceState.pilots.find(p => p.id === pilotId);
        if (!pilot || !els.rowEl) return;
        const isDnf = pilot.status === "DNF" || pilot.status === "WARNING_DNF";
        if (!raceState.timingEnabled || isDnf) return;
        const pilotIdx = raceState.pilots.indexOf(pilot);
        if (pilotIdx === 0 && !pilot.frozenTime) return; // leader shows static label
        const chronoEl = els.rowEl.querySelector(".pilot-chrono");
        if (!chronoEl) return;
        const str = computeChronoDisplay(pilot, raceState, leaderElapsedMs, now);
        if (str) chronoEl.textContent = str;
    });
}

// Layout helpers

// Measures the pixel height of all grid rows above the pilots container at runtime
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

// Returns how many pilot rows fit on screen based on available vertical space
function computeMaxRowsPerPage() {
    const available = VIEWPORT_HEIGHT - PAGE_TOP_OFFSET - getHeaderHeight() - PAGE_BOTTOM_MARGIN;
    return Math.max(1, Math.floor(available / ROW_HEIGHT));
}

// Slide wrapper

// Reveals a slide-wrapper element with a CSS grid-row expand transition
function showWrapper(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("visible");
    requestAnimationFrame(() => el.classList.add("open"));
}

// Collapses a slide-wrapper element and removes it from layout after the transition
function hideWrapper(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("open");
    el.addEventListener("transitionend", () => {
        if (!el.classList.contains("open")) el.classList.remove("visible");
    }, { once: true });
}

// Race status block

const RSB_HEIGHTS = { countdown: 80, lap: 50, paused: 50 };

// Animates the race-status inner container to the target state height
function setRaceStatusHeight(state) {
    const inner = document.getElementById("race-status-inner");
    if (inner) inner.style.height = RSB_HEIGHTS[state] + "px";
}

// Activates one race-status block (countdown or lap) and deactivates the other
function setRaceStatusBlock(id) {
    ["rsb-countdown", "rsb-lap"].forEach((blockId) => {
        const el = document.getElementById(blockId);
        if (el) el.classList.toggle("active", blockId === id);
    });
}

// Wipe overlays

let rsbWipeActive = false;

// Slides the amber "Race paused" overlay into view
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

// Slides the amber overlay out; instant=true resets without animation
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
let rsbResetLocked = false;

// Shows the red "Race restarted" wipe, locks leaderboard updates for 3 s then collapses
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

// Collapses the wrapper after the reset wipe, then unlocks leaderboard updates
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

let rsbResumedTimer = null;

// Shows the green "Race resumed" wipe over the amber one, auto-dismisses after 3 s
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

// Slides the green overlay out
function wipeOutResumed() {
    clearTimeout(rsbResumedTimer);
    rsbResumedTimer = null;
    const wipe = document.getElementById("rsb-lap-wipe-resumed");
    if (!wipe) return;
    wipe.classList.remove("wipe-in");
    wipe.classList.add("wipe-out");
}

// Countdown display (pre-race)

let countdownInterval = null;
let countdownEndTime = null;

// Formats remaining ms as M:SS for the countdown display
function formatCountdown(ms) {
    if (ms <= 0) return "0:00";
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

// Starts a local ticker that updates the countdown element every 200 ms
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

// Clears the countdown ticker
function stopCountdownDisplay() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
}

// Session countdown display (timed mode)

// Formats ms as M:SS (no millis) for the session countdown
function formatSessionCountdown(ms) {
    if (ms <= 0) return "0:00";
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

// Updates the lap-container to show the session countdown instead of lap info
function setLapContainerToCountdown(remainingMs, expired) {
    const lapContainer = document.querySelector(".lap-container");
    if (!lapContainer) return;
    const text = expired ? "0:00" : formatSessionCountdown(remainingMs);
    lapContainer.innerHTML = `<span class="lap-current">${text}</span>`;
}

// Restores the lap-container to its normal lap counter display
function setLapContainerToLaps(lapCurrent, lapTotal) {
    const lapContainer = document.querySelector(".lap-container");
    if (!lapContainer) return;
    lapContainer.innerHTML = `LAP &nbsp;<span class="lap-current" id="lb-lap-current">${lapCurrent}</span><span class="lap-total" id="lb-lap-total">/${lapTotal}</span>`;
}

// Starts a local 200ms ticker keeping the session countdown fresh on the leaderboard
function startSessionCountdownDisplay(remainingMs, expired) {
    stopSessionCountdownDisplay();
    if (expired) {
        setLapContainerToCountdown(0, true);
        return;
    }
    sessionCountdownExpired = false;
    sessionCountdownEndTime = Date.now() + remainingMs;
    function tick() {
        const remaining = sessionCountdownEndTime - Date.now();
        if (remaining <= 0) {
            sessionCountdownExpired = true;
            setLapContainerToCountdown(0, true);
            stopSessionCountdownDisplay();
            return;
        }
        setLapContainerToCountdown(remaining, false);
    }
    tick();
    sessionCountdownInterval = setInterval(tick, 200);
}

// Clears the session countdown ticker
function stopSessionCountdownDisplay() {
    if (sessionCountdownInterval) {
        clearInterval(sessionCountdownInterval);
        sessionCountdownInterval = null;
    }
}

// Race status routing

// Selects the correct race-status block and wipe state based on raceStatus and countdown payload
function updateRaceStatusBlock(raceStatus, countdown, settings) {
    if (rsbResetLocked) return;
    const wrapper = "race-status-wrapper";

    if (raceStatus === "standby" && countdown && countdown.active && countdown.remainingMs > 0) {
        startCountdownDisplay(countdown.remainingMs);
        wipeOutPaused();
        setRaceStatusBlock("rsb-countdown");
        setRaceStatusHeight("countdown");
        showWrapper(wrapper);
    } else if (raceStatus === "standby") {
        stopCountdownDisplay();
        wipeOutPaused();
        setRaceStatusBlock("rsb-lap");
        setRaceStatusHeight("lap");
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

// Chrono helpers

// Returns the short uppercase label shown in the leader's chrono cell for the active mode
function chronoModeLabel(mode) {
    switch (mode) {
        case "leader":   return "LEADER";
        case "gap":      return "GAP";
        case "best-lap": return "BEST LAP";
        case "last-lap": return "LAST LAP";
        default:         return "CHRONO";
    }
}

// Icon state

// Tracks finished pilots so their flag icon survives page rebuilds
const finishedPilotIds = new Set();

// Adds the checkered flag to a pilot's right icon cell and records them in finishedPilotIds
function setFinishedIcon(pilotId) {
    finishedPilotIds.add(pilotId);
    const els = pilotElements.get(pilotId);
    if (!els || els.rightEl.classList.contains("status-finished")) return;
    els.rightEl.className = "icon-cell status-finished";
    els.rightEl.innerHTML = RACE_ICONS.finished;
}

// Moves the fastest-lap badge to the new holder, clearing it from the previous one
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

// Pagination

// Renders or removes the dot indicator row below the pilot list
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

// DOM rendering

// Full DOM rebuild for a page slice — always restores icon badge state without animation
function buildPage(pageSlice, teams, start, chronoDisplayMode, timingEnabled, totalLapsVal, teamDisplayMode) {
    const container = document.getElementById("lb-pilots-container");
    if (!container) return;

    container.innerHTML = "";
    pilotElements.clear();

    pageSlice.forEach((pilot, index) => {
        const globalIndex = start + index;
        const teamColor = pilot.teamColor || "#ffffff";
        const teamAcronym = pilot.teamAcronym || "";
        const dnfClass = pilot.dnf ? " dnf-row" : "";
        const rankClass = globalIndex === 0 ? " rank-first" : "";
        const safeCountry = pilot.country ? pilot.country.toLowerCase() : "un";
        const displayLaps = totalLapsVal > 0 ? Math.min(pilot.laps, totalLapsVal) : pilot.laps;
        const { chronoContent, chronoExtraClass } = buildChronoCell(pilot, globalIndex, chronoDisplayMode, timingEnabled);

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

// In-place content update — only touches row data cells, never icon cells
function updatePage(pageSlice, teams, start, chronoDisplayMode, timingEnabled, totalLapsVal, teamDisplayMode) {
    pageSlice.forEach((pilot, index) => {
        const els = pilotElements.get(pilot.id);
        if (!els) return;

        const globalIndex = start + index;
        const teamColor = pilot.teamColor || "#ffffff";
        const teamAcronym = pilot.teamAcronym || "";
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

// Builds the chrono cell content and extra CSS class for a given pilot and display mode
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

// Decides whether to do a full rebuild, a FLIP-animated reorder, or an in-place update
function renderPage(raceList, teams, page, chronoDisplayMode, timingEnabled, settings, teamDisplayMode, sessionMode) {
    const maxRows = computeMaxRowsPerPage();
    const start = page * maxRows;
    const pageSlice = raceList.slice(start, start + maxRows);
    // In timed mode there is no lap cap — pilots run as many laps as they complete
    const totalLapsVal = sessionMode === "timed" ? 0 : (parseInt((settings || {}).totalLaps) || 0);

    const incomingIds = pageSlice.map((p) => p.id);
    const renderedIds = Array.from(pilotElements.keys());
    const renderedSet = new Set(renderedIds);

    const setChanged = incomingIds.length !== renderedIds.length
        || incomingIds.some((id) => !renderedSet.has(id));

    const modeChanged = teamDisplayMode !== lastTeamDisplayMode;
    lastTeamDisplayMode = teamDisplayMode;

    if (setChanged || modeChanged) {
        buildPage(pageSlice, teams, start, chronoDisplayMode, timingEnabled, totalLapsVal, teamDisplayMode);
        return;
    }

    const snapshots = new Map();
    pilotElements.forEach((els, pilotId) => {
        if (els.rowEl.isConnected) snapshots.set(pilotId, els.rowEl.getBoundingClientRect().top);
    });

    updatePage(pageSlice, teams, start, chronoDisplayMode, timingEnabled, totalLapsVal, teamDisplayMode);

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
    toAnimate.forEach(({ el }) => el.getBoundingClientRect());
    anime({
        targets: toAnimate.map(({ el }) => el),
        translateY: 0,
        duration: 400,
        easing: "easeOutQuart",
    });
}

// Pagination cycling

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
                currentData.settings || {},
                currentData.teamDisplayMode || "color-bar",
                currentData.sessionMode || "laps"
            );
            updatePageIndicator(currentPage, totalPages);
        }
    }, PAGE_SWITCH_INTERVAL);
}

// Main update handler

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
    const teamDisplayMode = data.teamDisplayMode || "color-bar";
    const sessionMode = data.sessionMode || "laps";
    const sessionCountdown = data.sessionCountdown || null;

    document.getElementById("lb-location").textContent = settings.raceName || "UNKNOWN RACE";
    document.getElementById("lb-session").textContent = settings.session || "Session";
    document.getElementById("lb-start-type").textContent = settings.startType || "Start Type";

    const weatherIconContainer = document.getElementById("lb-weather-icon");
    const weatherKey = settings.weather || "Clear";
    if (weatherIconContainer && WEATHER_ICONS[weatherKey]) {
        weatherIconContainer.innerHTML = WEATHER_ICONS[weatherKey];
    }

    // Lap container: timed mode shows session countdown, laps mode shows lap counter
    if (sessionMode === "timed" && sessionCountdown && sessionCountdown.active) {
        startSessionCountdownDisplay(sessionCountdown.remainingMs, sessionCountdown.expired);
    } else if (sessionMode === "timed" && sessionCountdown && !sessionCountdown.active) {
        // Standby or finished in timed mode — show the full duration as static text
        stopSessionCountdownDisplay();
        setLapContainerToCountdown(sessionCountdown.remainingMs || 0, sessionCountdown.expired || false);
    } else {
        // Laps mode: stop any running session countdown and restore lap display
        stopSessionCountdownDisplay();
        const totalLaps = parseInt(settings.totalLaps) || 0;
        let leaderLaps = raceList.length > 0 ? raceList[0].laps : 0;
        if (totalLaps > 0) leaderLaps = Math.min(leaderLaps, totalLaps);
        setLapContainerToLaps(leaderLaps, settings.totalLaps || "0");
    }

    // Always update lap counter values even in laps mode (setLapContainerToLaps already did it above)
    // but keep the individual element refs valid for legacy code paths
    if (sessionMode === "laps") {
        const totalLaps = parseInt(settings.totalLaps) || 0;
        let leaderLaps = raceList.length > 0 ? raceList[0].laps : 0;
        if (totalLaps > 0) leaderLaps = Math.min(leaderLaps, totalLaps);
        const lapCurrentEl = document.getElementById("lb-lap-current");
        const lapTotalEl = document.getElementById("lb-lap-total");
        if (lapCurrentEl) lapCurrentEl.textContent = leaderLaps;
        if (lapTotalEl) lapTotalEl.textContent = "/" + (settings.totalLaps || "0");
    }

    updateRaceStatusBlock(raceStatus, countdown, settings);

    const newTotalPages = Math.max(1, Math.ceil(raceList.length / computeMaxRowsPerPage()));
    if (newTotalPages !== totalPages) {
        currentPage = 0;
        totalPages = newTotalPages;
        startPageCycle(data);
    }

    renderPage(raceList, teams, currentPage, chronoDisplayMode, timingEnabled, settings, teamDisplayMode, sessionMode);
    updatePageIndicator(currentPage, totalPages);

    raceList.forEach((pilot) => {
        if (pilot.finished) setFinishedIcon(pilot.id);
    });

    const newFastest = data.globalFastestLapPilotId ?? null;
    if (newFastest !== fastestLapPilotId) {
        setFastestLapIcon(newFastest);
    }
}

// Socket events

socket.on("race-state", (data) => {
    lastRaceState = data;
    updateLeaderboard(adaptRaceState(data));
    if (data.status === "STARTED") {
        startChronoTicker();
    } else {
        stopChronoTicker();
    }
});

socket.on("race-event", (event) => {
    if (event.type === "countdown") {
        currentCountdown = { active: true, remainingMs: event.seconds * 1000 };
        startCountdownDisplay(event.seconds * 1000);
        if (lastRaceState) {
            const adapted = adaptRaceState(lastRaceState);
            updateRaceStatusBlock("standby", currentCountdown, adapted.settings);
        }
    } else if (event.type === "countdown-stop") {
        currentCountdown = null;
        stopCountdownDisplay();
        if (lastRaceState) {
            const adapted = adaptRaceState(lastRaceState);
            updateRaceStatusBlock(adapted.raceStatus, null, adapted.settings);
        }
    }
});

socket.on("race-restarted", () => {
    wipeInReset();
    stopChronoTicker();
    stopSessionCountdownDisplay();
    currentCountdown = null;
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

// Wraps lb-pilots-container in a div to allow height animation (display:contents is not animatable)
function getPilotsAnimWrapper() {
    const container = document.getElementById("lb-pilots-container");
    if (!container) return null;
    let wrapper = document.getElementById("lb-pilots-anim-wrapper");
    if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.id = "lb-pilots-anim-wrapper";
        wrapper.style.overflow = "hidden";
        // Insert wrapper before container in the grid, then move container inside
        container.parentNode.insertBefore(wrapper, container);
        wrapper.appendChild(container);
        // Wrapper must span all grid columns like the original container did
        wrapper.style.gridColumn = "1 / -1";
        wrapper.style.display = "block";
    }
    return wrapper;
}

// Slides the pilot list into view from top to bottom using anime.js
function showPilots() {
    const wrapper = getPilotsAnimWrapper();
    if (!wrapper) return;
    wrapper.style.display = "block";
    wrapper.style.height = "auto";
    const targetH = wrapper.scrollHeight;
    wrapper.style.height = "0px";
    anime({
        targets: wrapper,
        height: targetH,
        duration: 400,
        easing: "easeOutQuart",
        complete: () => { wrapper.style.height = "auto"; },
    });
}

// Slides the pilot list out of view from bottom to top using anime.js
function hidePilots() {
    const wrapper = getPilotsAnimWrapper();
    if (!wrapper) return;
    anime({
        targets: wrapper,
        height: 0,
        duration: 350,
        easing: "easeInQuart",
        complete: () => { wrapper.style.display = "none"; },
    });
}

// Listen for dashboard toggle command and animate accordingly
socket.on("toggle-pilots-visibility", (data) => {
    if (data.visible) {
        showPilots();
    } else {
        hidePilots();
    }
});