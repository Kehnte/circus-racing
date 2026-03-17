import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/db.js";
import { race, raceEntry, raceState, pilot, team, vehicle, controls } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { requireModo } from "../middleware/roles.js";
import { loadRace, getContext, clearContext, setPilotState, persistState } from "../engine/race-context.js";
import { emitAll, emitDashboard, broadcastRaceState } from "../socket/emitter.js";

const router = Router();

// ---------------------------------------------------------------------------
// Races
// ---------------------------------------------------------------------------

/**
 * GET /races — public
 * Returns all races. Optionally filter by status: ?status=PENDING,SCHEDULED
 */
router.get("/", async (req, res) => {
  const all = await db.select().from(race).all();
  const { status } = req.query;
  if (status) {
    const statuses = String(status).split(",");
    res.json(all.filter(r => statuses.includes(r.status)));
    return;
  }
  res.json(all);
});

/** GET /races/:id — public */
router.get("/:id", async (req, res) => {
  const found = await db.select().from(race).where(eq(race.id, String(req.params.id))).get();
  if (!found) { res.status(404).json({ error: "Race not found" }); return; }
  res.json(found);
});

/** POST /races — admin/modo */
router.post("/", ...requireModo, async (req, res) => {
  const {
    name, racetrackId, lapCount, session, weather, startType,
    trackingMode, sessionMode, sessionDurationMs,
    teamDisplayMode, chronoDisplayMode, timingEnabled, eventDuration,
  } = req.body;

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if ((trackingMode ?? "manual") === "auto" && !racetrackId) {
    res.status(400).json({ error: "racetrackId is required for auto tracking mode" });
    return;
  }

  const [created] = await db.insert(race).values({
    name,
    racetrackId,
    lapCount:          lapCount          ?? 3,
    session:           session           ?? "Race",
    weather:           weather           ?? "Clear",
    startType:         startType         ?? "Grid Start",
    trackingMode:      trackingMode      ?? "manual",
    sessionMode:       sessionMode       ?? "laps",
    sessionDurationMs: sessionDurationMs ?? null,
    teamDisplayMode:   teamDisplayMode   ?? "color-bar",
    chronoDisplayMode: chronoDisplayMode ?? "gap",
    timingEnabled:     timingEnabled     ?? true,
    eventDuration:     eventDuration     ?? 5,
  }).returning();

  res.status(201).json(created);
});

/** PATCH /races/:id — admin/modo */
router.patch("/:id", ...requireModo, async (req, res) => {
  const allowed = [
    "name", "racetrackId", "lapCount", "session", "weather", "startType",
    "trackingMode", "sessionMode", "sessionDurationMs",
    "teamDisplayMode", "chronoDisplayMode", "timingEnabled", "eventDuration", "status",
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }

  const [updated] = await db.update(race).set(patch).where(eq(race.id, String(req.params.id))).returning();
  if (!updated) { res.status(404).json({ error: "Race not found" }); return; }
  res.json(updated);
});

