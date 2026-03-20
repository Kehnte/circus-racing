// snapshot-refresh.ts — Re-captures race entry snapshots when source entities change.

import { eq, and, ne } from "drizzle-orm";
import { db } from "../db/db.js";
import { pilot, race, raceEntry, team, vehicle, controls } from "../db/schema.js";
import { getContext } from "./race-context.js";
import { broadcastRaceState } from "../socket/emitter.js";

// Only refresh entries in races that are not finished
async function activeEntryIdsForPilots(pilotIds: string[]): Promise<{ entryId: string; pilotId: string; raceId: string }[]> {
  if (pilotIds.length === 0) return [];

  const results: { entryId: string; pilotId: string; raceId: string }[] = [];
  for (const pid of pilotIds) {
    const entries = await db
      .select({ entryId: raceEntry.id, pilotId: raceEntry.pilotId, raceId: raceEntry.raceId })
      .from(raceEntry)
      .innerJoin(race, eq(raceEntry.raceId, race.id))
      .where(and(
        eq(raceEntry.pilotId, pid),
        eq(raceEntry.status, "VALIDATED"),
        ne(race.status, "FINISHED"),
      ))
      .all();
    results.push(...entries);
  }
  return results;
}

function patchLiveContext(pilotId: string, patch: Partial<{
  displayName: string;
  country: string;
  teamSnapshot: Record<string, unknown> | null;
  vehicleSnapshot: Record<string, unknown> | null;
  controlsSnapshot: Record<string, unknown> | null;
}>): boolean {
  const ctx = getContext();
  if (!ctx) return false;
  const profile = ctx.pilotProfiles[pilotId];
  if (!profile) return false;
  Object.assign(profile, patch);
  return true;
}

export async function refreshTeamSnapshots(teamId: string): Promise<void> {
  const teamRow = await db.select().from(team).where(eq(team.id, teamId)).get();
  if (!teamRow) return;

  const pilotsWithTeam = await db
    .select({ id: pilot.id })
    .from(pilot)
    .where(eq(pilot.teamId, teamId))
    .all();

  const entries = await activeEntryIdsForPilots(pilotsWithTeam.map(p => p.id));
  if (entries.length === 0) return;

  const snap = { ...teamRow };
  let ctxChanged = false;

  for (const entry of entries) {
    await db.update(raceEntry)
      .set({ teamSnapshot: snap })
      .where(eq(raceEntry.id, entry.entryId));
    if (patchLiveContext(entry.pilotId, { teamSnapshot: snap })) ctxChanged = true;
  }

  if (ctxChanged) {
    const ctx = getContext()!;
    broadcastRaceState(ctx);
  }
}

export async function refreshVehicleSnapshots(vehicleId: string): Promise<void> {
  const vehicleRow = await db.select().from(vehicle).where(eq(vehicle.id, vehicleId)).get();
  if (!vehicleRow) return;

  const pilotsWithVehicle = await db
    .select({ id: pilot.id })
    .from(pilot)
    .where(eq(pilot.vehicleId, vehicleId))
    .all();

  const entries = await activeEntryIdsForPilots(pilotsWithVehicle.map(p => p.id));
  if (entries.length === 0) return;

  const snap = { ...vehicleRow };
  let ctxChanged = false;

  for (const entry of entries) {
    await db.update(raceEntry)
      .set({ vehicleSnapshot: snap })
      .where(eq(raceEntry.id, entry.entryId));
    if (patchLiveContext(entry.pilotId, { vehicleSnapshot: snap })) ctxChanged = true;
  }

  if (ctxChanged) {
    const ctx = getContext()!;
    broadcastRaceState(ctx);
  }
}

export async function refreshControlsSnapshots(controlsId: string): Promise<void> {
  const controlsRow = await db.select().from(controls).where(eq(controls.id, controlsId)).get();
  if (!controlsRow) return;

  const pilotsWithControls = await db
    .select({ id: pilot.id })
    .from(pilot)
    .where(eq(pilot.controlsId, controlsId))
    .all();

  const entries = await activeEntryIdsForPilots(pilotsWithControls.map(p => p.id));
  if (entries.length === 0) return;

  const snap = { ...controlsRow };
  let ctxChanged = false;

  for (const entry of entries) {
    await db.update(raceEntry)
      .set({ controlsSnapshot: snap })
      .where(eq(raceEntry.id, entry.entryId));
    if (patchLiveContext(entry.pilotId, { controlsSnapshot: snap })) ctxChanged = true;
  }

  if (ctxChanged) {
    const ctx = getContext()!;
    broadcastRaceState(ctx);
  }
}

export async function refreshPilotEntrySnapshots(pilotId: string): Promise<void> {
  const p = await db.select().from(pilot).where(eq(pilot.id, pilotId)).get();
  if (!p) return;

  const entries = await activeEntryIdsForPilots([pilotId]);
  if (entries.length === 0) return;

  const teamSnap = p.teamId
    ? await db.select().from(team).where(eq(team.id, p.teamId)).get() ?? null
    : null;
  const vehicleSnap = p.vehicleId
    ? await db.select().from(vehicle).where(eq(vehicle.id, p.vehicleId)).get() ?? null
    : null;
  const controlsSnap = p.controlsId
    ? await db.select().from(controls).where(eq(controls.id, p.controlsId)).get() ?? null
    : null;

  let ctxChanged = false;

  for (const entry of entries) {
    await db.update(raceEntry)
      .set({
        teamSnapshot: teamSnap ? { ...teamSnap } : null,
        vehicleSnapshot: vehicleSnap ? { ...vehicleSnap } : null,
        controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
      })
      .where(eq(raceEntry.id, entry.entryId));

    const patched = patchLiveContext(pilotId, {
      displayName: p.displayName,
      country: p.country ?? "un",
      teamSnapshot: teamSnap ? { ...teamSnap } : null,
      vehicleSnapshot: vehicleSnap ? { ...vehicleSnap } : null,
      controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
    });
    if (patched) ctxChanged = true;
  }

  if (ctxChanged) {
    const ctx = getContext()!;
    broadcastRaceState(ctx);
  }
}
