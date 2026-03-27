// race-context.ts — Server singleton that holds the complete state
// of the active race (pilotStates, chrono, metadata).

import { eq, and } from "drizzle-orm";
import { db } from "../db/db.js";
import {
  race, racetrack, raceEntry, raceState, pilot,
  type PilotState, type TrackingMode, type SessionMode,
  type TeamDisplayMode, type ChronoDisplayMode, type RaceStatus,
} from "../db/schema.js";

export const CHECKPOINT_RADIUS = parseInt(process.env.CHECKPOINT_RADIUS ?? "50");

// Types

export interface PilotProfile {
  displayName: string;
  country: string;
  teamSnapshot: Record<string, unknown> | null;
  vehicleSnapshot: Record<string, unknown> | null;
  controlsSnapshot: Record<string, unknown> | null;
}

export interface RaceContext {
  raceId: string;
  racetrackId: string | null;
  raceStatus: RaceStatus;
  trackingMode: TrackingMode;
  lapCount: number;
  sessionMode: SessionMode;
  sessionDurationMs: number | null;
  checkpoints: Array<{ order: number; position: [number, number, number] }>;
  pilotStates: Record<string, PilotState>;
  pilotProfiles: Record<string, PilotProfile>;
  entryIds: Record<string, string>;
  startedAt: string | null;
  pausedAt: string | null;
  totalPausedMs: number;
  // fastest lap tracking
  globalFastestLapMs: number | null;
  globalFastestLapPilotId: string | null;
  // display settings (from race row)
  teamDisplayMode: TeamDisplayMode;
  chronoDisplayMode: ChronoDisplayMode;
  timingEnabled: boolean;
  eventDuration: number;
  raceName: string;
  session: string;
  weather: string;
  startType: string;
}

// Singleton

let _ctx: RaceContext | null = null;

export function getContext(): RaceContext | null { return _ctx; }
export function hasContext(): boolean { return _ctx !== null; }

// loadRace — builds fresh context from DB (does NOT start the race)

