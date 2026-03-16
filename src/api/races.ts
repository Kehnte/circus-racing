import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/db.js";
import { race, raceEntry, pilot, team, vehicle, controls } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { requireModo } from "../middleware/roles.js";

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

  if (!name || !racetrackId) {
    res.status(400).json({ error: "name and racetrackId are required" });
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
      handleSC: pilot.handleSC,
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

export default router;
