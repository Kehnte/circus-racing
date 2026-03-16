// storage.js
// Race-state persistence in localStorage (teams/vehicles/controls/pilots now come from the API).

// LocalStorage key constants — centralised to avoid typos across the codebase
const STORAGE_KEYS = {
    RACE_LIST: "circusRacing_raceList",
    SETTINGS: "circusRacing_settings",
    TEAM_DISPLAY_MODE: "circusRacing_teamDisplayMode",
    // Legacy keys — kept for the "Migrate local data" feature in database.js
    TEAMS: "circusRacing_teams",
    SHIPS: "circusRacing_ships",
    CONTROLS: "circusRacing_controls",
    PILOTS: "circusRacing_pilots",
};

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

// Convenience wrapper: save race settings + live race list in one call
function saveAllToLocal() {
    saveRaceSettings();
    try {
        if (typeof raceList !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.RACE_LIST, JSON.stringify(raceList));
        }
    } catch (error) {
        console.error("Error saving race list:", error);
    }
}

// Restore race settings fields and raceList from localStorage.
// Called by initDashboard() after auth is confirmed.
function loadRaceSettings() {
    // Restore team display mode
    try {
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

        // Apply to select + section visibility
        const teamSelect = document.getElementById("setting-team-display");
        if (teamSelect && typeof teamDisplayMode !== "undefined") {
            teamSelect.value = teamDisplayMode;
        }
        const teamSection = document.getElementById("teams-manager-section");
        if (teamSection && typeof teamDisplayMode !== "undefined") {
            teamSection.style.display = teamDisplayMode !== "hidden" ? "block" : "none";
        }
    } catch (error) {
        console.error("Error restoring team display mode:", error);
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

    // Render race table if function exists
    if (typeof displayRace === "function") displayRace();
    if (typeof updateControls === "function") updateControls();
}
