const STORAGE_KEYS = {
    TEAMS: "circusRacing_teams",
    SHIPS: "circusRacing_ships",
    CONTROLS: "circusRacing_controls",
    PILOTS: "circusRacing_pilots",
    RACE_LIST: "circusRacing_raceList",
    SETTINGS: "circusRacing_settings",
    TEAM_MGMT: "circusRacing_teamMgmt",
};

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

// Updated to handle Weather and remove Location
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

function resetTeams() {
    if (confirm("Are you sure you want to delete all teams?")) {
        teams = [];
        localStorage.removeItem(STORAGE_KEYS.TEAMS);
        displayTeams();
        if (typeof updateTeamDropdown === "function") updateTeamDropdown();
        if (typeof displayPilots === "function") displayPilots();
    }
}

function resetShips() {
    if (confirm("Are you sure you want to delete all ships?")) {
        ships = [];
        localStorage.removeItem(STORAGE_KEYS.SHIPS);
        displayShips();
        if (typeof updateShipDropdown === "function") updateShipDropdown();
        if (typeof displayPilots === "function") displayPilots();
    }
}

function resetControls() {
    if (confirm("Are you sure you want to delete all controls?")) {
        controlsList = [];
        localStorage.removeItem(STORAGE_KEYS.CONTROLS);
        displayControls();
        if (typeof updateControlDropdown === "function")
            updateControlDropdown();
        if (typeof displayPilots === "function") displayPilots();
    }
}

function resetPilots() {
    if (confirm("Are you sure you want to delete all pilots?")) {
        pilots = [];
        localStorage.removeItem(STORAGE_KEYS.PILOTS);
        displayPilots();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadFromStorage();

    if (typeof displayTeams === "function") displayTeams();
    if (typeof displayShips === "function") displayShips();
    if (typeof displayControls === "function") displayControls();
    if (typeof displayPilots === "function") displayPilots();

    if (typeof updateTeamDropdown === "function") updateTeamDropdown();
    if (typeof updateShipDropdown === "function") updateShipDropdown();
    if (typeof updateControlDropdown === "function") updateControlDropdown();

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