export async function loadRace(raceId: string): Promise<RaceContext> {
  const raceRow = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!raceRow) throw new Error(`Race ${raceId} not found`);

  const track = raceRow.racetrackId
    ? await db.select().from(racetrack).where(eq(racetrack.id, raceRow.racetrackId)).get()
    : null;
  if (raceRow.racetrackId && !track) throw new Error(`Racetrack for race ${raceId} not found`);

  // Fetch VALIDATED entries with pilot info and grid position
  const validatedEntries = await db
    .select({
      entryId: raceEntry.id,
      pilotId: raceEntry.pilotId,
      gridPosition: raceEntry.gridPosition,
      teamSnapshot: raceEntry.teamSnapshot,
      vehicleSnapshot: raceEntry.vehicleSnapshot,
      controlsSnapshot: raceEntry.controlsSnapshot,
      displayName: pilot.displayName,
      country: pilot.country,
    })
    .from(raceEntry)
    .innerJoin(pilot, eq(raceEntry.pilotId, pilot.id))
    .where(and(eq(raceEntry.raceId, raceId), eq(raceEntry.status, "VALIDATED")))
    .all();

  // Sort by gridPosition (nulls last), then by insertion order
  validatedEntries.sort((a, b) => {
    if (a.gridPosition === null && b.gridPosition === null) return 0;
    if (a.gridPosition === null) return 1;
    if (b.gridPosition === null) return -1;
    return a.gridPosition - b.gridPosition;
  });

  const defaultState = (gp: number): PilotState => ({
    position: [0, 0, 0],
    lap: 0,
    progress: 0,
    raceProgress: 0,
    gridPosition: gp,
    lapTimes: [],
    status: "RUNNING",
    frozenTime: null,
    lastCheckpointTime: null,
    nextCheckpointOrder: 0,
  });

  const pilotStates: Record<string, PilotState> = {};
  const pilotProfiles: Record<string, PilotProfile> = {};
  const entryIds: Record<string, string> = {};

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

  _ctx = {
    raceId,
    racetrackId: raceRow.racetrackId ?? null,
    raceStatus: raceRow.status,
    trackingMode: raceRow.trackingMode,
    lapCount: raceRow.lapCount,
    sessionMode: raceRow.sessionMode,
    sessionDurationMs: raceRow.sessionDurationMs ?? null,
    checkpoints: track?.checkpoints ?? [],
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
  await db
    .insert(raceState)
    .values({
      raceId,
      pilotStates,
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
    })
    .onConflictDoUpdate({
      target: raceState.raceId,
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

export function setPilotState(pilotId: string, patch: Partial<PilotState>): void {
  if (!_ctx) return;
  if (!_ctx.pilotStates[pilotId]) return;
  _ctx.pilotStates[pilotId] = { ..._ctx.pilotStates[pilotId], ...patch };
}

// persistState — async, fire-and-forget

export async function persistState(): Promise<void> {
  if (!_ctx) return;
  await db
    .update(raceState)
    .set({
      pilotStates: _ctx.pilotStates,
      startedAt: _ctx.startedAt,
      pausedAt: _ctx.pausedAt,
      totalPausedMs: _ctx.totalPausedMs,
    })
    .where(eq(raceState.raceId, _ctx.raceId));
}

// clearContext — final persist then null

export async function clearContext(): Promise<void> {
  await persistState();
  _ctx = null;
}

// Manual mode — grid ordering helpers
// Returns sorted list of all pilot IDs by gridPosition ascending.

function getPilotsSortedByGrid(): string[] {
  if (!_ctx) return [];
  return Object.entries(_ctx.pilotStates)
    .sort(([, a], [, b]) => a.gridPosition - b.gridPosition)
    .map(([id]) => id);
}

function reindexGrid(pilotIds: string[]): void {
  if (!_ctx) return;
  for (let i = 0; i < pilotIds.length; i++) {
    const state = _ctx.pilotStates[pilotIds[i]];
    if (state) state.gridPosition = i + 1;
  }
}

// setGridOrder — define the complete grid order at once

export function setGridOrder(pilotIds: string[]): void {
  if (!_ctx) return;
  for (let i = 0; i < pilotIds.length; i++) {
    const state = _ctx.pilotStates[pilotIds[i]];
    if (state) state.gridPosition = i + 1;
  }
}

// setManualPosition — insert pilot at targetPos (1-based), shift others

export function setManualPosition(pilotId: string, targetPos: number): void {
  if (!_ctx) return;
  if (!_ctx.pilotStates[pilotId]) return;

  const pilots = getPilotsSortedByGrid();
  const idx = pilots.indexOf(pilotId);
  if (idx !== -1) pilots.splice(idx, 1);

  const insertAt = Math.min(Math.max(0, targetPos - 1), pilots.length);
  pilots.splice(insertAt, 0, pilotId);
  reindexGrid(pilots);
}

// reorderPilot — move pilot up or down one position

export function reorderPilot(pilotId: string, direction: "up" | "down"): void {
  if (!_ctx) return;
  if (!_ctx.pilotStates[pilotId]) return;

  const pilots = getPilotsSortedByGrid();
  const idx = pilots.indexOf(pilotId);
  if (idx === -1) return;

  const pilotLap = _ctx.pilotStates[pilotId]?.lap ?? 0;

  if (direction === "up" && idx > 0) {
    const neighborLap = _ctx.pilotStates[pilots[idx - 1]]?.lap ?? 0;
    if (neighborLap > pilotLap) return;
    [pilots[idx - 1], pilots[idx]] = [pilots[idx], pilots[idx - 1]];
  } else if (direction === "down" && idx < pilots.length - 1) {
    const neighborLap = _ctx.pilotStates[pilots[idx + 1]]?.lap ?? 0;
    if (neighborLap < pilotLap) return;
    [pilots[idx], pilots[idx + 1]] = [pilots[idx + 1], pilots[idx]];
  }
  reindexGrid(pilots);
}

// toggleDnf — toggle pilot between RUNNING and DNF (manual mode)

export function toggleDnf(pilotId: string): void {
  if (!_ctx) return;
  const state = _ctx.pilotStates[pilotId];
  if (!state) return;

  if (state.status === "DNF") {
    setPilotState(pilotId, { status: "RUNNING", frozenTime: null });
  } else if (state.status !== "FINISHED") {
    setPilotState(pilotId, { status: "DNF", frozenTime: new Date().toISOString() });
  }
}

// incrementLap — +1 or -1 lap for a pilot (manual mode)
// Returns engine-like events (fastest-lap, finished, race-finished).

function formatLapTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const millis = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export type ManualLapEvent =
  | { type: "fastest-lap"; pilotId: string; lapMs: number; lapFormatted: string }
  | { type: "finished"; pilotId: string }
  | { type: "race-finished" };

export function incrementLap(
  pilotId: string,
  delta: 1 | -1
): { events: ManualLapEvent[] } | null {
  if (!_ctx) return null;
  const state = _ctx.pilotStates[pilotId];
  if (!state) return null;
  if (state.status === "DNF") return null;

  const events: ManualLapEvent[] = [];
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  if (delta === 1) {
    if (state.status === "FINISHED") return null;

    // Calculate lap time (wall-clock delta)
    let lapMs = 0;
    if (_ctx.startedAt) {
      const raceStart = new Date(_ctx.startedAt).getTime();
      if (state.lastCheckpointTime) {
        lapMs = now - new Date(state.lastCheckpointTime).getTime();
      } else {
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
      const allDone = Object.values(_ctx.pilotStates).every(
        s => s.status === "FINISHED" || s.status === "DNF"
      );
      if (allDone) events.push({ type: "race-finished" });
    } else {
      setPilotState(pilotId, {
        lap: newLap,
        lapTimes: newLapTimes,
        lastCheckpointTime: nowIso,
        raceProgress: newLap,
      });
    }

    // In manual mode, place this pilot last among those with the same lap count
    // so they don't jump ahead of pilots who reached that lap earlier.
    if (_ctx.trackingMode === "manual") {
      const sorted = getPilotsSortedByGrid();
      const currentIdx = sorted.indexOf(pilotId);
      if (currentIdx !== -1) {
        // Find the last index among pilots (excluding self) that have newLap laps
        let insertAfter = currentIdx;
        for (let i = 0; i < sorted.length; i++) {
          if (i === currentIdx) continue;
          const s = _ctx.pilotStates[sorted[i]];
          if (s && s.lap === newLap && i > insertAfter) insertAfter = i;
        }
        if (insertAfter !== currentIdx) {
          sorted.splice(currentIdx, 1);
          sorted.splice(insertAfter, 0, pilotId);
          reindexGrid(sorted);
        }
      }
    }

  } else {
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
    let newFastestMs: number | null = null;
    let newFastestPilotId: string | null = null;
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

    // In manual mode, place this pilot last among those with the same (lower) lap count
    if (_ctx.trackingMode === "manual") {
      const sorted = getPilotsSortedByGrid();
      const currentIdx = sorted.indexOf(pilotId);
      if (currentIdx !== -1) {
        let insertAfter = currentIdx;
        for (let i = 0; i < sorted.length; i++) {
          if (i === currentIdx) continue;
          const s = _ctx.pilotStates[sorted[i]];
          if (s && s.lap === newLap && i > insertAfter) insertAfter = i;
        }
        if (insertAfter !== currentIdx) {
          sorted.splice(currentIdx, 1);
          sorted.splice(insertAfter, 0, pilotId);
          reindexGrid(sorted);
        }
      }
    }
  }

  return { events };
}
