// races.ts — Race CRUD, registration management, lifecycle (load/start/pause/resume/finish/reset).

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/db.js";
import { race, raceEntry, raceState, pilot, team, vehicle, controls } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { requireModo } from "../middleware/roles.js";
import {
  loadRace, getContext, clearContext, setPilotState, persistState, setGridOrder,
} from "../engine/race-context.js";
import { emitAll, emitDashboard, broadcastRaceState } from "../socket/emitter.js";

const router = Router();

// Races CRUD

/** GET /races — public */
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

/** POST /races — modo+ */
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

/** PATCH /races/:id — modo+. Blocks trackingMode if STARTED. */
router.patch("/:id", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found) { res.status(404).json({ error: "Race not found" }); return; }

  if (req.body.trackingMode !== undefined && found.status === "STARTED") {
    res.status(409).json({ error: "Cannot change trackingMode while race is STARTED" });
    return;
  }

  const allowed = [
    "name", "racetrackId", "lapCount", "session", "weather", "startType",
    "trackingMode", "sessionMode", "sessionDurationMs",
    "teamDisplayMode", "chronoDisplayMode", "timingEnabled", "eventDuration",
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }

  const [updated] = await db.update(race).set(patch).where(eq(race.id, raceId)).returning();

  // Sync display settings in live context if loaded
  const ctx = getContext();
  if (ctx && ctx.raceId === raceId) {
    if (patch.teamDisplayMode)   ctx.teamDisplayMode   = patch.teamDisplayMode as typeof ctx.teamDisplayMode;
    if (patch.chronoDisplayMode) ctx.chronoDisplayMode = patch.chronoDisplayMode as typeof ctx.chronoDisplayMode;
    if (patch.timingEnabled !== undefined) ctx.timingEnabled = patch.timingEnabled as boolean;
    if (patch.eventDuration)     ctx.eventDuration     = patch.eventDuration as number;
    if (patch.name)              ctx.raceName          = patch.name as string;
    if (patch.session)           ctx.session           = patch.session as string;
    if (patch.weather)           ctx.weather           = patch.weather as string;
    if (patch.startType)         ctx.startType         = patch.startType as string;
    if (patch.lapCount)          ctx.lapCount          = patch.lapCount as number;
    broadcastRaceState(ctx);
  }

  res.json(updated);
});

/** DELETE /races/:id — modo+. Blocked if STARTED or PAUSED. */
router.delete("/:id", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found) { res.status(404).json({ error: "Race not found" }); return; }

  if (found.status === "STARTED" || found.status === "PAUSED") {
    res.status(409).json({ error: "Cannot delete a race that is STARTED or PAUSED" });
    return;
  }

  await db.delete(race).where(eq(race.id, raceId));
  res.sendStatus(204);
});

// Race entries

