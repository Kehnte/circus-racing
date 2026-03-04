// event-row.js

const socket = io();

// Event queue and display state
let eventQueue = [];
let isDisplaying = false;
let displayTimer = null;

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

    // Update pilot info
    const pilotNameEl = document.querySelector(".pilot-name");
    const pilotCountryEl = document.querySelector(".pilot-country");
    const pilotTeamEl = document.querySelector(".pilot-team");

    if (pilotNameEl) pilotNameEl.textContent = event.pilotName || "";

    if (pilotCountryEl) {
        const safeCountry = event.pilotCountry ? event.pilotCountry.toLowerCase() : "un";
        pilotCountryEl.innerHTML = `<span class="fi fi-${safeCountry} fis"></span>`;
    }

    if (pilotTeamEl) {
        if (event.teamName) {
            pilotTeamEl.textContent = event.teamName;
            pilotTeamEl.style.color = event.teamColor || "#ffd54f";
            pilotTeamEl.style.display = "";
        } else {
            pilotTeamEl.style.display = "none";
        }
    }

    const shipModelEl = document.querySelector(".ship-model");
    if (shipModelEl) {
        shipModelEl.textContent = event.shipModel || "";
    }

    // Update status, icon, label, result
    setEventStatus(event.type, event.time || "");

    // Show the row
    row.style.display = "";
}

// Hide the event row
function hideEventRow() {
    const row = document.querySelector(".event-row");
    if (row) row.style.display = "none";
}

// Update icon, label and result based on event type
function setEventStatus(type, timeValue = "") {
    const row = document.querySelector(".event-row");
    const iconContainer = document.querySelector(".event-icon");
    const label = document.querySelector(".event-label");
    const result = document.querySelector(".event-result");

    if (!row) return;

    row.setAttribute("data-status", type);

    if (RACE_ICONS[type]) {
        iconContainer.innerHTML = RACE_ICONS[type];
    }

    switch (type) {
        case "fastest-lap":
            label.textContent = "Fastest lap";
            result.textContent = timeValue || "00:00.000";
            break;
        case "incident":
            label.textContent = "Incident";
            result.textContent = "DNF";
            break;
        case "finished":
            label.textContent = "Finished";
            result.textContent = timeValue || "";
            break;
    }
}

// Hide on load — shown only when an event arrives
document.addEventListener("DOMContentLoaded", () => {
    hideEventRow();
});