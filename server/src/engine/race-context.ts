import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import {
  race, racetrack, raceEntry, raceState, pilot,
  type PilotState, type TrackingMode, type SessionMode,
  type TeamDisplayMode, type ChronoDisplayMode,
} from "../db/schema.js";

export const CHECKPOINT_RADIUS = parseInt(process.env.CHECKPOINT_RADIUS ?? "50");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PilotProfile {
  displayName: string;
  country: string;
  teamSnapshot: Record<string, unknown> | null;
  vehicleSnapshot: Record<string, unknown> | null;
  controlsSnapshot: Record<string, unknown> | null;
}

export interface RaceContext {
  raceId: string;
  trackingMode: TrackingMode;
  lapCount: number;
  sessionMode: SessionMode;
  sessionDurationMs: number | null;
  checkpoints: Array<{ order: number; position: [number, number, number] }>;
  bufferRadius: number;
  pilotStates: Record<string, PilotState>;
  pilotProfiles: Record<string, PilotProfile>;
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

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _ctx: RaceContext | null = null;

export function getContext(): RaceContext | null { return _ctx; }
export function hasContext(): boolean { return _ctx !== null; }

// ---------------------------------------------------------------------------
// loadRace
// ---------------------------------------------------------------------------

export async function loadRace(raceId: string): Promise<RaceContext> {
  const raceRow = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!raceRow) throw new Error(`Race ${raceId} not found`);

  if (raceRow.trackingMode === "auto" && !raceRow.racetrackId) {
    throw new Error(`Race ${raceId} is in AUTO mode but has no racetrack assigned`);
  }

  const track = raceRow.racetrackId
    ? await db.select().from(racetrack).where(eq(racetrack.id, raceRow.racetrackId)).get()
    : null;
  if (raceRow.racetrackId && !track) throw new Error(`Racetrack for race ${raceId} not found`);

  const entries = await db
    .select({
      id: raceEntry.id,
      pilotId: raceEntry.pilotId,
      teamSnapshot: raceEntry.teamSnapshot,
      vehicleSnapshot: raceEntry.vehicleSnapshot,
      controlsSnapshot: raceEntry.controlsSnapshot,
    })
    .from(raceEntry)
    .where(eq(raceEntry.raceId, raceId))
    .all()
    .then(rows => rows.filter(r => {
      // re-fetch status to filter VALIDATED
      return true; // filtering below after join
    }));

  // Fetch VALIDATED entries with pilot display info
  const validatedEntries = await db
    .select({
      entryId: raceEntry.id,
      pilotId: raceEntry.pilotId,
      teamSnapshot: raceEntry.teamSnapshot,
      vehicleSnapshot: raceEntry.vehicleSnapshot,
      controlsSnapshot: raceEntry.controlsSnapshot,
      displayName: pilot.displayName,
      country: pilot.country,
    })
    .from(raceEntry)
    .innerJoin(pilot, eq(raceEntry.pilotId, pilot.id))
    .where(eq(raceEntry.raceId, raceId))
    .all()
    .then(rows => rows.filter(r => {
      // we need to re-check status — do a second query for status
      return true;
    }));

  // Get full entry statuses
  const entryStatusRows = await db
    .select({ pilotId: raceEntry.pilotId, status: raceEntry.status })
    .from(raceEntry)
    .where(eq(raceEntry.raceId, raceId))
    .all();
  const validatedPilotIds = new Set(
    entryStatusRows.filter(e => e.status === "VALIDATED").map(e => e.pilotId)
  );

  const defaultState = (): PilotState => ({
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

  const pilotStates: Record<string, PilotState> = {};
  const pilotProfiles: Record<string, PilotProfile> = {};

  for (const entry of validatedEntries) {
    if (!validatedPilotIds.has(entry.pilotId)) continue;
    pilotStates[entry.pilotId] = defaultState();
    pilotProfiles[entry.pilotId] = {
      displayName: entry.displayName,
      country: entry.country ?? "un",
      teamSnapshot: entry.teamSnapshot ?? null,
      vehicleSnapshot: entry.vehicleSnapshot ?? null,
      controlsSnapshot: entry.controlsSnapshot ?? null,
    };
  }

  const bufferRadius =
    track?.bufferRadius ??
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
  await db
    .insert(raceState)
    .values({
      raceId,
      pilotStates: {},
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
    })
    .onConflictDoUpdate({
      target: raceState.raceId,
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

export function setPilotState(pilotId: string, patch: Partial<PilotState>): void {
  if (!_ctx) return;
  if (!_ctx.pilotStates[pilotId]) return;
  _ctx.pilotStates[pilotId] = { ..._ctx.pilotStates[pilotId], ...patch };
}

// ---------------------------------------------------------------------------
// persistState — async, fire-and-forget
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// clearContext — final persist then null
// ---------------------------------------------------------------------------

export async function clearContext(): Promise<void> {
  await persistState();
  _ctx = null;
}
