"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
const auth_js_1 = require("../middleware/auth.js");
const roles_js_1 = require("../middleware/roles.js");
const race_context_js_1 = require("../engine/race-context.js");
const emitter_js_1 = require("../socket/emitter.js");
const router = (0, express_1.Router)();
// ---------------------------------------------------------------------------
// Races
// ---------------------------------------------------------------------------
/**
 * GET /races — public
 * Returns all races. Optionally filter by status: ?status=PENDING,SCHEDULED
 */
router.get("/", async (req, res) => {
    const all = await db_js_1.db.select().from(schema_js_1.race).all();
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
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, String(req.params.id))).get();
    if (!found) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    res.json(found);
});
/** POST /races — admin/modo */
router.post("/", ...roles_js_1.requireModo, async (req, res) => {
    const { name, racetrackId, lapCount, session, weather, startType, trackingMode, sessionMode, sessionDurationMs, teamDisplayMode, chronoDisplayMode, timingEnabled, eventDuration, } = req.body;
    if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
    }
    if ((trackingMode ?? "manual") === "auto" && !racetrackId) {
        res.status(400).json({ error: "racetrackId is required for auto tracking mode" });
        return;
    }
    const [created] = await db_js_1.db.insert(schema_js_1.race).values({
        name,
        racetrackId,
        lapCount: lapCount ?? 3,
        session: session ?? "Race",
        weather: weather ?? "Clear",
        startType: startType ?? "Grid Start",
        trackingMode: trackingMode ?? "manual",
        sessionMode: sessionMode ?? "laps",
        sessionDurationMs: sessionDurationMs ?? null,
        teamDisplayMode: teamDisplayMode ?? "color-bar",
        chronoDisplayMode: chronoDisplayMode ?? "gap",
        timingEnabled: timingEnabled ?? true,
        eventDuration: eventDuration ?? 5,
    }).returning();
    res.status(201).json(created);
});
/** PATCH /races/:id — admin/modo */
router.patch("/:id", ...roles_js_1.requireModo, async (req, res) => {
    const allowed = [
        "name", "racetrackId", "lapCount", "session", "weather", "startType",
        "trackingMode", "sessionMode", "sessionDurationMs",
        "teamDisplayMode", "chronoDisplayMode", "timingEnabled", "eventDuration", "status",
    ];
    const patch = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined)
            patch[key] = req.body[key];
    }
    const [updated] = await db_js_1.db.update(schema_js_1.race).set(patch).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, String(req.params.id))).returning();
    if (!updated) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    res.json(updated);
});
/** DELETE /races/:id — admin/modo */
router.delete("/:id", ...roles_js_1.requireModo, async (req, res) => {
    await db_js_1.db.delete(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, String(req.params.id)));
    res.sendStatus(204);
});
// ---------------------------------------------------------------------------
// Race entries
// ---------------------------------------------------------------------------
/**
 * GET /races/:id/entries — admin/modo
 * Returns all entries for a race with pilot info joined.
 */
router.get("/:id/entries", ...roles_js_1.requireModo, async (req, res) => {
    const entries = await db_js_1.db
        .select()
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, String(req.params.id)))
        .all();
    // Join pilot display info
    const enriched = await Promise.all(entries.map(async (entry) => {
        const p = await db_js_1.db.select({
            id: schema_js_1.pilot.id,
            displayName: schema_js_1.pilot.displayName,
            country: schema_js_1.pilot.country,
            avatarUrl: schema_js_1.pilot.avatarUrl,
            teamId: schema_js_1.pilot.teamId,
            vehicleId: schema_js_1.pilot.vehicleId,
            controlsId: schema_js_1.pilot.controlsId,
        }).from(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, entry.pilotId)).get();
        return { ...entry, pilot: p ?? null };
    }));
    res.json(enriched);
});
/**
 * GET /races/:id/entries/me — authenticated pilot
 * Returns the current pilot's entry for this race if it exists.
 */
