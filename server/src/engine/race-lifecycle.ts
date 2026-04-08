// race-lifecycle.ts — Shared helpers for programmatic race start and countdown timers.

import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { race } from "../db/schema.js";
import { loadRace, getContext, persistState } from "./race-context.js";
import { emitDashboard, broadcastRaceState } from "../socket/emitter.js";

// Module-level countdown timer map, shared across countdown and start endpoints.
const countdownTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function clearCountdownTimer(raceId: string): void {
  const t = countdownTimers.get(raceId);
  if (t) { clearTimeout(t); countdownTimers.delete(raceId); }
}

export function setCountdownTimer(raceId: string, seconds: number, onFire: () => void): void {
  clearCountdownTimer(raceId);
  countdownTimers.set(raceId, setTimeout(() => {
    countdownTimers.delete(raceId);
    onFire();
  }, seconds * 1000));
}

// Starts a PENDING or SCHEDULED race (same logic as POST /races/:id/start fresh-start branch).
export async function startRaceById(raceId: string): Promise<void> {
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found) throw new Error("Race not found");
  if (found.status !== "SCHEDULED" && found.status !== "PENDING") {
    throw new Error(`Cannot start a race with status ${found.status}`);
  }
  let ctx = getContext();
  if (!ctx || ctx.raceId !== raceId) {
    ctx = await loadRace(raceId);
  }
  ctx.startedAt = new Date().toISOString();
  ctx.raceStatus = "STARTED";
  await db.update(race).set({ status: "STARTED" }).where(eq(race.id, raceId));
  await persistState();
  emitDashboard("race-list-changed");
  broadcastRaceState(ctx);
}
