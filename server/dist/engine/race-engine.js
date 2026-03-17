"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPosition = processPosition;
const math_js_1 = require("./math.js");
const race_context_js_1 = require("./race-context.js");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatLapTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const millis = ms % 1000;
    return `${m}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
function allDone(ctx) {
    return Object.values(ctx.pilotStates).every(s => s.status === "FINISHED" || s.status === "DNF");
}
// ---------------------------------------------------------------------------
// processPosition
// ---------------------------------------------------------------------------
function processPosition(pilotId, position, now) {
    const ctx = (0, race_context_js_1.getContext)();
    if (!ctx)
        return null;
    if (ctx.trackingMode !== "auto")
        return null;
    const state = ctx.pilotStates[pilotId];
    if (!state)
        return null;
    if (state.status === "FINISHED" || state.status === "DNF")
        return null;
    const events = [];
    const cps = ctx.checkpoints;
    const cpLen = cps.length;
    // Update position
    state.position = position;
    // -------------------------------------------------------------------------
    // Checkpoint detection
    // -------------------------------------------------------------------------
    if (cpLen > 0) {
        const nextIdx = state.nextCheckpointOrder % cpLen;
        const nextCP = cps[nextIdx];
        if ((0, math_js_1.distance3D)(position, nextCP.position) < race_context_js_1.CHECKPOINT_RADIUS) {
            const nowIso = now.toISOString();
            if (nextIdx === 0 && state.lap > 0) {
                // Crossing the finish line → lap completed
                const lapMs = state.lastCheckpointTime
                    ? now.getTime() - new Date(state.lastCheckpointTime).getTime()
                    : 0;
                state.lapTimes.push(lapMs);
                // Check fastest lap
                if (lapMs > 0 && (ctx.globalFastestLapMs === null || lapMs < ctx.globalFastestLapMs)) {
                    ctx.globalFastestLapMs = lapMs;
                    ctx.globalFastestLapPilotId = pilotId;
                    events.push({
                        type: "fastest-lap",
                        pilotId,
                        lapMs,
                        lapFormatted: formatLapTime(lapMs),
                    });
                }
                state.lap += 1;
                // Check finish condition (laps mode)
                if (ctx.sessionMode === "laps" && state.lap > ctx.lapCount) {
                    state.status = "FINISHED";
                    state.frozenTime = nowIso;
                    events.push({ type: "finished", pilotId });
                    if (allDone(ctx))
                        events.push({ type: "race-finished" });
                    (0, race_context_js_1.setPilotState)(pilotId, state);
                    updateRaceProgress(ctx, pilotId, nextIdx, cpLen);
                    return { pilotState: state, events };
                }
            }
            else if (nextIdx === 0 && state.lap === 0) {
                // First crossing of start/finish line — race has started for this pilot
                state.lap = 1;
            }
            state.nextCheckpointOrder = (nextIdx + 1) % cpLen;
            state.lastCheckpointTime = nowIso;
            state.dnfWarning = false;
            if (state.status === "WARNING_DNF")
                state.status = "RUNNING";
        }
    }
    // -------------------------------------------------------------------------
    // DNF buffer detection (only when RUNNING or WARNING_DNF)
    // -------------------------------------------------------------------------
    if ((state.status === "RUNNING" || state.status === "WARNING_DNF") &&
        cpLen >= 2) {
        const nextIdx = state.nextCheckpointOrder % cpLen;
        const prevIdx = (nextIdx - 1 + cpLen) % cpLen;
        const segA = cps[prevIdx].position;
        const segB = cps[nextIdx].position;
        const dist = (0, math_js_1.distanceToSegment3D)(position, segA, segB);
        if (dist > ctx.bufferRadius) {
            if (!state.dnfWarning) {
                state.dnfWarning = true;
                state.status = "WARNING_DNF";
                events.push({ type: "dnf-warning", pilotId });
            }
        }
        else {
            if (state.dnfWarning) {
                state.dnfWarning = false;
                state.status = "RUNNING";
                events.push({ type: "dnf-cleared", pilotId });
            }
        }
    }
    updateRaceProgress(ctx, pilotId, state.nextCheckpointOrder % cpLen, cpLen);
    (0, race_context_js_1.setPilotState)(pilotId, state);
    return { pilotState: state, events };
}
function updateRaceProgress(ctx, pilotId, nextIdx, cpLen) {
    const state = ctx.pilotStates[pilotId];
    if (!state)
        return;
    const progress = cpLen > 0 ? nextIdx / cpLen : 0;
    state.progress = progress;
    state.raceProgress = state.lap + progress;
}
//# sourceMappingURL=race-engine.js.map