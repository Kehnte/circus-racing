import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { raceEntry, pilot } from "../db/schema.js";
import { requireModo } from "../middleware/roles.js";
import { getContext, setPilotState, persistState } from "../engine/race-context.js";
import { emitAll, broadcastRaceState } from "../socket/emitter.js";

const router = Router();

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/confirm-dnf/:pilotId — admin/modo
// Confirms a WARNING_DNF pilot as officially DNF.
// ---------------------------------------------------------------------------

router.post("/races/:id/confirm-dnf/:pilotId", ...requireModo, async (req, res) => {
  const { id: raceId, pilotId } = req.params;
  const ctx = getContext();

  if (!ctx || ctx.raceId !== raceId) {
    res.status(409).json({ error: "Race not active or context not loaded" });
    return;
  }

  const state = ctx.pilotStates[pilotId];
  if (!state) {
    res.status(404).json({ error: "Pilot not in race" });
    return;
  }

  const nowIso = new Date().toISOString();
  setPilotState(pilotId, {
    status: "DNF",
    frozenTime: nowIso,
    dnfWarning: false,
  });

  // Update raceEntry in DB
  await db
    .update(raceEntry)
    .set({ status: "DNF" })
    .where(eq(raceEntry.pilotId, pilotId));

  // Emit overlay event for incident/DNF
  const profile = ctx.pilotProfiles[pilotId];
  emitAll("race-event", {
    type: "incident",
    pilotId,
    pilotName: profile?.displayName ?? pilotId,
    pilotCountry: profile?.country ?? "un",
    teamName: (profile?.teamSnapshot as Record<string, unknown>)?.name ?? null,
    teamColor: (profile?.teamSnapshot as Record<string, unknown>)?.color ?? null,
    shipModel: (profile?.vehicleSnapshot as Record<string, unknown>)?.model ?? null,
    displayDuration: ctx.eventDuration,
  });

  broadcastRaceState(ctx);
  persistState();

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/ignore-dnf/:pilotId — admin/modo
// Clears the WARNING_DNF flag (false positive).
// ---------------------------------------------------------------------------

router.post("/races/:id/ignore-dnf/:pilotId", ...requireModo, async (req, res) => {
  const { id: raceId, pilotId } = req.params;
  const ctx = getContext();

  if (!ctx || ctx.raceId !== raceId) {
    res.status(409).json({ error: "Race not active or context not loaded" });
    return;
  }

  const state = ctx.pilotStates[pilotId];
  if (!state) {
    res.status(404).json({ error: "Pilot not in race" });
    return;
  }

  setPilotState(pilotId, { status: "RUNNING", dnfWarning: false });
  persistState();

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/manual-incident — admin/modo
// Body: { pilotId: string }
// Manually triggers an incident overlay alert (no status change).
// ---------------------------------------------------------------------------

router.post("/races/:id/manual-incident", ...requireModo, async (req, res) => {
  const { id: raceId } = req.params;
  const { pilotId } = req.body;

  if (!pilotId) {
    res.status(400).json({ error: "pilotId is required" });
    return;
  }

  const ctx = getContext();
  const profile = ctx?.pilotProfiles[pilotId];

  // Look up pilot info even if no active AUTO context (MANUAL mode incidents)
  const pilotRow = !profile
    ? await db.select({
        displayName: pilot.displayName,
        country: pilot.country,
      }).from(pilot).where(eq(pilot.id, pilotId)).get()
    : null;

  emitAll("race-event", {
    type: "incident",
    pilotId,
    pilotName: profile?.displayName ?? pilotRow?.displayName ?? pilotId,
    pilotCountry: profile?.country ?? pilotRow?.country ?? "un",
    teamName: (profile?.teamSnapshot as Record<string, unknown>)?.name ?? null,
    teamColor: (profile?.teamSnapshot as Record<string, unknown>)?.color ?? null,
    shipModel: (profile?.vehicleSnapshot as Record<string, unknown>)?.model ?? null,
    displayDuration: ctx?.eventDuration ?? 5,
  });

  res.json({ ok: true });
});

export default router;
