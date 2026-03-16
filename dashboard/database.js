// database.js

/** Export all data from the DB as a JSON file download */
async function exportData() {
    try {
        const [teams, vehicles, controls, pilots, racetracks] = await Promise.all([
            apiGet("/teams"),
            apiGet("/vehicles"),
            apiGet("/controls"),
            apiGet("/pilots"),
            apiGet("/racetracks"),
        ]);

        const data = { teams, vehicles, controls, pilots, racetracks };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `circus-racing-db-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("Export failed: " + (e.message || e));
    }
}

/** Open the file picker for JSON import */
function importData() {
    const fileInput = document.getElementById("import-file-input");
    if (fileInput) fileInput.click();
}

/**
 * Handle a JSON file import — posts entities to the API.
 * Accepts either the new format (exported from DB) or the legacy localStorage format.
 */
async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!confirm("Import data into the database? Existing entries with the same names may conflict.")) return;

            await _importDataToApi(data);
            await initDashboard();
            alert("Import complete!");
        } catch (err) {
            console.error("Import error:", err);
            alert("Import failed: " + (err.message || err));
        }
    };
    reader.readAsText(file);
    event.target.value = "";
}

/**
 * Migrate data from localStorage (old Circus Racing format) to the API.
 * Teams, vehicles, controls are created first; pilots are then created with
 * remapped IDs.
 */
async function migrateLocalData() {
    const rawTeams    = localStorage.getItem("circusRacing_teams");
    const rawShips    = localStorage.getItem("circusRacing_ships");
    const rawControls = localStorage.getItem("circusRacing_controls");
    const rawPilots   = localStorage.getItem("circusRacing_pilots");

    if (!rawTeams && !rawShips && !rawControls && !rawPilots) {
        alert("No local data found to migrate.");
        return;
    }

    if (!confirm("Migrate local storage data to the database?\n\nTeams, vehicles, controls and pilots will be created in the DB. Duplicates will be skipped.")) {
        return;
    }

    try {
        const localTeams    = rawTeams    ? JSON.parse(rawTeams)    : [];
        const localShips    = rawShips    ? JSON.parse(rawShips)    : [];
        const localControls = rawControls ? JSON.parse(rawControls) : [];
        const localPilots   = rawPilots   ? JSON.parse(rawPilots)   : [];

        await _importDataToApi({
            teams:    localTeams,
            // Map old "category" field to "type" (API format)
            vehicles: localShips.map((s) => ({ ...s, type: s.category || "ship" })),
            controls: localControls,
            pilots:   localPilots,
        }, { isLegacy: true });

        await initDashboard();
        alert("Migration complete! You can now clear local storage if you wish.");
    } catch (err) {
        console.error("Migration error:", err);
        alert("Migration failed: " + (err.message || err));
    }
}

/**
 * Internal helper: import a data payload into the API.
 * Handles ID remapping so pilots reference the new DB IDs.
 *
 * @param {Object} data  - { teams, vehicles, controls, pilots }
 * @param {Object} opts  - { isLegacy: boolean } — legacy format uses integer IDs
 */
async function _importDataToApi(data, opts = {}) {
    const teamMap    = new Map(); // oldId → newId
    const vehicleMap = new Map();
    const controlMap = new Map();

    // --- Teams ---
    for (const t of (data.teams || [])) {
        try {
            const created = await apiPost("/teams", {
                name:    t.name,
                acronym: t.acronym || t.name.substring(0, 3).toUpperCase(),
                color:   t.color  || "#90A4AE",
            });
            teamMap.set(String(t.id), created.id);
        } catch (e) {
            console.warn(`Skipped team "${t.name}":`, e.message);
        }
    }

    // --- Vehicles ---
    for (const v of (data.vehicles || [])) {
        try {
            const created = await apiPost("/vehicles", {
                model: v.model,
                type:  v.type || v.category || "ship",
                img:   v.img  || undefined,
            });
            vehicleMap.set(String(v.id), created.id);
        } catch (e) {
            console.warn(`Skipped vehicle "${v.model}":`, e.message);
        }
    }

    // --- Controls ---
    for (const c of (data.controls || [])) {
        try {
            const created = await apiPost("/controls", {
                type: c.type,
                img:  c.img || undefined,
            });
            controlMap.set(String(c.id), created.id);
        } catch (e) {
            console.warn(`Skipped control "${c.type}":`, e.message);
        }
    }

    // --- Pilots ---
    // Legacy format uses name/shipId/controlId; new format uses displayName/vehicleId/controlsId
    for (const p of (data.pilots || [])) {
        const displayName = p.displayName || p.name;
        if (!displayName) continue;

        // Remap IDs from old to new (for legacy migrations and DB re-imports)
        const oldTeamId    = p.teamId     ? String(p.teamId)    : null;
        const oldShipId    = p.vehicleId  ? String(p.vehicleId) : (p.shipId ? String(p.shipId) : null);
        const oldControlId = p.controlsId ? String(p.controlsId): (p.controlId ? String(p.controlId) : null);

        const body = {
            displayName,
            country:   p.country   || "un",
            teamId:    oldTeamId    ? (teamMap.get(oldTeamId)    ?? (opts.isLegacy ? undefined : oldTeamId))    : undefined,
            vehicleId: oldShipId    ? (vehicleMap.get(oldShipId) ?? (opts.isLegacy ? undefined : oldShipId))    : undefined,
            controlsId:oldControlId ? (controlMap.get(oldControlId) ?? (opts.isLegacy ? undefined : oldControlId)) : undefined,
            handleSC:  p.handleSC  || undefined,
            avatarUrl: p.avatarUrl || undefined,
        };

        try {
            await apiPost("/pilots", body);
        } catch (e) {
            console.warn(`Skipped pilot "${displayName}":`, e.message);
        }
    }
}

/** Clear localStorage (no longer the source of truth — DB is) */
function resetAllData() {
    if (confirm("Clear all local storage data?\n\nThis does NOT affect the database.")) {
        localStorage.clear();
        alert("Local storage cleared.");
    }
}
