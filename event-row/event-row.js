// event-row.js

const socket = io();

// Event queue and display state
let eventQueue = [];
let isDisplaying = false;
let displayTimer = null;

// Current settings received from race-update broadcasts
let currentTeamDisplayMode = "color-bar";
let currentTimingEnabled = true;

// Listen for race state to keep team/timing settings in sync
socket.on("race-data", (data) => {
    if (data.teamDisplayMode !== undefined) currentTeamDisplayMode = data.teamDisplayMode;
    if (data.timingEnabled !== undefined) currentTimingEnabled = data.timingEnabled;
});

// Listen for race events from the server
socket.on("race-event", (event) => {
    eventQueue.push(event);
    if (!isDisplaying) processQueue();
});

// Process the next event in the queue
function processQueue() {
    if (eventQueue.length === 0) {
        isDisplaying = false;
        hideEventRow();
        return;
    }

    isDisplaying = true;
    const event = eventQueue.shift();
    showEvent(event);

    const duration = (event.displayDuration && event.displayDuration >= 1 ? event.displayDuration : 5) * 1000;
    displayTimer = setTimeout(() => {
        processQueue();
    }, duration);
}

// Show an event in the row
function showEvent(event) {
    const row = document.querySelector(".event-row");
    if (!row) return;

    // Pilot name
    const pilotNameEl = document.querySelector(".pilot-name");
    if (pilotNameEl) pilotNameEl.textContent = event.pilotName || "";

    // Pilot country
    const pilotCountryEl = document.querySelector(".pilot-country");
    if (pilotCountryEl) {
        const safeCountry = event.pilotCountry ? event.pilotCountry.toLowerCase() : "un";
        pilotCountryEl.innerHTML = `<span class="fi fi-${safeCountry} fis"></span>`;
    }

    // Pilot team — respect teamDisplayMode
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

    // Ship model
    const shipModelEl = document.querySelector(".ship-model");
    if (shipModelEl) shipModelEl.textContent = event.shipModel || "";

    // Chrono frame — always present, shows time, DNF, or "—"
    const chronoEl = document.querySelector(".event-chrono");
    if (chronoEl) {
        if (event.type === "incident") {
            chronoEl.textContent = "DNF";
        } else if (currentTimingEnabled && event.time) {
            chronoEl.textContent = event.time;
        } else {
            chronoEl.textContent = "—";
        }
    }

    // Update status, icon, label
    setEventStatus(event.type);

    row.style.display = "";
}

// Hide the event row
function hideEventRow() {
    const row = document.querySelector(".event-row");
    if (row) row.style.display = "none";
}

// Update icon and label based on event type
function setEventStatus(type) {
    const row = document.querySelector(".event-row");
    const iconContainer = document.querySelector(".event-icon");
    const label = document.querySelector(".event-label");

    if (!row) return;

    row.setAttribute("data-status", type);

    if (RACE_ICONS[type]) {
        iconContainer.innerHTML = RACE_ICONS[type];
    }

    switch (type) {
        case "fastest-lap":
            label.textContent = "Fastest lap";
            break;
        case "incident":
            label.textContent = "Incident";
            break;
        case "finished":
            label.textContent = "Finished";
            break;
    }
}

// Hide on load
document.addEventListener("DOMContentLoaded", () => {
    hideEventRow();
});