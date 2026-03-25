"use strict";
// emitter.ts — Socket.IO broadcast: race-state (unified format)
// and race-data (legacy format for backward-compatible overlays).
Object.defineProperty(exports, "__esModule", { value: true });
exports.initEmitter = initEmitter;
exports.emitAll = emitAll;
exports.emitDashboard = emitDashboard;
exports.buildRaceStateBroadcast = buildRaceStateBroadcast;
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
// Chrono helpers
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
            return elapsedMs === leaderElapsedMs
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
// Sort pilots: FINISHED first (by frozenTime asc), then active, then DNF last.
function sortPilots(ctx) {
    const entries = Object.entries(ctx.pilotStates);
    return entries.sort(([, a], [, b]) => {
        const rank = (s) => s.status === "FINISHED" ? 0 :
            (s.status === "RUNNING" || s.status === "WARNING_DNF") ? 1 : 2;
        const ra = rank(a), rb = rank(b);
        if (ra !== rb)
            return ra - rb;
        if (a.status === "FINISHED" && b.status === "FINISHED") {
            return (a.frozenTime ?? "").localeCompare(b.frozenTime ?? "");
        }
        if (ctx.trackingMode === "manual") {
            if (a.lap !== b.lap)
                return b.lap - a.lap;
            return a.gridPosition - b.gridPosition;
        }
        return b.raceProgress - a.raceProgress;
    });
}
// buildRaceStateBroadcast — unified format per spec §7 (race-state event).
function buildRaceStateBroadcast(ctx) {
    const now = Date.now();
    const sorted = sortPilots(ctx);
    const leaderElapsedMs = sorted.length > 0
        ? getPilotElapsedMs(ctx, sorted[0][0], now)
        : 0;
    const pilots = sorted.map(([pilotId, state], index) => {
        const profile = ctx.pilotProfiles[pilotId];
        const team = profile?.teamSnapshot ?? null;
        const vehicle = profile?.vehicleSnapshot ?? null;
        return {
            id: pilotId,
            entryId: ctx.entryIds?.[pilotId] ?? null,
            displayName: profile?.displayName ?? pilotId,
            country: profile?.country ?? "un",
            teamSnapshot: team
                ? { name: team.name, color: team.color, acronym: team.acronym }
                : null,
            vehicleSnapshot: vehicle
                ? { type: vehicle.type, manufacturer: vehicle.manufacturer ?? "", model: vehicle.model }
                : null,
            position: index + 1,
            lap: state.lap,
            lapTimes: state.lapTimes,
            status: state.status,
            frozenTime: state.frozenTime,
        };
    });
    return {
        raceId: ctx.raceId,
        raceName: ctx.raceName,
        racetrackId: ctx.racetrackId,
        status: ctx.raceStatus,
        trackingMode: ctx.trackingMode,
        session: ctx.session,
        weather: ctx.weather,
        startType: ctx.startType,
        sessionMode: ctx.sessionMode,
        lapCount: ctx.lapCount,
        sessionDurationMs: ctx.sessionDurationMs,
        startedAt: ctx.startedAt,
        pausedAt: ctx.pausedAt,
        totalPausedMs: ctx.totalPausedMs,
        globalFastestLapMs: ctx.globalFastestLapMs,
        globalFastestLapPilotId: ctx.globalFastestLapPilotId,
        teamDisplayMode: ctx.teamDisplayMode,
        chronoDisplayMode: ctx.chronoDisplayMode,
        timingEnabled: ctx.timingEnabled,
        eventDuration: ctx.eventDuration,
        pilots,
    };
}
// buildRaceUpdatePayload — legacy format (race-data event).
// Kept for backward compatibility with existing overlays.
function buildRaceUpdatePayload(ctx) {
    const now = Date.now();
    const sorted = sortPilots(ctx);
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
        teams: [],
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
// broadcastRaceState — emits race-state (new) + race-data (legacy).
function broadcastRaceState(ctx) {
    emitAll("race-state", buildRaceStateBroadcast(ctx));
    emitAll("race-data", buildRaceUpdatePayload(ctx));
}
//# sourceMappingURL=emitter.js.map