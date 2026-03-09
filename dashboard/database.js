// database.js

// Serialize the full application state (settings + all databases) to a JSON file and trigger a browser download with a timestamped filename
function exportData() {
    try {
        const data = {
            raceSettings: {
                raceName: document.getElementById("setting-race-name").value,
                session: document.getElementById("setting-session").value,
                weather: document.getElementById("setting-weather").value,
                startType: document.getElementById("setting-start-type").value,
                totalLaps: document.getElementById("total-laps").value,
            },
            pilots: typeof pilots !== "undefined" ? pilots : [],
            teams: typeof teams !== "undefined" ? teams : [],
            ships: typeof ships !== "undefined" ? ships : [],
            controls:
                typeof controlsList !== "undefined"
                    ? controlsList
                    : typeof controls !== "undefined"
                      ? controls
                      : [],
        };

        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const timestamp = new Date().toISOString().split("T")[0];
        a.download = `circus-racing-full-data-${timestamp}.json`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Export failed:", error);
    }
}

// Programmatically click the hidden file input to open the system file picker
function importData() {
    const fileInput = document.getElementById("import-file-input");
    if (fileInput) fileInput.click();
}

// Handle the file selected by the user: parse the JSON and overwrite the current state
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            if (confirm("Import data? This will overwrite current settings and database.")) {
                // Restore race settings fields from the imported object
                if (data.raceSettings) {
                    const s = data.raceSettings;
                    if (s.raceName !== undefined)
                        document.getElementById("setting-race-name").value = s.raceName;
                    if (s.session !== undefined)
                        document.getElementById("setting-session").value = s.session;
                    if (s.weather !== undefined)
                        document.getElementById("setting-weather").value = s.weather;
                    if (s.startType !== undefined)
                        document.getElementById("setting-start-type").value = s.startType;
                    if (s.totalLaps !== undefined)
                        document.getElementById("total-laps").value = s.totalLaps;
                }

                // Restore pilots with backward compatibility
                if (data.pilots) {
                    pilots = data.pilots.map((p) => ({
                        ...p,
                        country: p.country || "un",
                    }));
                }

                if (data.teams) teams = data.teams;
                if (data.ships) ships = data.ships;
                if (data.controls) {
                    if (typeof controlsList !== "undefined") controlsList = data.controls;
                    if (typeof controls !== "undefined") controls = data.controls;
                }

                // Persist and re-render everything
                if (typeof saveAllToLocal === "function") saveAllToLocal();
                if (typeof displayRace === "function") displayRace();
                if (typeof displayPilots === "function") displayPilots();
                if (typeof displayTeams === "function") displayTeams();
                if (typeof displayShips === "function") displayShips();
                if (typeof displayControls === "function") displayControls();

                alert("All data and settings imported!");
            }
        } catch (error) {
            console.error("Import error:", error);
            alert("Error reading file.");
        }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be re-imported if needed
    event.target.value = "";
}

// Wipe LocalStorage and reload the page, effectively resetting the entire application
function resetAllData() {
    if (confirm("Delete everything?")) {
        localStorage.clear();
        location.reload();
    }
}
