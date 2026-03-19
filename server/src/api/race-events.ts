// race-events.ts — Commandes admin en direct : contrôles manuels, grille,
// countdown, DNF AUTO, override position AUTO.

import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { raceEntry } from "../db/schema.js";
import { requireModo } from "../middleware/roles.js";
import {
  getContext, setPilotState, persistState,
  incrementLap, setManualPosition, reorderPilot, toggleDnf, setGridOrder,
} from "../engine/race-context.js";
import { emitAll, broadcastRaceState } from "../socket/emitter.js";

const router = Router();

// ---------------------------------------------------------------------------
// Helper — vérifie que le contexte est chargé pour la course donnée
// ---------------------------------------------------------------------------

function requireContext(raceId: string | string[], res: Parameters<Parameters<typeof router.post>[1]>[1]) {
  raceId = String(raceId);
  const ctx = getContext();
  if (!ctx || ctx.raceId !== raceId) {
    res.status(409).json({ error: "Race context not loaded or race mismatch" });
    return null;
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/manual-lap — modo+
// Body: { pilotId, delta: 1 | -1 }
// ---------------------------------------------------------------------------

router.post("/races/:id/manual-lap", ...requireModo, async (req, res) => {
  const ctx = requireContext(req.params.id, res);
  if (!ctx) return;

  const { pilotId, delta } = req.body;
  if (!pilotId || (delta !== 1 && delta !== -1)) {
    res.status(400).json({ error: "pilotId and delta (1 or -1) are required" });
    return;
  }
  if (!ctx.pilotStates[pilotId]) {
    res.status(404).json({ error: "Pilot not in race" });
    return;
  }

  const result = incrementLap(pilotId, delta as 1 | -1);
  if (!result) {
    res.status(409).json({ error: "Cannot increment lap for this pilot" });
    return;
  }

  // Emit engine events
  const profile = ctx.pilotProfiles[pilotId];
  for (const event of result.events) {
    if (event.type === "fastest-lap") {
      emitAll("race-event", {
        type: "fastest-lap",
        pilotId,
        pilotName: profile?.displayName ?? pilotId,
        pilotCountry: profile?.country ?? "un",
        teamName:  (profile?.teamSnapshot as Record<string, unknown>)?.name ?? null,
        teamColor: (profile?.teamSnapshot as Record<string, unknown>)?.color ?? null,
        shipModel: (profile?.vehicleSnapshot as Record<string, unknown>)?.model ?? null,
        lapMs: event.lapMs,
        lapFormatted: event.lapFormatted,
        displayDuration: ctx.eventDuration,
      });
    } else if (event.type === "finished") {
      emitAll("race-event", {
        type: "finished",
        pilotId,
        pilotName: profile?.displayName ?? pilotId,
        pilotCountry: profile?.country ?? "un",
        teamName:  (profile?.teamSnapshot as Record<string, unknown>)?.name ?? null,
        teamColor: (profile?.teamSnapshot as Record<string, unknown>)?.color ?? null,
        displayDuration: ctx.eventDuration,
      });
    } else if (event.type === "race-finished") {
      emitAll("race-event", { type: "race-finished" });
    }
  }

  broadcastRaceState(ctx);
  persistState();

  res.json({ ok: true, lap: ctx.pilotStates[pilotId]?.lap });
});

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/manual-position — modo+
// Body: { pilotId, position: number }
// ---------------------------------------------------------------------------

router.post("/races/:id/manual-position", ...requireModo, async (req, res) => {
  const ctx = requireContext(req.params.id, res);
  if (!ctx) return;

  const { pilotId, position } = req.body;
  if (!pilotId || typeof position !== "number") {
    res.status(400).json({ error: "pilotId and position (number) are required" });
    return;
  }
  if (!ctx.pilotStates[pilotId]) {
    res.status(404).json({ error: "Pilot not in race" });
    return;
  }

  setManualPosition(pilotId, position);

  // Persist gridPosition to DB
  await db
    .update(raceEntry)
    .set({ gridPosition: ctx.pilotStates[pilotId].gridPosition })
    .where(eq(raceEntry.pilotId, pilotId));

  broadcastRaceState(ctx);
  persistState();

  res.json({ ok: true, gridPosition: ctx.pilotStates[pilotId].gridPosition });
});

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/manual-reorder — modo+
// Body: { pilotId, direction: "up" | "down" }
// ---------------------------------------------------------------------------

router.post("/races/:id/manual-reorder", ...requireModo, async (req, res) => {
  const ctx = requireContext(req.params.id, res);
  if (!ctx) return;

  const { pilotId, direction } = req.body;
  if (!pilotId || (direction !== "up" && direction !== "down")) {
    res.status(400).json({ error: 'pilotId and direction ("up" or "down") are required' });
    return;
  }
  if (!ctx.pilotStates[pilotId]) {
    res.status(404).json({ error: "Pilot not in race" });
    return;
  }

  reorderPilot(pilotId, direction);

  // Persist all grid positions to DB
  await Promise.all(
    Object.entries(ctx.pilotStates).map(([pid, state]) =>
      db.update(raceEntry).set({ gridPosition: state.gridPosition }).where(eq(raceEntry.pilotId, pid))
    )
  );

  broadcastRaceState(ctx);
  persistState();

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/manual-dnf — modo+
// Body: { pilotId }  — toggle DNF / RUNNING
// ---------------------------------------------------------------------------

router.post("/races/:id/manual-dnf", ...requireModo, async (req, res) => {
  const ctx = requireContext(req.params.id, res);
  if (!ctx) return;

  const { pilotId } = req.body;
  if (!pilotId) {
    res.status(400).json({ error: "pilotId is required" });
    return;
  }
  if (!ctx.pilotStates[pilotId]) {
    res.status(404).json({ error: "Pilot not in race" });
    return;
  }

  toggleDnf(pilotId);

  const state = ctx.pilotStates[pilotId];
  if (state.status === "DNF") {
    const profile = ctx.pilotProfiles[pilotId];
    emitAll("race-event", {
      type: "dnf",
      pilotId,
      pilotName: profile?.displayName ?? pilotId,
      pilotCountry: profile?.country ?? "un",
      teamName:  (profile?.teamSnapshot as Record<string, unknown>)?.name ?? null,
      teamColor: (profile?.teamSnapshot as Record<string, unknown>)?.color ?? null,
      displayDuration: ctx.eventDuration,
    });
  }

  broadcastRaceState(ctx);
  persistState();

  res.json({ ok: true, status: state.status });
});

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/grid-order — modo+
// Body: { pilotIds: string[] }
// ---------------------------------------------------------------------------

router.post("/races/:id/grid-order", ...requireModo, async (req, res) => {
  const ctx = requireContext(req.params.id, res);
  if (!ctx) return;

  const { pilotIds } = req.body;
  if (!Array.isArray(pilotIds)) {
    res.status(400).json({ error: "pilotIds must be an array" });
    return;
  }

  setGridOrder(pilotIds);

  // Persist to DB
  await Promise.all(
    pilotIds.map((pid, i) =>
      db.update(raceEntry).set({ gridPosition: i + 1 }).where(eq(raceEntry.pilotId, pid))
    )
  );

  broadcastRaceState(ctx);
  persistState();

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/countdown — modo+
// Body: { seconds: number }
// ---------------------------------------------------------------------------

router.post("/races/:id/countdown", ...requireModo, async (req, res) => {
  const { seconds } = req.body;
  if (typeof seconds !== "number" || seconds < 1) {
    res.status(400).json({ error: "seconds must be a positive number" });
    return;
  }

  emitAll("race-event", { type: "countdown", seconds });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/countdown-stop — modo+
// ---------------------------------------------------------------------------

router.post("/races/:id/countdown-stop", ...requireModo, async (req, res) => {
  emitAll("race-event", { type: "countdown-stop" });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/confirm-dnf/:pilotId — modo+ (AUTO)
// Confirme un WARNING_DNF → DNF officiel.
// ---------------------------------------------------------------------------

router.post("/races/:id/confirm-dnf/:pilotId", ...requireModo, async (req, res) => {
  const raceId  = String(req.params.id);
  const pilotId = String(req.params.pilotId);
  const ctx = requireContext(raceId, res);
  if (!ctx) return;

  const state = ctx.pilotStates[pilotId];
  if (!state) { res.status(404).json({ error: "Pilot not in race" }); return; }

  setPilotState(pilotId, {
    status: "DNF",
    frozenTime: new Date().toISOString(),
    dnfWarning: false,
  });

  const profile = ctx.pilotProfiles[pilotId];
  emitAll("race-event", {
    type: "dnf",
    pilotId,
    pilotName: profile?.displayName ?? pilotId,
    pilotCountry: profile?.country ?? "un",
    teamName:  (profile?.teamSnapshot as Record<string, unknown>)?.name ?? null,
    teamColor: (profile?.teamSnapshot as Record<string, unknown>)?.color ?? null,
    displayDuration: ctx.eventDuration,
  });

  broadcastRaceState(ctx);
  persistState();

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/ignore-dnf/:pilotId — modo+ (AUTO)
// Faux positif : efface le WARNING_DNF.
// ---------------------------------------------------------------------------

router.post("/races/:id/ignore-dnf/:pilotId", ...requireModo, async (req, res) => {
  const raceId  = String(req.params.id);
  const pilotId = String(req.params.pilotId);
  const ctx = requireContext(raceId, res);
  if (!ctx) return;

  const state = ctx.pilotStates[pilotId];
  if (!state) { res.status(404).json({ error: "Pilot not in race" }); return; }

  setPilotState(pilotId, { status: "RUNNING", dnfWarning: false });
  persistState();

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /race-events/races/:id/override-position — modo+ (AUTO)
// Body: { pilotId, position: number } — forcer un rang en mode AUTO
// ---------------------------------------------------------------------------

router.post("/races/:id/override-position", ...requireModo, async (req, res) => {
  const ctx = requireContext(req.params.id, res);
  if (!ctx) return;

  const { pilotId, position } = req.body;
  if (!pilotId || typeof position !== "number") {
    res.status(400).json({ error: "pilotId and position (number) are required" });
    return;
  }
  if (!ctx.pilotStates[pilotId]) {
    res.status(404).json({ error: "Pilot not in race" });
    return;
  }

  setManualPosition(pilotId, position);
  broadcastRaceState(ctx);
  persistState();

  res.json({ ok: true, gridPosition: ctx.pilotStates[pilotId].gridPosition });
});

export default router;
