"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initEmitter = initEmitter;
exports.emitAll = emitAll;
exports.emitDashboard = emitDashboard;
exports.buildRaceUpdatePayload = buildRaceUpdatePayload;
exports.broadcastRaceState = broadcastRaceState;
let _io = null;
function initEmitter(io) {
    _io = io;
}
function emitAll(event, data) {
    _io?.emit(event, data);
}
// Dashboard sockets join the "dashboard" room on connect (see server.js).
function emitDashboard(event, data) {
    _io?.to("dashboard").emit(event, data);
}
// ---------------------------------------------------------------------------
// buildRaceUpdatePayload
// Builds the same shape as broadcastRaceUpdate() in dashboard/race.js so that
// overlays receive identical data regardless of whether the race is MANUAL or AUTO.
// ---------------------------------------------------------------------------
function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const millis = ms % 1000;
    return `${m}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
function getPilotElapsedMs(ctx, pilotId, now) {
    const state = ctx.pilotStates[pilotId];
    if (!state || !ctx.startedAt)
        return 0;
    if (state.frozenTime) {
        return new Date(state.frozenTime).getTime() - new Date(ctx.startedAt).getTime() - ctx.totalPausedMs;
    }
    const pauseOffset = ctx.pausedAt
        ? ctx.totalPausedMs + (now - new Date(ctx.pausedAt).getTime())
        : ctx.totalPausedMs;
    return now - new Date(ctx.startedAt).getTime() - pauseOffset;
}
function getChronoDisplay(ctx, pilotId, leaderElapsedMs, now) {
    const state = ctx.pilotStates[pilotId];
    if (!state)
        return "";
    const elapsedMs = getPilotElapsedMs(ctx, pilotId, now);
    switch (ctx.chronoDisplayMode) {
        case "leader":
            return pilotId === ctx.globalFastestLapPilotId || leaderElapsedMs === elapsedMs
                ? formatTime(elapsedMs)
                : `+${formatTime(elapsedMs - leaderElapsedMs)}`;
        case "gap":
            return formatTime(elapsedMs);
        case "best-lap": {
            const best = state.lapTimes.length ? Math.min(...state.lapTimes) : null;
            return best !== null ? formatTime(best) : "--:--.---";
        }
        case "last-lap": {
            const last = state.lapTimes.at(-1) ?? null;
            return last !== null ? formatTime(last) : "--:--.---";
        }
        default:
            return formatTime(elapsedMs);
    }
}
function buildRaceUpdatePayload(ctx) {
    const now = Date.now();
    // Sort pilots: FINISHED/DNF by raceProgress desc, then RUNNING/WARNING_DNF by raceProgress desc
    const sorted = Object.entries(ctx.pilotStates).sort(([, a], [, b]) => {
        const aActive = a.status === "RUNNING" || a.status === "WARNING_DNF";
        const bActive = b.status === "RUNNING" || b.status === "WARNING_DNF";
        if (aActive !== bActive)
            return aActive ? -1 : 1;
        return b.raceProgress - a.raceProgress;
    });
    const leaderElapsedMs = sorted.length > 0
        ? getPilotElapsedMs(ctx, sorted[0][0], now)
        : 0;
    const raceList = sorted.map(([pilotId, state], index) => {
        const profile = ctx.pilotProfiles[pilotId];
        const team = profile?.teamSnapshot ?? null;
        const vehicle = profile?.vehicleSnapshot ?? null;
        return {
            id: pilotId,
            name: profile?.displayName ?? pilotId,
            country: profile?.country ?? "un",
            teamId: team?.id ?? null,
            teamName: team?.name ?? null,
            teamColor: team?.color ?? null,
            teamAcronym: team?.acronym ?? null,
            shipModel: vehicle?.model ?? null,
            position: index + 1,
            laps: state.lap,
            lapTimes: state.lapTimes,
            finished: state.status === "FINISHED",
            dnf: state.status === "DNF" || state.status === "WARNING_DNF",
            frozenTime: state.frozenTime,
            chronoDisplay: getChronoDisplay(ctx, pilotId, leaderElapsedMs, now),
        };
    });
    const raceStatus = ctx.pausedAt ? "paused" :
        ctx.startedAt ? "running" :
            "standby";
    return {
        raceList,
        teams: [], // overlays use teamColor/teamAcronym from raceList directly
        teamDisplayMode: ctx.teamDisplayMode,
        timingEnabled: ctx.timingEnabled,
        chronoDisplayMode: ctx.chronoDisplayMode,
        globalFastestLap: ctx.globalFastestLapMs,
        globalFastestLapPilotId: ctx.globalFastestLapPilotId,
        raceStatus,
        countdown: { active: false, remainingMs: 0 },
        sessionMode: ctx.sessionMode,
        sessionCountdown: null,
        settings: {
            raceName: ctx.raceName,
            session: ctx.session,
            weather: ctx.weather,
            startType: ctx.startType,
            totalLaps: String(ctx.lapCount),
        },
    };
}
function broadcastRaceState(ctx) {
    emitAll("race-data", buildRaceUpdatePayload(ctx));
}
//# sourceMappingURL=emitter.js.map