router.get("/:id/entries/me", auth_js_1.requireAuth, async (req, res) => {
    const entry = await db_js_1.db
        .select()
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, String(req.params.id)), (0, drizzle_orm_1.eq)(schema_js_1.raceEntry.pilotId, req.user.id)))
        .get();
    if (!entry) {
        res.status(404).json({ error: "No entry found" });
        return;
    }
    res.json(entry);
});
/**
 * POST /races/:id/entries — authenticated pilot
 * Register the current pilot to a race. Race must be PENDING or SCHEDULED.
 */
router.post("/:id/entries", auth_js_1.requireAuth, async (req, res) => {
    const raceId = String(req.params.id);
    const pilotId = req.user.id;
    const targetRace = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!targetRace) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    if (!["PENDING", "SCHEDULED"].includes(targetRace.status)) {
        res.status(409).json({ error: "Race is not open for registration" });
        return;
    }
    // Prevent duplicate entry
    const existing = await db_js_1.db
        .select()
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, raceId), (0, drizzle_orm_1.eq)(schema_js_1.raceEntry.pilotId, pilotId)))
        .get();
    if (existing) {
        res.status(409).json({ error: "Already registered for this race" });
        return;
    }
    const [created] = await db_js_1.db.insert(schema_js_1.raceEntry).values({ raceId, pilotId }).returning();
    res.status(201).json(created);
});
/**
 * POST /races/:id/entries/admin — admin/modo
 * Admin directly adds a pilot to a race as VALIDATED (bypasses self-registration).
 * Body: { pilotId: string }
 */
router.post("/:id/entries/admin", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const { pilotId } = req.body;
    if (!pilotId) {
        res.status(400).json({ error: "pilotId is required" });
        return;
    }
    const targetRace = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!targetRace) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    if (targetRace.status === "FINISHED") {
        res.status(409).json({ error: "Cannot add pilots to a finished race" });
        return;
    }
    const p = await db_js_1.db.select().from(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, pilotId)).get();
    if (!p) {
        res.status(404).json({ error: "Pilot not found" });
        return;
    }
    const existing = await db_js_1.db
        .select()
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, raceId), (0, drizzle_orm_1.eq)(schema_js_1.raceEntry.pilotId, pilotId)))
        .get();
    if (existing) {
        res.status(409).json({ error: "Pilot already registered for this race" });
        return;
    }
    const teamSnap = p.teamId ? await db_js_1.db.select().from(schema_js_1.team).where((0, drizzle_orm_1.eq)(schema_js_1.team.id, p.teamId)).get() : null;
    const vehicleSnap = p.vehicleId ? await db_js_1.db.select().from(schema_js_1.vehicle).where((0, drizzle_orm_1.eq)(schema_js_1.vehicle.id, p.vehicleId)).get() : null;
    const controlsSnap = p.controlsId ? await db_js_1.db.select().from(schema_js_1.controls).where((0, drizzle_orm_1.eq)(schema_js_1.controls.id, p.controlsId)).get() : null;
    const [created] = await db_js_1.db.insert(schema_js_1.raceEntry).values({
        raceId,
        pilotId,
        status: "VALIDATED",
        teamSnapshot: teamSnap ? { ...teamSnap } : null,
        vehicleSnapshot: vehicleSnap ? { ...vehicleSnap } : null,
        controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
    }).returning();
    res.status(201).json(created);
});
/**
 * PATCH /races/:raceId/entries/:entryId/validate — admin/modo
 * Validates a PENDING entry → VALIDATED. Saves snapshots.
 */
