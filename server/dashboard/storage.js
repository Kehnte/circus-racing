// storage.js — race-state persistence in localStorage
// teams, vehicles, controls and pilots are sourced from the API, not stored here

const STORAGE_KEYS = {
    RACE_LIST:         "circusRacing_raceList",
    SETTINGS:          "circusRacing_settings",
    TEAM_DISPLAY_MODE: "circusRacing_teamDisplayMode",
    // legacy keys used by migrateLocalData() in database.js
    TEAMS:    "circusRacing_teams",
    SHIPS:    "circusRacing_ships",
    CONTROLS: "circusRacing_controls",
    PILOTS:   "circusRacing_pilots",
};

// persist the race settings form values and team display mode
function saveRaceSettings() {
    try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
            raceName:  document.getElementById("setting-race-name")?.value  ?? "",
            session:   document.getElementById("setting-session")?.value    ?? "",
            weather:   document.getElementById("setting-weather")?.value    ?? "",
            startType: document.getElementById("setting-start-type")?.value ?? "",
            totalLaps: document.getElementById("total-laps")?.value         ?? "",
        }));
        if (typeof teamDisplayMode !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.TEAM_DISPLAY_MODE, teamDisplayMode);
        }
    } catch (e) {
        console.error("Error saving race settings:", e);
    }
}

// persist race settings and live raceList
function saveAllToLocal() {
    saveRaceSettings();
    try {
        if (typeof raceList !== "undefined") {
            localStorage.setItem(STORAGE_KEYS.RACE_LIST, JSON.stringify(raceList));
        }
    } catch (e) {
        console.error("Error saving race list:", e);
    }
}

// restore race settings, team display mode and raceList from localStorage
function loadRaceSettings() {
    try {
        const saved  = localStorage.getItem(STORAGE_KEYS.TEAM_DISPLAY_MODE);
        const legacy = localStorage.getItem("circusRacing_teamMgmt");

        if (typeof teamDisplayMode !== "undefined") {
            if (saved) {
                teamDisplayMode = saved;
            } else if (legacy !== null) {
                // migrate old boolean key to the new string format
                teamDisplayMode = legacy === "false" ? "hidden" : "color-bar";
                localStorage.removeItem("circusRacing_teamMgmt");
            }
        }

        const teamSelect  = document.getElementById("setting-team-display");
        const teamSection = document.getElementById("teams-manager-section");
        if (teamSelect  && typeof teamDisplayMode !== "undefined") teamSelect.value = teamDisplayMode;
        if (teamSection && typeof teamDisplayMode !== "undefined") {
            teamSection.style.display = teamDisplayMode !== "hidden" ? "block" : "none";
        }
    } catch (e) {
        console.error("Error restoring team display mode:", e);
    }

    try {
        const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (saved) {
            const s = JSON.parse(saved);
            // deferred so md-* elements are ready
            setTimeout(() => {
                const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
                set("setting-race-name",  s.raceName);
                set("setting-session",    s.session);
                set("setting-weather",    s.weather);
                set("setting-start-type", s.startType);
                set("total-laps",         s.totalLaps);
            }, 50);
        }
    } catch (e) {
        console.error("Error restoring race settings:", e);
    }

    try {
        const saved = localStorage.getItem(STORAGE_KEYS.RACE_LIST);
        if (saved && typeof raceList !== "undefined") raceList = JSON.parse(saved);
    } catch (e) {
        console.error("Error restoring race list:", e);
    }

    if (typeof displayRace    === "function") displayRace();
    if (typeof updateControls === "function") updateControls();
}
