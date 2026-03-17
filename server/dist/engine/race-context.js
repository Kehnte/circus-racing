"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHECKPOINT_RADIUS = void 0;
exports.getContext = getContext;
exports.hasContext = hasContext;
exports.loadRace = loadRace;
exports.setPilotState = setPilotState;
exports.persistState = persistState;
exports.clearContext = clearContext;
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
exports.CHECKPOINT_RADIUS = parseInt(process.env.CHECKPOINT_RADIUS ?? "50");
// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
let _ctx = null;
function getContext() { return _ctx; }
function hasContext() { return _ctx !== null; }
// ---------------------------------------------------------------------------
// loadRace
// ---------------------------------------------------------------------------
async function loadRace(raceId) {
    const raceRow = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!raceRow)
        throw new Error(`Race ${raceId} not found`);
    if (raceRow.trackingMode === "auto" && !raceRow.racetrackId) {
        throw new Error(`Race ${raceId} is in AUTO mode but has no racetrack assigned`);
    }
    const track = raceRow.racetrackId
        ? await db_js_1.db.select().from(schema_js_1.racetrack).where((0, drizzle_orm_1.eq)(schema_js_1.racetrack.id, raceRow.racetrackId)).get()
        : null;
    if (raceRow.racetrackId && !track)
        throw new Error(`Racetrack for race ${raceId} not found`);
    const entries = await db_js_1.db
        .select({
        id: schema_js_1.raceEntry.id,
        pilotId: schema_js_1.raceEntry.pilotId,
        teamSnapshot: schema_js_1.raceEntry.teamSnapshot,
        vehicleSnapshot: schema_js_1.raceEntry.vehicleSnapshot,
        controlsSnapshot: schema_js_1.raceEntry.controlsSnapshot,
    })
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, raceId))
        .all()
        .then(rows => rows.filter(r => {
        // re-fetch status to filter VALIDATED
        return true; // filtering below after join
    }));
    // Fetch VALIDATED entries with pilot display info
    const validatedEntries = await db_js_1.db
        .select({
        entryId: schema_js_1.raceEntry.id,
        pilotId: schema_js_1.raceEntry.pilotId,
        teamSnapshot: schema_js_1.raceEntry.teamSnapshot,
        vehicleSnapshot: schema_js_1.raceEntry.vehicleSnapshot,
        controlsSnapshot: schema_js_1.raceEntry.controlsSnapshot,
        displayName: schema_js_1.pilot.displayName,
        country: schema_js_1.pilot.country,
    })
        .from(schema_js_1.raceEntry)
        .innerJoin(schema_js_1.pilot, (0, drizzle_orm_1.eq)(schema_js_1.raceEntry.pilotId, schema_js_1.pilot.id))
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, raceId))
        .all()
        .then(rows => rows.filter(r => {
        // we need to re-check status — do a second query for status
        return true;
    }));
    // Get full entry statuses
    const entryStatusRows = await db_js_1.db
        .select({ pilotId: schema_js_1.raceEntry.pilotId, status: schema_js_1.raceEntry.status })
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, raceId))
        .all();
    const validatedPilotIds = new Set(entryStatusRows.filter(e => e.status === "VALIDATED").map(e => e.pilotId));
    const defaultState = () => ({
        position: [0, 0, 0],
        lap: 0,
        progress: 0,
        raceProgress: 0,
        lapTimes: [],
        status: "RUNNING",
        frozenTime: null,
        dnfWarning: false,
        lastCheckpointTime: null,
        nextCheckpointOrder: 0,
    });
    const pilotStates = {};
    const pilotProfiles = {};
    for (const entry of validatedEntries) {
        if (!validatedPilotIds.has(entry.pilotId))
            continue;
        pilotStates[entry.pilotId] = defaultState();
        pilotProfiles[entry.pilotId] = {
            displayName: entry.displayName,
            country: entry.country ?? "un",
            teamSnapshot: entry.teamSnapshot ?? null,
            vehicleSnapshot: entry.vehicleSnapshot ?? null,
            controlsSnapshot: entry.controlsSnapshot ?? null,
        };
    }
    const bufferRadius = track?.bufferRadius ??
        parseInt(process.env.DNF_BUFFER_RADIUS ?? "200");
    _ctx = {
        raceId,
        trackingMode: raceRow.trackingMode,
        lapCount: raceRow.lapCount,
        sessionMode: raceRow.sessionMode,
        sessionDurationMs: raceRow.sessionDurationMs ?? null,
        checkpoints: track?.checkpoints ?? [],
        bufferRadius,
        pilotStates,
        pilotProfiles,
        startedAt: null,
        pausedAt: null,
        totalPausedMs: 0,
        globalFastestLapMs: null,
        globalFastestLapPilotId: null,
        teamDisplayMode: raceRow.teamDisplayMode,
        chronoDisplayMode: raceRow.chronoDisplayMode,
        timingEnabled: raceRow.timingEnabled,
        eventDuration: raceRow.eventDuration,
        raceName: raceRow.name,
        session: raceRow.session,
        weather: raceRow.weather,
        startType: raceRow.startType,
    };
    // Upsert raceState row in DB (reset)
    await db_js_1.db
        .insert(schema_js_1.raceState)
        .values({
        raceId,
        pilotStates: {},
        startedAt: null,
        pausedAt: null,
        totalPausedMs: 0,
    })
        .onConflictDoUpdate({
        target: schema_js_1.raceState.raceId,
        set: {
            pilotStates: {},
            startedAt: null,
            pausedAt: null,
            totalPausedMs: 0,
        },
    });
    return _ctx;
}
// ---------------------------------------------------------------------------
// setPilotState — in-memory patch only
// ---------------------------------------------------------------------------
function setPilotState(pilotId, patch) {
    if (!_ctx)
        return;
    if (!_ctx.pilotStates[pilotId])
        return;
    _ctx.pilotStates[pilotId] = { ..._ctx.pilotStates[pilotId], ...patch };
}
// ---------------------------------------------------------------------------
// persistState — async, fire-and-forget
// ---------------------------------------------------------------------------
async function persistState() {
    if (!_ctx)
        return;
    await db_js_1.db
        .update(schema_js_1.raceState)
        .set({
        pilotStates: _ctx.pilotStates,
        startedAt: _ctx.startedAt,
        pausedAt: _ctx.pausedAt,
        totalPausedMs: _ctx.totalPausedMs,
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceState.raceId, _ctx.raceId));
}
// ---------------------------------------------------------------------------
// clearContext — final persist then null
// ---------------------------------------------------------------------------
async function clearContext() {
    await persistState();
    _ctx = null;
}
//# sourceMappingURL=race-context.js.map