/** GET /races/:id/entries — modo+ */
router.get("/:id/entries", ...requireModo, async (req, res) => {
  const entries = await db
    .select()
    .from(raceEntry)
    .where(eq(raceEntry.raceId, String(req.params.id)))
    .all();

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

/** GET /races/:id/entries/me — authenticated pilot */
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

/** POST /races/:id/entries — authenticated pilot (self-register) */
router.post("/:id/entries", requireAuth, async (req, res) => {
  const raceId = String(req.params.id);
  const pilotId = req.user!.id;

  const targetRace = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!targetRace) { res.status(404).json({ error: "Race not found" }); return; }
  if (!["PENDING", "SCHEDULED"].includes(targetRace.status)) {
    res.status(409).json({ error: "Race is not open for registration" });
    return;
  }

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

/** POST /races/:id/entries/admin — modo+ (direct add as VALIDATED) */
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

  // Assign grid position at end of current list
  const existingEntries = await db
    .select({ gridPosition: raceEntry.gridPosition })
    .from(raceEntry)
    .where(and(eq(raceEntry.raceId, raceId), eq(raceEntry.status, "VALIDATED")))
    .all();
  const maxPos = existingEntries.reduce((m, e) => Math.max(m, e.gridPosition ?? 0), 0);

  const [created] = await db.insert(raceEntry).values({
    raceId,
    pilotId,
    status: "VALIDATED",
    gridPosition: maxPos + 1,
    teamSnapshot:     teamSnap     ? { ...teamSnap }     : null,
    vehicleSnapshot:  vehicleSnap  ? { ...vehicleSnap }  : null,
    controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
  }).returning();

  try {
    const ctx = getContext();
    if (ctx?.raceId === raceId && (ctx.raceStatus === "PENDING" || ctx.raceStatus === "SCHEDULED")) {
      broadcastRaceState(await loadRace(raceId));
    }
  } catch { /* fire-and-forget */ }

  res.status(201).json(created);
});

// Entry status transitions

/** PATCH /races/:raceId/entries/:entryId/validate — PENDING → VALIDATED */
router.patch("/:raceId/entries/:entryId/validate", ...requireModo, async (req, res) => {
  const entry = await db
    .select()
    .from(raceEntry)
    .where(eq(raceEntry.id, String(req.params.entryId)))
    .get();

  if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
  if (entry.status !== "PENDING") {
    res.status(409).json({ error: "Entry must be PENDING to validate" });
    return;
  }

  const p = await db.select().from(pilot).where(eq(pilot.id, entry.pilotId)).get();
  if (!p) { res.status(404).json({ error: "Pilot not found" }); return; }

  const teamSnap     = p.teamId     ? await db.select().from(team).where(eq(team.id, p.teamId)).get()         : null;
  const vehicleSnap  = p.vehicleId  ? await db.select().from(vehicle).where(eq(vehicle.id, p.vehicleId)).get() : null;
  const controlsSnap = p.controlsId ? await db.select().from(controls).where(eq(controls.id, p.controlsId)).get() : null;

  // Assign grid position at end of current validated list
  const validatedEntries = await db
    .select({ gridPosition: raceEntry.gridPosition })
    .from(raceEntry)
    .where(and(eq(raceEntry.raceId, entry.raceId), eq(raceEntry.status, "VALIDATED")))
    .all();
  const maxPos = validatedEntries.reduce((m, e) => Math.max(m, e.gridPosition ?? 0), 0);

  const [updated] = await db
    .update(raceEntry)
    .set({
      status:           "VALIDATED",
      gridPosition:     maxPos + 1,
      teamSnapshot:     teamSnap     ? { ...teamSnap }     : null,
      vehicleSnapshot:  vehicleSnap  ? { ...vehicleSnap }  : null,
      controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
    })
    .where(eq(raceEntry.id, entry.id))
    .returning();

  // Refresh overlay if race is loaded in pre-race status
  try {
    const ctx = getContext();
    if (ctx?.raceId === entry.raceId && (ctx.raceStatus === "PENDING" || ctx.raceStatus === "SCHEDULED")) {
      broadcastRaceState(await loadRace(entry.raceId));
    }
  } catch { /* fire-and-forget */ }

  res.json(updated);
});

/** PATCH /races/:raceId/entries/:entryId/reject — PENDING → REJECTED */
router.patch("/:raceId/entries/:entryId/reject", ...requireModo, async (req, res) => {
  const entry = await db.select().from(raceEntry).where(eq(raceEntry.id, String(req.params.entryId))).get();
  if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
  if (entry.status !== "PENDING") {
    res.status(409).json({ error: "Entry must be PENDING to reject" }); return;
  }

  const [updated] = await db.update(raceEntry).set({ status: "REJECTED" }).where(eq(raceEntry.id, entry.id)).returning();
  res.json(updated);
});

/** PATCH /races/:raceId/entries/:entryId/revoke — VALIDATED → REVOKED */
router.patch("/:raceId/entries/:entryId/revoke", ...requireModo, async (req, res) => {
  const entry = await db.select().from(raceEntry).where(eq(raceEntry.id, String(req.params.entryId))).get();
  if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
  if (entry.status !== "VALIDATED") {
    res.status(409).json({ error: "Entry must be VALIDATED to revoke" }); return;
  }

  const [updated] = await db.update(raceEntry).set({ status: "REVOKED", gridPosition: null }).where(eq(raceEntry.id, entry.id)).returning();

  try {
    const ctx = getContext();
    if (ctx?.raceId === entry.raceId && (ctx.raceStatus === "PENDING" || ctx.raceStatus === "SCHEDULED")) {
      broadcastRaceState(await loadRace(entry.raceId));
    }
  } catch { /* fire-and-forget */ }

  res.json(updated);
});

/** PATCH /races/:raceId/entries/:entryId/readmit — REJECTED|REVOKED → VALIDATED */
router.patch("/:raceId/entries/:entryId/readmit", ...requireModo, async (req, res) => {
  const entry = await db.select().from(raceEntry).where(eq(raceEntry.id, String(req.params.entryId))).get();
  if (!entry) { res.status(404).json({ error: "Entry not found" }); return; }
  if (entry.status !== "REJECTED" && entry.status !== "REVOKED") {
    res.status(409).json({ error: "Entry must be REJECTED or REVOKED to readmit" }); return;
  }

  // Assign position at end of validated list
  const validatedEntries = await db
    .select({ gridPosition: raceEntry.gridPosition })
    .from(raceEntry)
    .where(and(eq(raceEntry.raceId, entry.raceId), eq(raceEntry.status, "VALIDATED")))
    .all();
  const maxPos = validatedEntries.reduce((m, e) => Math.max(m, e.gridPosition ?? 0), 0);

  const [updated] = await db
    .update(raceEntry)
    .set({ status: "VALIDATED", gridPosition: maxPos + 1 })
    .where(eq(raceEntry.id, entry.id))
    .returning();

  try {
    const ctx = getContext();
    if (ctx?.raceId === entry.raceId && (ctx.raceStatus === "PENDING" || ctx.raceStatus === "SCHEDULED")) {
      broadcastRaceState(await loadRace(entry.raceId));
    }
  } catch { /* fire-and-forget */ }

  res.json(updated);
});

/** DELETE /races/:raceId/entries/:entryId — pilot cancels their own registration (PENDING) */
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
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (!isAdminOrModo && entry.status !== "PENDING") {
    res.status(409).json({ error: "Cannot cancel a validated entry" }); return;
  }

  await db.delete(raceEntry).where(eq(raceEntry.id, entry.id));
  res.sendStatus(204);
});

