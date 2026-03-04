// event-row.js

const socket = io();

const icons = {
    "fastest-lap": `
        <svg width="50" height="50" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 40C30.9413 40 40 30.9217 40 20C40 9.05884 30.9608 0 20.0196 0C18.9805 0 18.4707 0.627452 18.4707 1.64706V9.23531C18.4707 10.0981 19.0588 10.7647 19.9019 10.7647C20.7648 10.7647 21.353 10.0981 21.353 9.23531V1.60785L19.9804 3.33334C29.2746 3.33334 36.6471 10.7451 36.6471 20C36.6471 29.255 29.255 36.6668 20 36.6668C10.7451 36.6668 3.31373 29.255 3.33334 20C3.35295 15.8628 4.82353 12.1177 7.29414 9.23531C7.88237 8.4706 7.92159 7.54904 7.27453 6.86275C6.62747 6.17649 5.54904 6.2353 4.82354 7.09806C1.84314 10.5882 0 15.1177 0 20C0 30.9217 9.07845 40 20 40Z" fill="white"/>
            <path d="M23.1375 22.8238C24.6866 21.1965 24.3728 19.02 22.5101 17.7259L12.1375 10.4709C11.1571 9.78465 10.1375 10.8239 10.8238 11.7847L18.0592 22.1572C19.3728 24.02 21.5493 24.3533 23.1375 22.8238Z" fill="white"/>
        </svg>`,
    incident: `
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.9898 40C30.9175 40 40 30.9333 40 20C40 9.06666 30.9175 0 19.9691 0C9.04142 0 0 9.04614 0 20C0 30.9333 9.06206 40 19.9898 40ZM19.9898 36.5128C10.8457 36.5128 3.50588 29.1692 3.50588 20C3.50588 10.8102 10.8252 3.46666 19.9691 3.46666C29.1337 3.46666 36.4939 10.8102 36.5146 20C36.5351 29.1486 29.1748 36.5128 19.9898 36.5128Z" fill="white"/>
            <path d="M19.9692 23.6923C20.9533 23.6923 21.5068 23.1385 21.5275 22.0718L21.8349 11.241C21.8555 10.1948 21.0353 9.41537 19.9487 9.41537C18.8416 9.41537 18.0625 10.1743 18.083 11.2205L18.3496 22.0718C18.3701 23.1178 18.9441 23.6923 19.9692 23.6923ZM19.9692 30.359C21.1379 30.359 22.1629 29.4153 22.1629 28.2256C22.1629 27.0358 21.1583 26.0922 19.9692 26.0922C18.7595 26.0922 17.755 27.0563 17.755 28.2256C17.755 29.3949 18.78 30.359 19.9692 30.359Z" fill="white"/>
        </svg>`,
    finished: `
        <svg width="70" height="70" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 10H10V20H0V10Z" fill="white"/><path d="M20 10H30V20H20V10Z" fill="white"/><path d="M10 10H20V20H10V10Z" fill="black"/><path d="M0 20H10V30H0V20Z" fill="black"/><path d="M10 20H20V30H10V20Z" fill="white"/><path d="M20 20H30V30H20V20Z" fill="black"/><path d="M0 0H10V10H0V0Z" fill="black"/><path d="M10 0H20V10H10V0Z" fill="white"/><path d="M20 0H30V10H20V0Z" fill="black"/><path d="M0 30H10V40H0V30Z" fill="white"/><path d="M20 30H30V40H20V30Z" fill="white"/><path d="M10 30H20V40H10V30Z" fill="black"/><path d="M0 40H10V50H0V40Z" fill="black"/><path d="M10 40H20V50H10V40Z" fill="white"/><path d="M20 40H30V50H20V40Z" fill="black"/><path d="M30 0H40V10H30V0Z" fill="white"/><path d="M40 0H50V10H40V0Z" fill="black"/><path d="M30 10H40V20H30V10Z" fill="black"/><path d="M40 10H50V20H40V10Z" fill="white"/><path d="M30 20H40V30H30V20Z" fill="white"/><path d="M40 20H50V30H40V20Z" fill="black"/><path d="M30 40H40V50H30V40Z" fill="white"/><path d="M40 40H50V50H40V40Z" fill="black"/><path d="M30 30H40V40H30V30Z" fill="black"/><path d="M40 30H50V40H40V30Z" fill="white"/>
        </svg>`,
};

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

    if (icons[type]) {
        iconContainer.innerHTML = icons[type];
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