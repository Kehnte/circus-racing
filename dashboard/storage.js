// storage.js

// LocalStorage key constants — centralised to avoid typos across the codebase
const STORAGE_KEYS = {
    TEAMS: "circusRacing_teams",
    SHIPS: "circusRacing_ships",
    CONTROLS: "circusRacing_controls",
    PILOTS: "circusRacing_pilots",
    RACE_LIST: "circusRacing_raceList",
    SETTINGS: "circusRacing_settings",
    TEAM_DISPLAY_MODE: "circusRacing_teamDisplayMode",
};

// Hydrate all in-memory arrays and flags from LocalStorage on page load
function loadFromStorage() {
    try {
        const savedTeams = localStorage.getItem(STORAGE_KEYS.TEAMS);
        if (savedTeams) teams = JSON.parse(savedTeams);

        const savedShips = localStorage.getItem(STORAGE_KEYS.SHIPS);
        if (savedShips) ships = JSON.parse(savedShips);

        const savedControls = localStorage.getItem(STORAGE_KEYS.CONTROLS);
        if (savedControls) controlsList = JSON.parse(savedControls);

        const savedPilots = localStorage.getItem(STORAGE_KEYS.PILOTS);
        if (savedPilots) pilots = JSON.parse(savedPilots);

        // Restore team display mode
        const savedTeamDisplayMode = localStorage.getItem(STORAGE_KEYS.TEAM_DISPLAY_MODE);
        if (savedTeamDisplayMode && typeof teamDisplayMode !== "undefined") {
            teamDisplayMode = savedTeamDisplayMode;
        }

        // Backward compat: migrate old boolean teamMgmt key
        const legacyTeamMgmt = localStorage.getItem("circusRacing_teamMgmt");
        if (legacyTeamMgmt !== null && !savedTeamDisplayMode) {
            teamDisplayMode = legacyTeamMgmt === "false" ? "hidden" : "color-bar";
            localStorage.removeItem("circusRacing_teamMgmt");
        }
    } catch (error) {
        console.error("Error loading from LocalStorage:", error);
    }
}

// Persist the four database arrays (teams, ships, controls, pilots) to LocalStorage
function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
        localStorage.setItem(STORAGE_KEYS.SHIPS, JSON.stringify(ships));
        localStorage.setItem(STORAGE_KEYS.CONTROLS, JSON.stringify(controlsList));
        localStorage.setItem(STORAGE_KEYS.PILOTS, JSON.stringify(pilots));
    } catch (error) {
        console.error("Error saving to LocalStorage:", error);
    }
}

// Read the race settings form and persist it alongside the team display mode
function saveRaceSettings() {
    try {
        const settings = {
            raceName: document.getElementById("setting-race-name")?.value ?? "",
            session: document.getElementById("setting-session")?.value ?? "",
            weather: document.getElementById("setting-weather")?.value ?? "",
            startType: document.getElementById("setting-start-type")?.value ?? "",
            totalLaps: document.getElementById("total-laps")?.value ?? "",
        };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        if (typeof teamDisplayMode !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.TEAM_DISPLAY_MODE, teamDisplayMode);
        }
    } catch (error) {
        console.error("Error saving race settings:", error);
    }
}

// Convenience wrapper: save everything (databases + settings + live race list) in one call
function saveAllToLocal() {
    saveToStorage();
    saveRaceSettings();
    try {
        if (typeof raceList !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.RACE_LIST, JSON.stringify(raceList));
        }
    } catch (error) {
        console.error("Error saving race list:", error);
    }
}

// Clear the teams array and its LocalStorage entry, then refresh all dependent UI
function resetTeams() {
    teams = [];
    localStorage.removeItem(STORAGE_KEYS.TEAMS);
    displayTeams();
    if (typeof updateTeamDropdown === "function") updateTeamDropdown();
    if (typeof displayPilots === "function") displayPilots();
}

// Clear the ships array and its LocalStorage entry, then refresh all dependent UI
function resetShips() {
    ships = [];
    localStorage.removeItem(STORAGE_KEYS.SHIPS);
    displayShips();
    if (typeof updateShipDropdown === "function") updateShipDropdown();
    if (typeof displayPilots === "function") displayPilots();
}

// Clear the controlsList array and its LocalStorage entry, then refresh all dependent UI
function resetControls() {
    controlsList = [];
    localStorage.removeItem(STORAGE_KEYS.CONTROLS);
    displayControls();
    if (typeof updateControlDropdown === "function") updateControlDropdown();
    if (typeof displayPilots === "function") displayPilots();
}

// Clear the pilots array and its LocalStorage entry, then refresh the pilots table
function resetPilots() {
    pilots = [];
    localStorage.removeItem(STORAGE_KEYS.PILOTS);
    displayPilots();
}

document.addEventListener("DOMContentLoaded", () => {
    // Restore all saved data before rendering any tables
    loadFromStorage();

    // Apply restored teamDisplayMode to the select element
    const teamSelect = document.getElementById("setting-team-display");
    if (teamSelect && typeof teamDisplayMode !== "undefined") {
        teamSelect.value = teamDisplayMode;
    }

    // Apply teams section visibility and table class on load
    const teamSection = document.getElementById("teams-manager-section");
    if (teamSection && typeof teamDisplayMode !== "undefined") {
        teamSection.style.display = teamDisplayMode !== "hidden" ? "block" : "none";
    }

    // Restore race settings fields
    try {
        const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (savedSettings) {
            const s = JSON.parse(savedSettings);
            setTimeout(() => {
                if (s.raceName !== undefined) {
                    const el = document.getElementById("setting-race-name");
                    if (el) el.value = s.raceName;
                }
                if (s.session !== undefined) {
                    const el = document.getElementById("setting-session");
                    if (el) el.value = s.session;
                }
                if (s.weather !== undefined) {
                    const el = document.getElementById("setting-weather");
                    if (el) el.value = s.weather;
                }
                if (s.startType !== undefined) {
                    const el = document.getElementById("setting-start-type");
                    if (el) el.value = s.startType;
                }
                if (s.totalLaps !== undefined) {
                    const el = document.getElementById("total-laps");
                    if (el) el.value = s.totalLaps;
                }
            }, 50);
        }
    } catch (error) {
        console.error("Error restoring race settings:", error);
    }

    // Restore raceList if available
    try {
        const savedRaceList = localStorage.getItem(STORAGE_KEYS.RACE_LIST);
        if (savedRaceList && typeof raceList !== "undefined") {
            raceList = JSON.parse(savedRaceList);
        }
    } catch (error) {
        console.error("Error restoring race list:", error);
    }

    // Render all tables
    if (typeof displayTeams === "function") displayTeams();
    if (typeof displayShips === "function") displayShips();
    if (typeof displayControls === "function") displayControls();
    if (typeof displayPilots === "function") displayPilots();
    if (typeof displayRace === "function") displayRace();
    if (typeof updateControls === "function") updateControls();
});