/** DELETE /races/:id — admin/modo */
router.delete("/:id", ...requireModo, async (req, res) => {
  await db.delete(race).where(eq(race.id, String(req.params.id)));
  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// Race entries
// ---------------------------------------------------------------------------

/**
 * GET /races/:id/entries — admin/modo
 * Returns all entries for a race with pilot info joined.
 */
router.get("/:id/entries", ...requireModo, async (req, res) => {
  const entries = await db
    .select()
    .from(raceEntry)
    .where(eq(raceEntry.raceId, String(req.params.id)))
    .all();

  // Join pilot display info
  const enriched = await Promise.all(entries.map(async (entry) => {
    const p = await db.select({
      id: pilot.id,
      displayName: pilot.displayName,
      country: pilot.country,
      avatarUrl: pilot.avatarUrl,
      teamId: pilot.teamId,
      vehicleId: pilot.vehicleId,
      controlsId: pilot.controlsId,
    }).from(pilot).where(eq(pilot.id, entry.pilotId)).get();
    return { ...entry, pilot: p ?? null };
  }));

  res.json(enriched);
});

/**
 * GET /races/:id/entries/me — authenticated pilot
 * Returns the current pilot's entry for this race if it exists.
 */
router.get("/:id/entries/me", requireAuth, async (req, res) => {
  const entry = await db
    .select()
    .from(raceEntry)
    .where(and(
      eq(raceEntry.raceId, String(req.params.id)),
      eq(raceEntry.pilotId, req.user!.id),
    ))
    .get();
  if (!entry) { res.status(404).json({ error: "No entry found" }); return; }
  res.json(entry);
});

/**
 * POST /races/:id/entries — authenticated pilot
 * Register the current pilot to a race. Race must be PENDING or SCHEDULED.
 */
router.post("/:id/entries", requireAuth, async (req, res) => {
  const raceId = String(req.params.id);
  const pilotId = req.user!.id;

  const targetRace = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!targetRace) { res.status(404).json({ error: "Race not found" }); return; }
  if (!["PENDING", "SCHEDULED"].includes(targetRace.status)) {
    res.status(409).json({ error: "Race is not open for registration" });
    return;
  }

  // Prevent duplicate entry
  const existing = await db
    .select()
    .from(raceEntry)
    .where(and(eq(raceEntry.raceId, raceId), eq(raceEntry.pilotId, pilotId)))
    .get();
  if (existing) {
    res.status(409).json({ error: "Already registered for this race" });
    return;
  }

  const [created] = await db.insert(raceEntry).values({ raceId, pilotId }).returning();
  res.status(201).json(created);
});

/**
 * POST /races/:id/entries/admin — admin/modo
 * Admin directly adds a pilot to a race as VALIDATED (bypasses self-registration).
 * Body: { pilotId: string }
 */
router.post("/:id/entries/admin", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const { pilotId } = req.body;

  if (!pilotId) { res.status(400).json({ error: "pilotId is required" }); return; }

  const targetRace = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!targetRace) { res.status(404).json({ error: "Race not found" }); return; }
  if (targetRace.status === "FINISHED") {
    res.status(409).json({ error: "Cannot add pilots to a finished race" }); return;
  }

  const p = await db.select().from(pilot).where(eq(pilot.id, pilotId)).get();
  if (!p) { res.status(404).json({ error: "Pilot not found" }); return; }

  const existing = await db
    .select()
    .from(raceEntry)
    .where(and(eq(raceEntry.raceId, raceId), eq(raceEntry.pilotId, pilotId)))
    .get();
  if (existing) { res.status(409).json({ error: "Pilot already registered for this race" }); return; }

  const teamSnap     = p.teamId     ? await db.select().from(team).where(eq(team.id, p.teamId)).get()         : null;
  const vehicleSnap  = p.vehicleId  ? await db.select().from(vehicle).where(eq(vehicle.id, p.vehicleId)).get() : null;
  const controlsSnap = p.controlsId ? await db.select().from(controls).where(eq(controls.id, p.controlsId)).get() : null;

  const [created] = await db.insert(raceEntry).values({
    raceId,
    pilotId,
    status: "VALIDATED",
    teamSnapshot:     teamSnap     ? { ...teamSnap }     : null,
    vehicleSnapshot:  vehicleSnap  ? { ...vehicleSnap }  : null,
    controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
  }).returning();

  res.status(201).json(created);
});

/**
 * PATCH /races/:raceId/entries/:entryId/validate — admin/modo
 * Validates a PENDING entry → VALIDATED. Saves snapshots.
 */
