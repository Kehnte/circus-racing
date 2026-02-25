// data-manager.js

// Function to export data as a JSON file
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

// Function to open a file input for importing data
function importData() {
    const fileInput = document.getElementById("import-file-input");
    if (fileInput) fileInput.click();
}

// Event handler function to handle the file selection and parsing
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            if (
                confirm(
                    "Import data? This will overwrite current settings and database.",
                )
            ) {
                // Import race settings
                if (data.raceSettings) {
                    const s = data.raceSettings;
                    if (s.raceName !== undefined)
                        document.getElementById("setting-race-name").value =
                            s.raceName;
                    if (s.session !== undefined)
                        document.getElementById("setting-session").value =
                            s.session;
                    if (s.weather !== undefined)
                        document.getElementById("setting-weather").value =
                            s.weather;
                    if (s.startType !== undefined)
                        document.getElementById("setting-start-type").value =
                            s.startType;
                    if (s.totalLaps !== undefined)
                        document.getElementById("total-laps").value =
                            s.totalLaps;
                }

                // Import database and ensure backward compatibility for nationality
                if (data.pilots) {
                    pilots = data.pilots.map((p) => ({
                        ...p,
                        country: p.country || "un", // Force 'un' if country is missing
                    }));
                }

                if (data.teams) teams = data.teams;
                if (data.ships) ships = data.ships;
                if (data.controls) {
                    if (typeof controlsList !== "undefined")
                        controlsList = data.controls;
                    if (typeof controls !== "undefined")
                        controls = data.controls;
                }

                // Save and refresh the display
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
    event.target.value = "";
}

// Function to reset all data by clearing local storage and reloading the page
function resetAllData() {
    if (confirm("Delete everything?")) {
        localStorage.clear();
        location.reload();
    }
}