// Race registrations open/close

/** POST /races/:id/open-registrations — PENDING → SCHEDULED */
router.post("/:id/open-registrations", ...requireModo, async (req, res) => {
  const found = await db.select().from(race).where(eq(race.id, String(req.params.id))).get();
  if (!found) { res.status(404).json({ error: "Race not found" }); return; }
  if (found.status !== "PENDING") {
    res.status(409).json({ error: "Race must be PENDING to open registrations" }); return;
  }
  const [updated] = await db.update(race).set({ status: "SCHEDULED" }).where(eq(race.id, String(req.params.id))).returning();
  res.json(updated);
});

/** POST /races/:id/close-registrations — SCHEDULED → PENDING */
router.post("/:id/close-registrations", ...requireModo, async (req, res) => {
  const found = await db.select().from(race).where(eq(race.id, String(req.params.id))).get();
  if (!found) { res.status(404).json({ error: "Race not found" }); return; }
  if (found.status !== "SCHEDULED") {
    res.status(409).json({ error: "Race must be SCHEDULED to close registrations" }); return;
  }
  const [updated] = await db.update(race).set({ status: "PENDING" }).where(eq(race.id, String(req.params.id))).returning();
  res.json(updated);
});

// Race lifecycle

/**
 * POST /races/:id/load — modo+
 * Loads the server RaceContext from VALIDATED entries.
 * Does not start the race. Required before grid-order and start.
 */