router.patch("/:raceId/entries/:entryId/validate", ...requireModo, async (req, res) => {
  const entry = await db
    .select()
    .from(raceEntry)
    .where(eq(raceEntry.id, String(req.params.entryId)))
    .get();

  if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
  if (entry.status !== "PENDING") {
    res.status(409).json({ error: "Entry is not in PENDING status" });
    return;
  }

  // Load pilot + linked entities for snapshots
  const p = await db.select().from(pilot).where(eq(pilot.id, entry.pilotId)).get();
  if (!p) { res.status(404).json({ error: "Pilot not found" }); return; }

  const teamSnap     = p.teamId     ? await db.select().from(team).where(eq(team.id, p.teamId)).get()         : null;
  const vehicleSnap  = p.vehicleId  ? await db.select().from(vehicle).where(eq(vehicle.id, p.vehicleId)).get() : null;
  const controlsSnap = p.controlsId ? await db.select().from(controls).where(eq(controls.id, p.controlsId)).get() : null;

  const [updated] = await db
    .update(raceEntry)
    .set({
      status:          "VALIDATED",
      teamSnapshot:    teamSnap     ? { ...teamSnap }     : null,
      vehicleSnapshot: vehicleSnap  ? { ...vehicleSnap }  : null,
      controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
    })
    .where(eq(raceEntry.id, entry.id))
    .returning();

  res.json(updated);
});

/**
 * DELETE /races/:raceId/entries/:entryId — admin/modo or own pilot
 * Remove a PENDING entry (cancel registration).
 */
router.delete("/:raceId/entries/:entryId", requireAuth, async (req, res) => {
  const entry = await db
    .select()
    .from(raceEntry)
    .where(eq(raceEntry.id, String(req.params.entryId)))
    .get();

  if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }

  const user = req.user!;
  const isAdminOrModo = ["ADMIN", "MODERATOR"].includes(user.role);
  const isOwner = entry.pilotId === user.id;

  if (!isAdminOrModo && !isOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!isAdminOrModo && entry.status !== "PENDING") {
    res.status(409).json({ error: "Cannot cancel a validated entry" });
    return;
  }

  await db.delete(raceEntry).where(eq(raceEntry.id, entry.id));
  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// Race lifecycle
// ---------------------------------------------------------------------------

/**
 * POST /races/:id/start — admin/modo
 * Starts a SCHEDULED race (fresh) or resumes a PAUSED race.
 */
router.post("/:id/start", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found) { res.status(404).json({ error: "Race not found" }); return; }

  if (found.status === "SCHEDULED" || found.status === "PENDING") {
    // Fresh start
    const ctx = await loadRace(raceId);
    ctx.startedAt = new Date().toISOString();
    await db.update(race).set({ status: "STARTED" }).where(eq(race.id, raceId));
    await persistState();
    emitAll("race-restarted");
    broadcastRaceState(ctx);
    res.json({ ok: true, status: "STARTED" });

  } else if (found.status === "PAUSED") {
    // Resume
    const ctx = getContext();
    if (!ctx || ctx.raceId !== raceId) {
      res.status(409).json({ error: "Race context not loaded — restart the server or reload the race" });
      return;
    }
    const pausedAt = ctx.pausedAt ? new Date(ctx.pausedAt).getTime() : Date.now();
    ctx.totalPausedMs += Date.now() - pausedAt;
    ctx.pausedAt = null;
    await db.update(race).set({ status: "STARTED" }).where(eq(race.id, raceId));
    await persistState();
    emitAll("race-resumed");
    broadcastRaceState(ctx);
    res.json({ ok: true, status: "STARTED" });

  } else {
    res.status(409).json({ error: `Cannot start a race with status ${found.status}` });
  }
});

/**
 * POST /races/:id/pause — admin/modo
 */
router.post("/:id/pause", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found || found.status !== "STARTED") {
    res.status(409).json({ error: "Race is not STARTED" });
    return;
  }

  const ctx = getContext();
  if (!ctx || ctx.raceId !== raceId) {
    res.status(409).json({ error: "Race context not loaded" });
    return;
  }

  ctx.pausedAt = new Date().toISOString();
  await db.update(race).set({ status: "PAUSED" }).where(eq(race.id, raceId));
  await persistState();
  broadcastRaceState(ctx);
  res.json({ ok: true, status: "PAUSED" });
});

/**
 * POST /races/:id/resume — admin/modo (alias for start on PAUSED)
 */
