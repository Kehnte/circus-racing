"use strict";
// race-context.ts — Server singleton that holds the complete state
// of the active race (pilotStates, chrono, metadata).
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHECKPOINT_RADIUS = void 0;
exports.getContext = getContext;
exports.hasContext = hasContext;
exports.loadRace = loadRace;
exports.setPilotState = setPilotState;
exports.persistState = persistState;
exports.clearContext = clearContext;
exports.setGridOrder = setGridOrder;
exports.setManualPosition = setManualPosition;
exports.reorderPilot = reorderPilot;
exports.toggleDnf = toggleDnf;
exports.incrementLap = incrementLap;
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
exports.CHECKPOINT_RADIUS = parseInt(process.env.CHECKPOINT_RADIUS ?? "50");
// Singleton
let _ctx = null;
function getContext() { return _ctx; }
function hasContext() { return _ctx !== null; }
// loadRace — builds fresh context from DB (does NOT start the race)
async function loadRace(raceId) {
    const raceRow = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!raceRow)
        throw new Error(`Race ${raceId} not found`);
    const track = raceRow.racetrackId
        ? await db_js_1.db.select().from(schema_js_1.racetrack).where((0, drizzle_orm_1.eq)(schema_js_1.racetrack.id, raceRow.racetrackId)).get()
        : null;
    if (raceRow.racetrackId && !track)
        throw new Error(`Racetrack for race ${raceId} not found`);
    // Fetch VALIDATED entries with pilot info and grid position
    const validatedEntries = await db_js_1.db
        .select({
        entryId: schema_js_1.raceEntry.id,
        pilotId: schema_js_1.raceEntry.pilotId,
        gridPosition: schema_js_1.raceEntry.gridPosition,
        teamSnapshot: schema_js_1.raceEntry.teamSnapshot,
        vehicleSnapshot: schema_js_1.raceEntry.vehicleSnapshot,
        controlsSnapshot: schema_js_1.raceEntry.controlsSnapshot,
        displayName: schema_js_1.pilot.displayName,
        country: schema_js_1.pilot.country,
    })
        .from(schema_js_1.raceEntry)
        .innerJoin(schema_js_1.pilot, (0, drizzle_orm_1.eq)(schema_js_1.raceEntry.pilotId, schema_js_1.pilot.id))
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, raceId), (0, drizzle_orm_1.eq)(schema_js_1.raceEntry.status, "VALIDATED")))
        .all();
    // Sort by gridPosition (nulls last), then by insertion order
    validatedEntries.sort((a, b) => {
        if (a.gridPosition === null && b.gridPosition === null)
            return 0;
        if (a.gridPosition === null)
            return 1;
        if (b.gridPosition === null)
            return -1;
        return a.gridPosition - b.gridPosition;
    });
    const defaultState = (gp) => ({
        position: [0, 0, 0],
        lap: 0,
        progress: 0,
        raceProgress: 0,
        gridPosition: gp,
        lapTimes: [],
        status: "RUNNING",
        frozenTime: null,
        dnfWarning: false,
        lastCheckpointTime: null,
        nextCheckpointOrder: 0,
    });
    const pilotStates = {};
    const pilotProfiles = {};
    const entryIds = {};
    for (let i = 0; i < validatedEntries.length; i++) {
        const entry = validatedEntries[i];
        const gp = entry.gridPosition ?? (i + 1);
        pilotStates[entry.pilotId] = defaultState(gp);
        entryIds[entry.pilotId] = entry.entryId;
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
        racetrackId: raceRow.racetrackId ?? null,
        raceStatus: raceRow.status,
        trackingMode: raceRow.trackingMode,
        lapCount: raceRow.lapCount,
        sessionMode: raceRow.sessionMode,
        sessionDurationMs: raceRow.sessionDurationMs ?? null,
        checkpoints: track?.checkpoints ?? [],
        bufferRadius,
        pilotStates,
        pilotProfiles,
        entryIds,
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
    // Persist initial state
    await db_js_1.db
        .insert(schema_js_1.raceState)
        .values({
        raceId,
        pilotStates,
        startedAt: null,
        pausedAt: null,
        totalPausedMs: 0,
    })
        .onConflictDoUpdate({
        target: schema_js_1.raceState.raceId,
        set: {
            pilotStates,
            startedAt: null,
            pausedAt: null,
            totalPausedMs: 0,
        },
    });
    return _ctx;
}
// setPilotState — in-memory patch only
function setPilotState(pilotId, patch) {
    if (!_ctx)
        return;
    if (!_ctx.pilotStates[pilotId])
        return;
    _ctx.pilotStates[pilotId] = { ..._ctx.pilotStates[pilotId], ...patch };
}
// persistState — async, fire-and-forget
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
// clearContext — final persist then null
async function clearContext() {
    await persistState();
    _ctx = null;
}
// Manual mode — grid ordering helpers
// Returns sorted list of all pilot IDs by gridPosition ascending.
function getPilotsSortedByGrid() {
    if (!_ctx)
        return [];
    return Object.entries(_ctx.pilotStates)
        .sort(([, a], [, b]) => a.gridPosition - b.gridPosition)
        .map(([id]) => id);
}
function reindexGrid(pilotIds) {
    if (!_ctx)
        return;
    for (let i = 0; i < pilotIds.length; i++) {
        const state = _ctx.pilotStates[pilotIds[i]];
        if (state)
            state.gridPosition = i + 1;
    }
}
// setGridOrder — define the complete grid order at once
function setGridOrder(pilotIds) {
    if (!_ctx)
        return;
    for (let i = 0; i < pilotIds.length; i++) {
        const state = _ctx.pilotStates[pilotIds[i]];
        if (state)
            state.gridPosition = i + 1;
    }
}
// setManualPosition — insert pilot at targetPos (1-based), shift others
function setManualPosition(pilotId, targetPos) {
    if (!_ctx)
        return;
    if (!_ctx.pilotStates[pilotId])
        return;
    const pilots = getPilotsSortedByGrid();
    const idx = pilots.indexOf(pilotId);
    if (idx !== -1)
        pilots.splice(idx, 1);
    const insertAt = Math.min(Math.max(0, targetPos - 1), pilots.length);
    pilots.splice(insertAt, 0, pilotId);
    reindexGrid(pilots);
}
// reorderPilot — move pilot up or down one position
function reorderPilot(pilotId, direction) {
    if (!_ctx)
        return;
    if (!_ctx.pilotStates[pilotId])
        return;
    const pilots = getPilotsSortedByGrid();
    const idx = pilots.indexOf(pilotId);
    if (idx === -1)
        return;
    if (direction === "up" && idx > 0) {
        [pilots[idx - 1], pilots[idx]] = [pilots[idx], pilots[idx - 1]];
    }
    else if (direction === "down" && idx < pilots.length - 1) {
        [pilots[idx], pilots[idx + 1]] = [pilots[idx + 1], pilots[idx]];
    }
    reindexGrid(pilots);
}
// toggleDnf — toggle pilot between RUNNING and DNF (manual mode)
function toggleDnf(pilotId) {
    if (!_ctx)
        return;
    const state = _ctx.pilotStates[pilotId];
    if (!state)
        return;
    if (state.status === "DNF") {
        setPilotState(pilotId, { status: "RUNNING", frozenTime: null, dnfWarning: false });
    }
    else if (state.status !== "FINISHED") {
        setPilotState(pilotId, {
            status: "DNF",
            frozenTime: new Date().toISOString(),
            dnfWarning: false,
        });
    }
}
// incrementLap — +1 or -1 lap for a pilot (manual mode)
// Returns engine-like events (fastest-lap, finished, race-finished).
function formatLapTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const millis = ms % 1000;
    return `${m}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
function incrementLap(pilotId, delta) {
    if (!_ctx)
        return null;
    const state = _ctx.pilotStates[pilotId];
    if (!state)
        return null;
    if (state.status === "DNF")
        return null;
    const events = [];
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    if (delta === 1) {
        if (state.status === "FINISHED")
            return null;
        // Calculate lap time (wall-clock delta)
        let lapMs = 0;
        if (_ctx.startedAt) {
            const raceStart = new Date(_ctx.startedAt).getTime();
            if (state.lastCheckpointTime) {
                lapMs = now - new Date(state.lastCheckpointTime).getTime();
            }
            else {
                lapMs = now - raceStart - _ctx.totalPausedMs;
            }
        }
        const newLap = state.lap + 1;
        const newLapTimes = lapMs > 0 ? [...state.lapTimes, lapMs] : state.lapTimes;
        // Check fastest lap
        if (lapMs > 0 && (_ctx.globalFastestLapMs === null || lapMs < _ctx.globalFastestLapMs)) {
            _ctx.globalFastestLapMs = lapMs;
            _ctx.globalFastestLapPilotId = pilotId;
            events.push({ type: "fastest-lap", pilotId, lapMs, lapFormatted: formatLapTime(lapMs) });
        }
        // Check finish condition (laps mode)
        if (_ctx.sessionMode === "laps" && newLap >= _ctx.lapCount) {
            setPilotState(pilotId, {
                lap: newLap,
                lapTimes: newLapTimes,
                status: "FINISHED",
                frozenTime: nowIso,
                lastCheckpointTime: nowIso,
                raceProgress: newLap,
            });
            events.push({ type: "finished", pilotId });
            // Check if all pilots done
            const allDone = Object.values(_ctx.pilotStates).every(s => s.status === "FINISHED" || s.status === "DNF");
            if (allDone)
                events.push({ type: "race-finished" });
        }
        else {
            setPilotState(pilotId, {
                lap: newLap,
                lapTimes: newLapTimes,
                lastCheckpointTime: nowIso,
                raceProgress: newLap,
            });
        }
    }
    else {
        // delta === -1
        const newLap = Math.max(0, state.lap - 1);
        const newLapTimes = state.lapTimes.slice(0, newLap);
        const wasFinished = state.status === "FINISHED";
        setPilotState(pilotId, {
            lap: newLap,
            lapTimes: newLapTimes,
            status: wasFinished ? "RUNNING" : state.status,
            frozenTime: wasFinished ? null : state.frozenTime,
            raceProgress: newLap,
        });
        // Recompute global fastest lap from all pilots
        let newFastestMs = null;
        let newFastestPilotId = null;
        for (const [pid, s] of Object.entries(_ctx.pilotStates)) {
            for (const lt of s.lapTimes) {
                if (newFastestMs === null || lt < newFastestMs) {
                    newFastestMs = lt;
                    newFastestPilotId = pid;
                }
            }
        }
        _ctx.globalFastestLapMs = newFastestMs;
        _ctx.globalFastestLapPilotId = newFastestPilotId;
    }
    return { events };
}
//# sourceMappingURL=race-context.js.map