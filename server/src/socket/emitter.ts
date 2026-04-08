// emitter.ts — Socket.IO broadcast: race-state (unified) and race-data (legacy overlay format).

import type { Server } from "socket.io";
import type { RaceContext } from "../engine/race-context.js";

let _io: Server | null = null;

export function initEmitter(io: Server): void {
  _io = io;
}

export function emitAll(event: string, data?: unknown): void {
  _io?.emit(event, data);
}

// Dashboard sockets join the "dashboard" room on connect (see server.js).
export function emitDashboard(event: string, data?: unknown): void {
  _io?.to("dashboard").emit(event, data);
}

// Chrono helpers

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const millis = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function getPilotElapsedMs(
  ctx: RaceContext,
  pilotId: string,
  now: number
): number {
  const state = ctx.pilotStates[pilotId];
  if (!state || !ctx.startedAt) return 0;

  if (state.frozenTime) {
    return new Date(state.frozenTime).getTime() - new Date(ctx.startedAt).getTime() - ctx.totalPausedMs;
  }

  const pauseOffset = ctx.pausedAt
    ? ctx.totalPausedMs + (now - new Date(ctx.pausedAt).getTime())
    : ctx.totalPausedMs;

  return now - new Date(ctx.startedAt).getTime() - pauseOffset;
}

function getChronoDisplay(
  ctx: RaceContext,
  pilotId: string,
  leaderElapsedMs: number,
  now: number
): string {
  const state = ctx.pilotStates[pilotId];
  if (!state) return "";
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
// DNF sub-sort: last to retire = better ranked (latest frozenTime first); equal frozenTime: most race progress first.

function sortPilots(ctx: RaceContext): [string, import("../db/schema.js").PilotState][] {
  const entries = Object.entries(ctx.pilotStates) as [string, import("../db/schema.js").PilotState][];

  return entries.sort(([, a], [, b]) => {
    const rank = (s: import("../db/schema.js").PilotState) =>
      s.status === "FINISHED" ? 0 :
      s.status === "RUNNING" ? 1 : 2;

    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;

    if (a.status === "FINISHED" && b.status === "FINISHED") {
      return (a.frozenTime ?? "").localeCompare(b.frozenTime ?? "");
    }

    if (ra === 2) {
      const ftCmp = (b.frozenTime ?? "").localeCompare(a.frozenTime ?? "");
      if (ftCmp !== 0) return ftCmp;
      return b.raceProgress - a.raceProgress;
    }

    if (ctx.trackingMode === "manual") {
      if (a.lap !== b.lap) return b.lap - a.lap;
      return a.gridPosition - b.gridPosition;
    }
    return b.raceProgress - a.raceProgress;
  });
}

// buildRaceStateBroadcast — unified format per spec §7 (race-state event).

export function buildRaceStateBroadcast(ctx: RaceContext): object {
  const now = Date.now();
  const sorted = sortPilots(ctx);

  const leaderElapsedMs = sorted.length > 0
    ? getPilotElapsedMs(ctx, sorted[0][0], now)
    : 0;

  const pilots = sorted.map(([pilotId, state], index) => {
    const profile = ctx.pilotProfiles[pilotId];
    const team = profile?.teamSnapshot as Record<string, unknown> | null ?? null;
    const vehicle = profile?.vehicleSnapshot as Record<string, unknown> | null ?? null;

    return {
      id: pilotId,
      entryId: ctx.entryIds?.[pilotId] ?? null,
      displayName: profile?.displayName ?? pilotId,
      country: profile?.country ?? "un",
      teamSnapshot: team
        ? { name: team.name as string, color: team.color as string, acronym: team.acronym as string }
        : null,
      vehicleSnapshot: vehicle
        ? { type: vehicle.type as string, manufacturer: (vehicle.manufacturer as string | null) ?? "", model: vehicle.model as string }
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
    ocrHealth: ctx.ocrHealth,
    teamDisplayMode: ctx.teamDisplayMode,
    chronoDisplayMode: ctx.chronoDisplayMode,
    timingEnabled: ctx.timingEnabled,
    eventDuration: ctx.eventDuration,
    pilots,
  };
}

// buildRaceUpdatePayload — legacy format (race-data event).
// Kept for backward compatibility with existing overlays.

export function buildRaceUpdatePayload(ctx: RaceContext): object {
  const now = Date.now();
  const sorted = sortPilots(ctx);

  const leaderElapsedMs = sorted.length > 0
    ? getPilotElapsedMs(ctx, sorted[0][0], now)
    : 0;

  const raceList = sorted.map(([pilotId, state], index) => {
    const profile = ctx.pilotProfiles[pilotId];
    const team = profile?.teamSnapshot as Record<string, unknown> | null ?? null;
    const vehicle = profile?.vehicleSnapshot as Record<string, unknown> | null ?? null;

    return {
      id: pilotId,
      name: profile?.displayName ?? pilotId,
      country: profile?.country ?? "un",
      teamId: (team?.id as string) ?? null,
      teamName: (team?.name as string) ?? null,
      teamColor: (team?.color as string) ?? null,
      teamAcronym: (team?.acronym as string) ?? null,
      shipModel: (vehicle?.model as string) ?? null,
      position: index + 1,
      laps: state.lap,
      lapTimes: state.lapTimes,
      finished: state.status === "FINISHED",
      dnf: state.status === "DNF",
      frozenTime: state.frozenTime,
      chronoDisplay: getChronoDisplay(ctx, pilotId, leaderElapsedMs, now),
    };
  });

  const raceStatus =
    ctx.pausedAt ? "paused" :
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

export function broadcastRaceState(ctx: RaceContext): void {
  emitAll("race-state", buildRaceStateBroadcast(ctx));
  emitAll("race-data", buildRaceUpdatePayload(ctx));
}