router.post("/:id/resume", ...requireModo, async (req, res) => {
  req.params.id = req.params.id; // passthrough
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found || found.status !== "PAUSED") {
    res.status(409).json({ error: "Race is not PAUSED" });
    return;
  }

  const ctx = getContext();
  if (!ctx || ctx.raceId !== raceId) {
    res.status(409).json({ error: "Race context not loaded" });
    return;
  }

  const pausedAt = ctx.pausedAt ? new Date(ctx.pausedAt).getTime() : Date.now();
  ctx.totalPausedMs += Date.now() - pausedAt;
  ctx.pausedAt = null;
  await db.update(race).set({ status: "STARTED" }).where(eq(race.id, raceId));
  await persistState();
  emitAll("race-resumed");
  broadcastRaceState(ctx);
  res.json({ ok: true, status: "STARTED" });
});

/**
 * POST /races/:id/finish — admin/modo
 * Force-finishes all still-running pilots and closes the race.
 */
router.post("/:id/finish", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found || !["STARTED", "PAUSED"].includes(found.status)) {
    res.status(409).json({ error: "Race is not active" });
    return;
  }

  const ctx = getContext();
  if (ctx && ctx.raceId === raceId) {
    const nowIso = new Date().toISOString();
    for (const [pilotId, state] of Object.entries(ctx.pilotStates)) {
      if (state.status === "RUNNING" || state.status === "WARNING_DNF") {
        setPilotState(pilotId, { status: "FINISHED", frozenTime: nowIso });
      }
    }
    broadcastRaceState(ctx);
    emitAll("race-event", { type: "race-finished" });
    await db.update(race).set({ status: "FINISHED" }).where(eq(race.id, raceId));
    await clearContext();
  } else {
    await db.update(race).set({ status: "FINISHED" }).where(eq(race.id, raceId));
  }

  res.json({ ok: true, status: "FINISHED" });
});

/**
 * PATCH /races/:id/tracking-mode — admin/modo
 * Body: { trackingMode: "manual" | "auto" }
 */
router.patch("/:id/tracking-mode", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const { trackingMode } = req.body;

  if (trackingMode !== "manual" && trackingMode !== "auto") {
    res.status(400).json({ error: 'trackingMode must be "manual" or "auto"' });
    return;
  }

  const [updated] = await db
    .update(race)
    .set({ trackingMode })
    .where(eq(race.id, raceId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Race not found" }); return; }

  // Update in-memory context if loaded
  const ctx = getContext();
  if (ctx && ctx.raceId === raceId) {
    ctx.trackingMode = trackingMode;
  }

  emitDashboard("tracking-mode-changed", { raceId, trackingMode });
  res.json(updated);
});

/**
 * POST /races/:id/open-registrations — admin/modo
 * Transitions a PENDING race to SCHEDULED, opening registrations.
 */
router.post("/:id/open-registrations", ...requireModo, async (req, res) => {
  const found = await db.select().from(race).where(eq(race.id, String(req.params.id))).get();
  if (!found) { res.status(404).json({ error: "Race not found" }); return; }
  if (found.status !== "PENDING") {
    res.status(409).json({ error: "Race must be PENDING to open registrations" });
    return;
  }
  const [updated] = await db.update(race).set({ status: "SCHEDULED" }).where(eq(race.id, String(req.params.id))).returning();
  res.json(updated);
});

/**
 * POST /races/:id/close-registrations — admin/modo
 * Transitions a SCHEDULED race back to PENDING, closing registrations.
 */
router.post("/:id/close-registrations", ...requireModo, async (req, res) => {
  const found = await db.select().from(race).where(eq(race.id, String(req.params.id))).get();
  if (!found) { res.status(404).json({ error: "Race not found" }); return; }
  if (found.status !== "SCHEDULED") {
    res.status(409).json({ error: "Race must be SCHEDULED to close registrations" });
    return;
  }
  const [updated] = await db.update(race).set({ status: "PENDING" }).where(eq(race.id, String(req.params.id))).returning();
  res.json(updated);
});

export default router;