router.post("/:id/load", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found) { res.status(404).json({ error: "Race not found" }); return; }
  if (found.status === "FINISHED") {
    res.status(409).json({ error: "Cannot load a finished race" }); return;
  }

  try {
    const ctx = await loadRace(raceId);
    broadcastRaceState(ctx);
    res.json({ ok: true, pilots: Object.keys(ctx.pilotStates).length });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * POST /races/:id/start — modo+
 * Starts the race (records startedAt). Loads context if needed.
 */
router.post("/:id/start", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found) { res.status(404).json({ error: "Race not found" }); return; }

  if (found.status === "SCHEDULED" || found.status === "PENDING") {
    // Fresh start — load context if not already loaded
    let ctx = getContext();
    if (!ctx || ctx.raceId !== raceId) {
      ctx = await loadRace(raceId);
    }
    ctx.startedAt = new Date().toISOString();
    ctx.raceStatus = "STARTED";
    await db.update(race).set({ status: "STARTED" }).where(eq(race.id, raceId));
    await persistState();
    emitAll("race-restarted");
    broadcastRaceState(ctx);
    res.json({ ok: true, status: "STARTED" });

  } else if (found.status === "PAUSED") {
    const ctx = getContext();
    if (!ctx || ctx.raceId !== raceId) {
      res.status(409).json({ error: "Race context not loaded — call /load first" });
      return;
    }
    const pausedAt = ctx.pausedAt ? new Date(ctx.pausedAt).getTime() : Date.now();
    ctx.totalPausedMs += Date.now() - pausedAt;
    ctx.pausedAt = null;
    ctx.raceStatus = "STARTED";
    await db.update(race).set({ status: "STARTED" }).where(eq(race.id, raceId));
    await persistState();
    emitAll("race-resumed");
    broadcastRaceState(ctx);
    res.json({ ok: true, status: "STARTED" });

  } else {
    res.status(409).json({ error: `Cannot start a race with status ${found.status}` });
  }
});

/** POST /races/:id/pause — modo+ */
router.post("/:id/pause", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found || found.status !== "STARTED") {
    res.status(409).json({ error: "Race is not STARTED" }); return;
  }

  const ctx = getContext();
  if (!ctx || ctx.raceId !== raceId) {
    res.status(409).json({ error: "Race context not loaded" }); return;
  }

  ctx.pausedAt = new Date().toISOString();
  ctx.raceStatus = "PAUSED";
  await db.update(race).set({ status: "PAUSED" }).where(eq(race.id, raceId));
  await persistState();
  broadcastRaceState(ctx);
  res.json({ ok: true, status: "PAUSED" });
});

/** POST /races/:id/resume — modo+ (alias of start on PAUSED) */
router.post("/:id/resume", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found || found.status !== "PAUSED") {
    res.status(409).json({ error: "Race is not PAUSED" }); return;
  }

  const ctx = getContext();
  if (!ctx || ctx.raceId !== raceId) {
    res.status(409).json({ error: "Race context not loaded" }); return;
  }

  const pausedAt = ctx.pausedAt ? new Date(ctx.pausedAt).getTime() : Date.now();
  ctx.totalPausedMs += Date.now() - pausedAt;
  ctx.pausedAt = null;
  ctx.raceStatus = "STARTED";
  await db.update(race).set({ status: "STARTED" }).where(eq(race.id, raceId));
  await persistState();
  emitAll("race-resumed");
  broadcastRaceState(ctx);
  res.json({ ok: true, status: "STARTED" });
});

/** POST /races/:id/finish — modo+ */
router.post("/:id/finish", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found || !["STARTED", "PAUSED"].includes(found.status)) {
    res.status(409).json({ error: "Race is not active" }); return;
  }

  const ctx = getContext();
  if (ctx && ctx.raceId === raceId) {
    const nowIso = new Date().toISOString();
    for (const [pilotId, state] of Object.entries(ctx.pilotStates)) {
      if (state.status === "RUNNING" || state.status === "WARNING_DNF") {
        setPilotState(pilotId, { status: "FINISHED", frozenTime: nowIso });
      }
    }
    ctx.raceStatus = "FINISHED";
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
 * POST /races/:id/reset — modo+
 * Resets the race to zero (pilotStates, chrono). Race goes back to PENDING.
 */
router.post("/:id/reset", ...requireModo, async (req, res) => {
  const raceId = String(req.params.id);
  const found = await db.select().from(race).where(eq(race.id, raceId)).get();
  if (!found) { res.status(404).json({ error: "Race not found" }); return; }

  // Reset race status to PENDING
  await db.update(race).set({ status: "PENDING" }).where(eq(race.id, raceId));

  // Reset raceState in DB
  await db
    .update(raceState)
    .set({ pilotStates: {}, startedAt: null, pausedAt: null, totalPausedMs: 0 })
    .where(eq(raceState.raceId, raceId));

  // Reload fresh context
  try {
    const ctx = await loadRace(raceId);
    ctx.raceStatus = "PENDING";
    broadcastRaceState(ctx);
    res.json({ ok: true, status: "PENDING" });
  } catch {
    // If load fails (e.g. no validated entries), still return ok
    res.json({ ok: true, status: "PENDING" });
  }
});

export default router;
