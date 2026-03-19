// race-alert.js — OBS overlay for race events (fastest lap, incident, finished).

const socket = io();

let eventQueue = [];
let isDisplaying = false;
let displayTimer = null;

let currentTeamDisplayMode = "color-bar";
let currentTimingEnabled = true;

// Keep display mode and timing state in sync
socket.on("race-data", (data) => {
    if (data.teamDisplayMode !== undefined) currentTeamDisplayMode = data.teamDisplayMode;
    if (data.timingEnabled !== undefined) currentTimingEnabled = data.timingEnabled;
});

socket.on("race-state", (data) => {
    if (data.teamDisplayMode !== undefined) currentTeamDisplayMode = data.teamDisplayMode;
    if (data.timingEnabled !== undefined) currentTimingEnabled = data.timingEnabled;
});

// Queue incoming events and start processing if idle
socket.on("race-event", (event) => {
    eventQueue.push(event);
    if (!isDisplaying) processQueue();
});

// Dequeue and display events one at a time, then hide when empty
function processQueue() {
    if (eventQueue.length === 0) {
        isDisplaying = false;
        hideAlert();
        return;
    }
    isDisplaying = true;
    const event = eventQueue.shift();
    showAlert(event);
    const duration = (event.displayDuration >= 1 ? event.displayDuration : 5) * 1000;
    displayTimer = setTimeout(processQueue, duration);
}

// Populate all fields and make the alert visible
function showAlert(event) {
    const row = document.querySelector(".event-row");
    if (!row) return;

    const pilotNameEl = document.querySelector(".pilot-name");
    if (pilotNameEl) pilotNameEl.textContent = event.pilotName || "";

    const pilotCountryEl = document.querySelector(".pilot-country");
    if (pilotCountryEl) {
        const safeCountry = event.pilotCountry ? event.pilotCountry.toLowerCase() : "un";
        pilotCountryEl.innerHTML = `<span class="fi fi-${safeCountry} fis"></span>`;
    }

    const pilotTeamEl = document.querySelector(".pilot-team");
    if (pilotTeamEl) {
        if (event.teamName && currentTeamDisplayMode !== "hidden") {
            pilotTeamEl.textContent = event.teamName;
            pilotTeamEl.style.color = event.teamColor || "#ffd54f";
            pilotTeamEl.style.display = "";
        } else {
            pilotTeamEl.style.display = "none";
        }
    }

    const shipModelEl = document.querySelector(".ship-model");
    if (shipModelEl) shipModelEl.textContent = event.shipModel || "";

    const chronoEl = document.querySelector(".event-chrono");
    if (chronoEl) {
        if (event.type === "incident" || event.type === "dnf") {
            chronoEl.textContent = "DNF";
        } else if (currentTimingEnabled && (event.lapFormatted || event.time)) {
            chronoEl.textContent = event.lapFormatted || event.time;
        } else {
            chronoEl.textContent = "—";
        }
    }

    setAlertStatus(event.type);
    row.style.display = "";
}

// Hide the alert row
function hideAlert() {
    const row = document.querySelector(".event-row");
    if (row) row.style.display = "none";
}

// Apply data-status attribute, icon and label text for the given event type
function setAlertStatus(type) {
    const row = document.querySelector(".event-row");
    const iconContainer = document.querySelector(".event-icon");
    const label = document.querySelector(".event-label");
    if (!row) return;

    // Map "dnf" to "incident" styling/label
    const displayType = type === "dnf" ? "incident" : type;
    row.setAttribute("data-status", displayType);
    if (RACE_ICONS[displayType]) iconContainer.innerHTML = RACE_ICONS[displayType];

    switch (displayType) {
        case "fastest-lap": label.textContent = "Fastest lap"; break;
        case "incident":    label.textContent = "Incident";    break;
        case "finished":    label.textContent = "Finished";    break;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    hideAlert();
});