router.patch("/:raceId/entries/:entryId/validate", ...roles_js_1.requireModo, async (req, res) => {
    const entry = await db_js_1.db
        .select()
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, String(req.params.entryId)))
        .get();
    if (!entry) {
        res.status(404).json({ error: "Entry not found" });
        return;
    }
    if (entry.status !== "PENDING") {
        res.status(409).json({ error: "Entry is not in PENDING status" });
        return;
    }
    // Load pilot + linked entities for snapshots
    const p = await db_js_1.db.select().from(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, entry.pilotId)).get();
    if (!p) {
        res.status(404).json({ error: "Pilot not found" });
        return;
    }
    const teamSnap = p.teamId ? await db_js_1.db.select().from(schema_js_1.team).where((0, drizzle_orm_1.eq)(schema_js_1.team.id, p.teamId)).get() : null;
    const vehicleSnap = p.vehicleId ? await db_js_1.db.select().from(schema_js_1.vehicle).where((0, drizzle_orm_1.eq)(schema_js_1.vehicle.id, p.vehicleId)).get() : null;
    const controlsSnap = p.controlsId ? await db_js_1.db.select().from(schema_js_1.controls).where((0, drizzle_orm_1.eq)(schema_js_1.controls.id, p.controlsId)).get() : null;
    const [updated] = await db_js_1.db
        .update(schema_js_1.raceEntry)
        .set({
        status: "VALIDATED",
        teamSnapshot: teamSnap ? { ...teamSnap } : null,
        vehicleSnapshot: vehicleSnap ? { ...vehicleSnap } : null,
        controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, entry.id))
        .returning();
    res.json(updated);
});
/**
 * DELETE /races/:raceId/entries/:entryId — admin/modo or own pilot
 * Remove a PENDING entry (cancel registration).
 */
router.delete("/:raceId/entries/:entryId", auth_js_1.requireAuth, async (req, res) => {
    const entry = await db_js_1.db
        .select()
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, String(req.params.entryId)))
        .get();
    if (!entry) {
        res.status(404).json({ error: "Entry not found" });
        return;
    }
    const user = req.user;
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
    await db_js_1.db.delete(schema_js_1.raceEntry).where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, entry.id));
    res.sendStatus(204);
});
// ---------------------------------------------------------------------------
// Race lifecycle
// ---------------------------------------------------------------------------
/**
 * POST /races/:id/start — admin/modo
 * Starts a SCHEDULED race (fresh) or resumes a PAUSED race.
 */
router.post("/:id/start", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!found) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    if (found.status === "SCHEDULED" || found.status === "PENDING") {
        // Fresh start
        const ctx = await (0, race_context_js_1.loadRace)(raceId);
        ctx.startedAt = new Date().toISOString();
        await db_js_1.db.update(schema_js_1.race).set({ status: "STARTED" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId));
        await (0, race_context_js_1.persistState)();
        (0, emitter_js_1.emitAll)("race-restarted");
        (0, emitter_js_1.broadcastRaceState)(ctx);
        res.json({ ok: true, status: "STARTED" });
    }
    else if (found.status === "PAUSED") {
        // Resume
        const ctx = (0, race_context_js_1.getContext)();
        if (!ctx || ctx.raceId !== raceId) {
            res.status(409).json({ error: "Race context not loaded — restart the server or reload the race" });
            return;
        }
        const pausedAt = ctx.pausedAt ? new Date(ctx.pausedAt).getTime() : Date.now();
        ctx.totalPausedMs += Date.now() - pausedAt;
        ctx.pausedAt = null;
        await db_js_1.db.update(schema_js_1.race).set({ status: "STARTED" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId));
        await (0, race_context_js_1.persistState)();
        (0, emitter_js_1.emitAll)("race-resumed");
        (0, emitter_js_1.broadcastRaceState)(ctx);
        res.json({ ok: true, status: "STARTED" });
    }
    else {
        res.status(409).json({ error: `Cannot start a race with status ${found.status}` });
    }
});
/**
 * POST /races/:id/pause — admin/modo
 */
router.post("/:id/pause", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!found || found.status !== "STARTED") {
        res.status(409).json({ error: "Race is not STARTED" });
        return;
    }
    const ctx = (0, race_context_js_1.getContext)();
    if (!ctx || ctx.raceId !== raceId) {
        res.status(409).json({ error: "Race context not loaded" });
        return;
    }
    ctx.pausedAt = new Date().toISOString();
    await db_js_1.db.update(schema_js_1.race).set({ status: "PAUSED" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId));
    await (0, race_context_js_1.persistState)();
    (0, emitter_js_1.broadcastRaceState)(ctx);
    res.json({ ok: true, status: "PAUSED" });
});
/**
 * POST /races/:id/resume — admin/modo (alias for start on PAUSED)
 */
