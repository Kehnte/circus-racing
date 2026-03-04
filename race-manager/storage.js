// storage.js

// LocalStorage key constants — centralised to avoid typos across the codebase
const STORAGE_KEYS = {
    TEAMS: "circusRacing_teams",
    SHIPS: "circusRacing_ships",
    CONTROLS: "circusRacing_controls",
    PILOTS: "circusRacing_pilots",
    RACE_LIST: "circusRacing_raceList",
    SETTINGS: "circusRacing_settings",
    TEAM_MGMT: "circusRacing_teamMgmt",
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

        // Restore the team management toggle state (stored as the string "true"/"false")
        const savedTeamMgmt = localStorage.getItem(STORAGE_KEYS.TEAM_MGMT);
        if (
            savedTeamMgmt !== null &&
            typeof isTeamManagementActive !== "undefined"
        ) {
            isTeamManagementActive = savedTeamMgmt !== "false";
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
        localStorage.setItem(
            STORAGE_KEYS.CONTROLS,
            JSON.stringify(controlsList),
        );
        localStorage.setItem(STORAGE_KEYS.PILOTS, JSON.stringify(pilots));
    } catch (error) {
        console.error("Error saving to LocalStorage:", error);
    }
}

// Read the race settings form and persist it alongside the team management flag
function saveRaceSettings() {
    try {
        const settings = {
            raceName: document.getElementById("setting-race-name")?.value ?? "",
            session: document.getElementById("setting-session")?.value ?? "",
            weather: document.getElementById("setting-weather")?.value ?? "",
            startType:
                document.getElementById("setting-start-type")?.value ?? "",
            totalLaps: document.getElementById("total-laps")?.value ?? "",
        };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        if (typeof isTeamManagementActive !== "undefined") {
            localStorage.setItem(
                STORAGE_KEYS.TEAM_MGMT,
                String(isTeamManagementActive),
            );
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
            localStorage.setItem(
                STORAGE_KEYS.RACE_LIST,
                JSON.stringify(raceList),
            );
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

    if (typeof displayTeams === "function") displayTeams();
    if (typeof displayShips === "function") displayShips();
    if (typeof displayControls === "function") displayControls();
    if (typeof displayPilots === "function") displayPilots();

    if (typeof updateTeamDropdown === "function") updateTeamDropdown();
    if (typeof updateShipDropdown === "function") updateShipDropdown();
    if (typeof updateControlDropdown === "function") updateControlDropdown();

    // Auto-save race settings (and re-broadcast race state) whenever any setting changes
    [
        "setting-race-name",
        "setting-session",
        "setting-weather",
        "setting-start-type",
        "total-laps",
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", () => {
            saveRaceSettings();
            if (typeof displayRace === "function") displayRace();
        });
    });
});