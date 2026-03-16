// database.js

// Fetch all DB data and trigger a JSON file download
async function exportData() {
    try {
        const [teams, vehicles, controls, pilots, racetracks] = await Promise.all([
            apiGet("/teams"),
            apiGet("/vehicles"),
            apiGet("/controls"),
            apiGet("/pilots"),
            apiGet("/racetracks"),
        ]);

        const blob = new Blob([JSON.stringify({ teams, vehicles, controls, pilots, racetracks }, null, 2)], { type: "application/json" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = `circus-racing-db-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("Export failed: " + (e.message || e));
    }
}

// Open the file picker for JSON import
function importData() {
    document.getElementById("import-file-input")?.click();
}

// Parse selected JSON file and import its contents into the DB
async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!confirm("Import data into the database? Entries with conflicting names will be skipped.")) return;
            await importPayloadToApi(data);
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

// Read legacy localStorage data and migrate it to the API
async function migrateLocalData() {
    const rawTeams    = localStorage.getItem("circusRacing_teams");
    const rawShips    = localStorage.getItem("circusRacing_ships");
    const rawControls = localStorage.getItem("circusRacing_controls");
    const rawPilots   = localStorage.getItem("circusRacing_pilots");

    if (!rawTeams && !rawShips && !rawControls && !rawPilots) {
        alert("No local data found to migrate.");
        return;
    }
    if (!confirm("Migrate local storage data to the database?\n\nDuplicates will be skipped.")) return;

    try {
        await importPayloadToApi({
            teams:    rawTeams    ? JSON.parse(rawTeams)    : [],
            // Map old "category" field to "type" expected by the API
            vehicles: rawShips    ? JSON.parse(rawShips).map((s) => ({ ...s, type: s.category || "ship" })) : [],
            controls: rawControls ? JSON.parse(rawControls) : [],
            pilots:   rawPilots   ? JSON.parse(rawPilots)   : [],
        }, true);

        await initDashboard();
        alert("Migration complete! Use 'Clear local storage' to remove legacy data.");
    } catch (err) {
        console.error("Migration error:", err);
        alert("Migration failed: " + (err.message || err));
    }
}

// POST entities to the API, remapping old IDs to new UUIDs for cross-references.
// isLegacy=true skips unresolved FK references (old integer IDs won't exist in DB).
async function importPayloadToApi(data, isLegacy = false) {
    const teamMap    = new Map(); // oldId → newUUID
    const vehicleMap = new Map();
    const controlMap = new Map();

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

    for (const v of (data.vehicles || [])) {
        try {
            const created = await apiPost("/vehicles", { model: v.model, type: v.type || v.category || "ship", img: v.img || undefined });
            vehicleMap.set(String(v.id), created.id);
        } catch (e) {
            console.warn(`Skipped vehicle "${v.model}":`, e.message);
        }
    }

    for (const c of (data.controls || [])) {
        try {
            const created = await apiPost("/controls", { type: c.type, img: c.img || undefined });
            controlMap.set(String(c.id), created.id);
        } catch (e) {
            console.warn(`Skipped control "${c.type}":`, e.message);
        }
    }

    for (const p of (data.pilots || [])) {
        const displayName = p.displayName || p.name;
        if (!displayName) continue;

        // Support both new format (vehicleId/controlsId) and legacy format (shipId/controlId)
        const oldTeamId    = p.teamId     ? String(p.teamId)     : null;
        const oldVehicleId = p.vehicleId  ? String(p.vehicleId)  : (p.shipId    ? String(p.shipId)    : null);
        const oldControlId = p.controlsId ? String(p.controlsId) : (p.controlId ? String(p.controlId) : null);

        const resolve = (oldId, map) => {
            if (!oldId) return undefined;
            const newId = map.get(oldId);
            // In legacy migrations the old integer ID won't be in the DB; skip the FK
            return newId ?? (isLegacy ? undefined : oldId);
        };

        try {
            await apiPost("/pilots", {
                displayName,
                country:   p.country   || "un",
                teamId:    resolve(oldTeamId,    teamMap),
                vehicleId: resolve(oldVehicleId, vehicleMap),
                controlsId:resolve(oldControlId, controlMap),
                avatarUrl: p.avatarUrl || undefined,
            });
        } catch (e) {
            console.warn(`Skipped pilot "${displayName}":`, e.message);
        }
    }
}

// Clear localStorage only — the DB is the source of truth now
function resetAllData() {
    if (confirm("Clear all local storage data?\n\nThis does NOT affect the database.")) {
        localStorage.clear();
        alert("Local storage cleared.");
    }
}