router.post("/:id/resume", ...roles_js_1.requireModo, async (req, res) => {
    req.params.id = req.params.id; // passthrough
    const raceId = String(req.params.id);
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!found || found.status !== "PAUSED") {
        res.status(409).json({ error: "Race is not PAUSED" });
        return;
    }
    const ctx = (0, race_context_js_1.getContext)();
    if (!ctx || ctx.raceId !== raceId) {
        res.status(409).json({ error: "Race context not loaded" });
        return;
    }
    const pausedAt = ctx.pausedAt ? new Date(ctx.pausedAt).getTime() : Date.now();
    ctx.totalPausedMs += Date.now() - pausedAt;
    ctx.pausedAt = null;
    await db_js_1.db.update(schema_js_1.race).set({ status: "STARTED" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId));
    await (0, race_context_js_1.persistState)();
    (0, emitter_js_1.emitAll)("race-resumed");
    (0, emitter_js_1.broadcastRaceState)(ctx);
    res.json({ ok: true, status: "STARTED" });
});
/**
 * POST /races/:id/finish — admin/modo
 * Force-finishes all still-running pilots and closes the race.
 */
router.post("/:id/finish", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!found || !["STARTED", "PAUSED"].includes(found.status)) {
        res.status(409).json({ error: "Race is not active" });
        return;
    }
    const ctx = (0, race_context_js_1.getContext)();
    if (ctx && ctx.raceId === raceId) {
        const nowIso = new Date().toISOString();
        for (const [pilotId, state] of Object.entries(ctx.pilotStates)) {
            if (state.status === "RUNNING" || state.status === "WARNING_DNF") {
                (0, race_context_js_1.setPilotState)(pilotId, { status: "FINISHED", frozenTime: nowIso });
            }
        }
        (0, emitter_js_1.broadcastRaceState)(ctx);
        (0, emitter_js_1.emitAll)("race-event", { type: "race-finished" });
        await db_js_1.db.update(schema_js_1.race).set({ status: "FINISHED" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId));
        await (0, race_context_js_1.clearContext)();
    }
    else {
        await db_js_1.db.update(schema_js_1.race).set({ status: "FINISHED" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId));
    }
    res.json({ ok: true, status: "FINISHED" });
});
/**
 * PATCH /races/:id/tracking-mode — admin/modo
 * Body: { trackingMode: "manual" | "auto" }
 */
router.patch("/:id/tracking-mode", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const { trackingMode } = req.body;
    if (trackingMode !== "manual" && trackingMode !== "auto") {
        res.status(400).json({ error: 'trackingMode must be "manual" or "auto"' });
        return;
    }
    const [updated] = await db_js_1.db
        .update(schema_js_1.race)
        .set({ trackingMode })
        .where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId))
        .returning();
    if (!updated) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    // Update in-memory context if loaded
    const ctx = (0, race_context_js_1.getContext)();
    if (ctx && ctx.raceId === raceId) {
        ctx.trackingMode = trackingMode;
    }
    (0, emitter_js_1.emitDashboard)("tracking-mode-changed", { raceId, trackingMode });
    res.json(updated);
});
/**
 * POST /races/:id/open-registrations — admin/modo
 * Transitions a PENDING race to SCHEDULED, opening registrations.
 */
router.post("/:id/open-registrations", ...roles_js_1.requireModo, async (req, res) => {
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, String(req.params.id))).get();
    if (!found) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    if (found.status !== "PENDING") {
        res.status(409).json({ error: "Race must be PENDING to open registrations" });
        return;
    }
    const [updated] = await db_js_1.db.update(schema_js_1.race).set({ status: "SCHEDULED" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, String(req.params.id))).returning();
    res.json(updated);
});
/**
 * POST /races/:id/close-registrations — admin/modo
 * Transitions a SCHEDULED race back to PENDING, closing registrations.
 */
router.post("/:id/close-registrations", ...roles_js_1.requireModo, async (req, res) => {
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, String(req.params.id))).get();
    if (!found) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    if (found.status !== "SCHEDULED") {
        res.status(409).json({ error: "Race must be SCHEDULED to close registrations" });
        return;
    }
    const [updated] = await db_js_1.db.update(schema_js_1.race).set({ status: "PENDING" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, String(req.params.id))).returning();
    res.json(updated);
});
exports.default = router;
//# sourceMappingURL=races.js.map