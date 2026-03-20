"use strict";
// snapshot-refresh.ts — Re-captures race entry snapshots when source entities change.
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTeamSnapshots = refreshTeamSnapshots;
exports.refreshVehicleSnapshots = refreshVehicleSnapshots;
exports.refreshControlsSnapshots = refreshControlsSnapshots;
exports.refreshPilotEntrySnapshots = refreshPilotEntrySnapshots;
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
const race_context_js_1 = require("./race-context.js");
const emitter_js_1 = require("../socket/emitter.js");
// Only refresh entries in races that are not finished
async function activeEntryIdsForPilots(pilotIds) {
    if (pilotIds.length === 0)
        return [];
    const results = [];
    for (const pid of pilotIds) {
        const entries = await db_js_1.db
            .select({ entryId: schema_js_1.raceEntry.id, pilotId: schema_js_1.raceEntry.pilotId, raceId: schema_js_1.raceEntry.raceId })
            .from(schema_js_1.raceEntry)
            .innerJoin(schema_js_1.race, (0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, schema_js_1.race.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.pilotId, pid), (0, drizzle_orm_1.eq)(schema_js_1.raceEntry.status, "VALIDATED"), (0, drizzle_orm_1.ne)(schema_js_1.race.status, "FINISHED")))
            .all();
        results.push(...entries);
    }
    return results;
}
function patchLiveContext(pilotId, patch) {
    const ctx = (0, race_context_js_1.getContext)();
    if (!ctx)
        return false;
    const profile = ctx.pilotProfiles[pilotId];
    if (!profile)
        return false;
    Object.assign(profile, patch);
    return true;
}
async function refreshTeamSnapshots(teamId) {
    const teamRow = await db_js_1.db.select().from(schema_js_1.team).where((0, drizzle_orm_1.eq)(schema_js_1.team.id, teamId)).get();
    if (!teamRow)
        return;
    const pilotsWithTeam = await db_js_1.db
        .select({ id: schema_js_1.pilot.id })
        .from(schema_js_1.pilot)
        .where((0, drizzle_orm_1.eq)(schema_js_1.pilot.teamId, teamId))
        .all();
    const entries = await activeEntryIdsForPilots(pilotsWithTeam.map(p => p.id));
    if (entries.length === 0)
        return;
    const snap = { ...teamRow };
    let ctxChanged = false;
    for (const entry of entries) {
        await db_js_1.db.update(schema_js_1.raceEntry)
            .set({ teamSnapshot: snap })
            .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, entry.entryId));
        if (patchLiveContext(entry.pilotId, { teamSnapshot: snap }))
            ctxChanged = true;
    }
    if (ctxChanged) {
        const ctx = (0, race_context_js_1.getContext)();
        (0, emitter_js_1.broadcastRaceState)(ctx);
    }
}
async function refreshVehicleSnapshots(vehicleId) {
    const vehicleRow = await db_js_1.db.select().from(schema_js_1.vehicle).where((0, drizzle_orm_1.eq)(schema_js_1.vehicle.id, vehicleId)).get();
    if (!vehicleRow)
        return;
    const pilotsWithVehicle = await db_js_1.db
        .select({ id: schema_js_1.pilot.id })
        .from(schema_js_1.pilot)
        .where((0, drizzle_orm_1.eq)(schema_js_1.pilot.vehicleId, vehicleId))
        .all();
    const entries = await activeEntryIdsForPilots(pilotsWithVehicle.map(p => p.id));
    if (entries.length === 0)
        return;
    const snap = { ...vehicleRow };
    let ctxChanged = false;
    for (const entry of entries) {
        await db_js_1.db.update(schema_js_1.raceEntry)
            .set({ vehicleSnapshot: snap })
            .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, entry.entryId));
        if (patchLiveContext(entry.pilotId, { vehicleSnapshot: snap }))
            ctxChanged = true;
    }
    if (ctxChanged) {
        const ctx = (0, race_context_js_1.getContext)();
        (0, emitter_js_1.broadcastRaceState)(ctx);
    }
}
async function refreshControlsSnapshots(controlsId) {
    const controlsRow = await db_js_1.db.select().from(schema_js_1.controls).where((0, drizzle_orm_1.eq)(schema_js_1.controls.id, controlsId)).get();
    if (!controlsRow)
        return;
    const pilotsWithControls = await db_js_1.db
        .select({ id: schema_js_1.pilot.id })
        .from(schema_js_1.pilot)
        .where((0, drizzle_orm_1.eq)(schema_js_1.pilot.controlsId, controlsId))
        .all();
    const entries = await activeEntryIdsForPilots(pilotsWithControls.map(p => p.id));
    if (entries.length === 0)
        return;
    const snap = { ...controlsRow };
    let ctxChanged = false;
    for (const entry of entries) {
        await db_js_1.db.update(schema_js_1.raceEntry)
            .set({ controlsSnapshot: snap })
            .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, entry.entryId));
        if (patchLiveContext(entry.pilotId, { controlsSnapshot: snap }))
            ctxChanged = true;
    }
    if (ctxChanged) {
        const ctx = (0, race_context_js_1.getContext)();
        (0, emitter_js_1.broadcastRaceState)(ctx);
    }
}
async function refreshPilotEntrySnapshots(pilotId) {
    const p = await db_js_1.db.select().from(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, pilotId)).get();
    if (!p)
        return;
    const entries = await activeEntryIdsForPilots([pilotId]);
    if (entries.length === 0)
        return;
    const teamSnap = p.teamId
        ? await db_js_1.db.select().from(schema_js_1.team).where((0, drizzle_orm_1.eq)(schema_js_1.team.id, p.teamId)).get() ?? null
        : null;
    const vehicleSnap = p.vehicleId
        ? await db_js_1.db.select().from(schema_js_1.vehicle).where((0, drizzle_orm_1.eq)(schema_js_1.vehicle.id, p.vehicleId)).get() ?? null
        : null;
    const controlsSnap = p.controlsId
        ? await db_js_1.db.select().from(schema_js_1.controls).where((0, drizzle_orm_1.eq)(schema_js_1.controls.id, p.controlsId)).get() ?? null
        : null;
    let ctxChanged = false;
    for (const entry of entries) {
        await db_js_1.db.update(schema_js_1.raceEntry)
            .set({
            teamSnapshot: teamSnap ? { ...teamSnap } : null,
            vehicleSnapshot: vehicleSnap ? { ...vehicleSnap } : null,
            controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
        })
            .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, entry.entryId));
        const patched = patchLiveContext(pilotId, {
            displayName: p.displayName,
            country: p.country ?? "un",
            teamSnapshot: teamSnap ? { ...teamSnap } : null,
            vehicleSnapshot: vehicleSnap ? { ...vehicleSnap } : null,
            controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
        });
        if (patched)
            ctxChanged = true;
    }
    if (ctxChanged) {
        const ctx = (0, race_context_js_1.getContext)();
        (0, emitter_js_1.broadcastRaceState)(ctx);
    }
}
//# sourceMappingURL=snapshot-refresh.js.map