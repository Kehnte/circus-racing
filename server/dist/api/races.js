"use strict";
// races.ts — Race CRUD, registration management, lifecycle (load/start/pause/resume/finish/reset).
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
// Races CRUD
/** GET /races — public */
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
/** POST /races — modo+ */
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
/** PATCH /races/:id — modo+. Blocks trackingMode if STARTED. */
router.patch("/:id", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!found) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    if (req.body.trackingMode !== undefined && found.status === "STARTED") {
        res.status(409).json({ error: "Cannot change trackingMode while race is STARTED" });
        return;
    }
    const allowed = [
        "name", "racetrackId", "lapCount", "session", "weather", "startType",
        "trackingMode", "sessionMode", "sessionDurationMs",
        "teamDisplayMode", "chronoDisplayMode", "timingEnabled", "eventDuration",
    ];
    const patch = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined)
            patch[key] = req.body[key];
    }
    const [updated] = await db_js_1.db.update(schema_js_1.race).set(patch).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).returning();
    // Sync display settings in live context if loaded
    const ctx = (0, race_context_js_1.getContext)();
    if (ctx && ctx.raceId === raceId) {
        if (patch.teamDisplayMode)
            ctx.teamDisplayMode = patch.teamDisplayMode;
        if (patch.chronoDisplayMode)
            ctx.chronoDisplayMode = patch.chronoDisplayMode;
        if (patch.timingEnabled !== undefined)
            ctx.timingEnabled = patch.timingEnabled;
        if (patch.eventDuration)
            ctx.eventDuration = patch.eventDuration;
        if (patch.name)
            ctx.raceName = patch.name;
        if (patch.session)
            ctx.session = patch.session;
        if (patch.weather)
            ctx.weather = patch.weather;
        if (patch.startType)
            ctx.startType = patch.startType;
        if (patch.lapCount)
            ctx.lapCount = patch.lapCount;
        (0, emitter_js_1.broadcastRaceState)(ctx);
    }
    res.json(updated);
});
/** DELETE /races/:id — modo+. Blocked if STARTED or PAUSED. */
router.delete("/:id", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!found) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    if (found.status === "STARTED" || found.status === "PAUSED") {
        res.status(409).json({ error: "Cannot delete a race that is STARTED or PAUSED" });
        return;
    }
    await db_js_1.db.delete(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId));
    res.sendStatus(204);
});
// Race entries
/** GET /races/:id/entries — modo+ */
router.get("/:id/entries", ...roles_js_1.requireModo, async (req, res) => {
    const entries = await db_js_1.db
        .select()
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, String(req.params.id)))
        .all();
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
/** GET /races/:id/entries/me — authenticated pilot */
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
/** POST /races/:id/entries — authenticated pilot (self-register) */
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
/** POST /races/:id/entries/admin — modo+ (direct add as VALIDATED) */
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
    // Assign grid position at end of current list
    const existingEntries = await db_js_1.db
        .select({ gridPosition: schema_js_1.raceEntry.gridPosition })
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, raceId), (0, drizzle_orm_1.eq)(schema_js_1.raceEntry.status, "VALIDATED")))
        .all();
    const maxPos = existingEntries.reduce((m, e) => Math.max(m, e.gridPosition ?? 0), 0);
    const [created] = await db_js_1.db.insert(schema_js_1.raceEntry).values({
        raceId,
        pilotId,
        status: "VALIDATED",
        gridPosition: maxPos + 1,
        teamSnapshot: teamSnap ? { ...teamSnap } : null,
        vehicleSnapshot: vehicleSnap ? { ...vehicleSnap } : null,
        controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
    }).returning();
    try {
        const ctx = (0, race_context_js_1.getContext)();
        if (ctx?.raceId === raceId && (ctx.raceStatus === "PENDING" || ctx.raceStatus === "SCHEDULED")) {
            (0, emitter_js_1.broadcastRaceState)(await (0, race_context_js_1.loadRace)(raceId));
        }
    }
    catch { /* fire-and-forget */ }
    res.status(201).json(created);
});
// Entry status transitions
/** PATCH /races/:raceId/entries/:entryId/validate — PENDING → VALIDATED */
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
        res.status(409).json({ error: "Entry must be PENDING to validate" });
        return;
    }
    const p = await db_js_1.db.select().from(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, entry.pilotId)).get();
    if (!p) {
        res.status(404).json({ error: "Pilot not found" });
        return;
    }
    const teamSnap = p.teamId ? await db_js_1.db.select().from(schema_js_1.team).where((0, drizzle_orm_1.eq)(schema_js_1.team.id, p.teamId)).get() : null;
    const vehicleSnap = p.vehicleId ? await db_js_1.db.select().from(schema_js_1.vehicle).where((0, drizzle_orm_1.eq)(schema_js_1.vehicle.id, p.vehicleId)).get() : null;
    const controlsSnap = p.controlsId ? await db_js_1.db.select().from(schema_js_1.controls).where((0, drizzle_orm_1.eq)(schema_js_1.controls.id, p.controlsId)).get() : null;
    // Assign grid position at end of current validated list
    const validatedEntries = await db_js_1.db
        .select({ gridPosition: schema_js_1.raceEntry.gridPosition })
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, entry.raceId), (0, drizzle_orm_1.eq)(schema_js_1.raceEntry.status, "VALIDATED")))
        .all();
    const maxPos = validatedEntries.reduce((m, e) => Math.max(m, e.gridPosition ?? 0), 0);
    const [updated] = await db_js_1.db
        .update(schema_js_1.raceEntry)
        .set({
        status: "VALIDATED",
        gridPosition: maxPos + 1,
        teamSnapshot: teamSnap ? { ...teamSnap } : null,
        vehicleSnapshot: vehicleSnap ? { ...vehicleSnap } : null,
        controlsSnapshot: controlsSnap ? { ...controlsSnap } : null,
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, entry.id))
        .returning();
    // Refresh overlay if race is loaded in pre-race status
    try {
        const ctx = (0, race_context_js_1.getContext)();
        if (ctx?.raceId === entry.raceId && (ctx.raceStatus === "PENDING" || ctx.raceStatus === "SCHEDULED")) {
            (0, emitter_js_1.broadcastRaceState)(await (0, race_context_js_1.loadRace)(entry.raceId));
        }
    }
    catch { /* fire-and-forget */ }
    res.json(updated);
});
/** PATCH /races/:raceId/entries/:entryId/reject — PENDING → REJECTED */
router.patch("/:raceId/entries/:entryId/reject", ...roles_js_1.requireModo, async (req, res) => {
    const entry = await db_js_1.db.select().from(schema_js_1.raceEntry).where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, String(req.params.entryId))).get();
    if (!entry) {
        res.status(404).json({ error: "Entry not found" });
        return;
    }
    if (entry.status !== "PENDING") {
        res.status(409).json({ error: "Entry must be PENDING to reject" });
        return;
    }
    const [updated] = await db_js_1.db.update(schema_js_1.raceEntry).set({ status: "REJECTED" }).where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, entry.id)).returning();
    res.json(updated);
});
/** PATCH /races/:raceId/entries/:entryId/revoke — VALIDATED → REVOKED */
router.patch("/:raceId/entries/:entryId/revoke", ...roles_js_1.requireModo, async (req, res) => {
    const entry = await db_js_1.db.select().from(schema_js_1.raceEntry).where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, String(req.params.entryId))).get();
    if (!entry) {
        res.status(404).json({ error: "Entry not found" });
        return;
    }
    if (entry.status !== "VALIDATED") {
        res.status(409).json({ error: "Entry must be VALIDATED to revoke" });
        return;
    }
    const [updated] = await db_js_1.db.update(schema_js_1.raceEntry).set({ status: "REVOKED", gridPosition: null }).where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, entry.id)).returning();
    try {
        const ctx = (0, race_context_js_1.getContext)();
        if (ctx?.raceId === entry.raceId && (ctx.raceStatus === "PENDING" || ctx.raceStatus === "SCHEDULED")) {
            (0, emitter_js_1.broadcastRaceState)(await (0, race_context_js_1.loadRace)(entry.raceId));
        }
    }
    catch { /* fire-and-forget */ }
    res.json(updated);
});
/** PATCH /races/:raceId/entries/:entryId/readmit — REJECTED|REVOKED → VALIDATED */
router.patch("/:raceId/entries/:entryId/readmit", ...roles_js_1.requireModo, async (req, res) => {
    const entry = await db_js_1.db.select().from(schema_js_1.raceEntry).where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, String(req.params.entryId))).get();
    if (!entry) {
        res.status(404).json({ error: "Entry not found" });
        return;
    }
    if (entry.status !== "REJECTED" && entry.status !== "REVOKED") {
        res.status(409).json({ error: "Entry must be REJECTED or REVOKED to readmit" });
        return;
    }
    // Assign position at end of validated list
    const validatedEntries = await db_js_1.db
        .select({ gridPosition: schema_js_1.raceEntry.gridPosition })
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.raceId, entry.raceId), (0, drizzle_orm_1.eq)(schema_js_1.raceEntry.status, "VALIDATED")))
        .all();
    const maxPos = validatedEntries.reduce((m, e) => Math.max(m, e.gridPosition ?? 0), 0);
    const [updated] = await db_js_1.db
        .update(schema_js_1.raceEntry)
        .set({ status: "VALIDATED", gridPosition: maxPos + 1 })
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.id, entry.id))
        .returning();
    try {
        const ctx = (0, race_context_js_1.getContext)();
        if (ctx?.raceId === entry.raceId && (ctx.raceStatus === "PENDING" || ctx.raceStatus === "SCHEDULED")) {
            (0, emitter_js_1.broadcastRaceState)(await (0, race_context_js_1.loadRace)(entry.raceId));
        }
    }
    catch { /* fire-and-forget */ }
    res.json(updated);
});
/** DELETE /races/:raceId/entries/:entryId — pilot cancels their own registration (PENDING) */
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
    try {
        const ctx = (0, race_context_js_1.getContext)();
        if (ctx?.raceId === entry.raceId && (ctx.raceStatus === "PENDING" || ctx.raceStatus === "SCHEDULED")) {
            (0, emitter_js_1.broadcastRaceState)(await (0, race_context_js_1.loadRace)(entry.raceId));
        }
    }
    catch { /* fire-and-forget */ }
    res.sendStatus(204);
});
// Race registrations open/close
/** POST /races/:id/open-registrations — PENDING → SCHEDULED */
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
/** POST /races/:id/close-registrations — SCHEDULED → PENDING */
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
// Race lifecycle
/**
 * POST /races/:id/load — modo+
 * Loads the server RaceContext from VALIDATED entries.
 * Does not start the race. Required before grid-order and start.
 */
router.post("/:id/load", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!found) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    if (found.status === "FINISHED") {
        res.status(409).json({ error: "Cannot load a finished race" });
        return;
    }
    try {
        const ctx = await (0, race_context_js_1.loadRace)(raceId);
        (0, emitter_js_1.broadcastRaceState)(ctx);
        res.json({ ok: true, pilots: Object.keys(ctx.pilotStates).length });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
/**
 * POST /races/:id/start — modo+
 * Starts the race (records startedAt). Loads context if needed.
 */
router.post("/:id/start", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!found) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    if (found.status === "SCHEDULED" || found.status === "PENDING") {
        // Fresh start — load context if not already loaded
        let ctx = (0, race_context_js_1.getContext)();
        if (!ctx || ctx.raceId !== raceId) {
            ctx = await (0, race_context_js_1.loadRace)(raceId);
        }
        ctx.startedAt = new Date().toISOString();
        ctx.raceStatus = "STARTED";
        await db_js_1.db.update(schema_js_1.race).set({ status: "STARTED" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId));
        await (0, race_context_js_1.persistState)();
        (0, emitter_js_1.emitAll)("race-restarted");
        (0, emitter_js_1.broadcastRaceState)(ctx);
        res.json({ ok: true, status: "STARTED" });
    }
    else if (found.status === "PAUSED") {
        const ctx = (0, race_context_js_1.getContext)();
        if (!ctx || ctx.raceId !== raceId) {
            res.status(409).json({ error: "Race context not loaded — call /load first" });
            return;
        }
        const pausedAt = ctx.pausedAt ? new Date(ctx.pausedAt).getTime() : Date.now();
        ctx.totalPausedMs += Date.now() - pausedAt;
        ctx.pausedAt = null;
        ctx.raceStatus = "STARTED";
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
/** POST /races/:id/pause — modo+ */
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
    ctx.raceStatus = "PAUSED";
    await db_js_1.db.update(schema_js_1.race).set({ status: "PAUSED" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId));
    await (0, race_context_js_1.persistState)();
    (0, emitter_js_1.broadcastRaceState)(ctx);
    res.json({ ok: true, status: "PAUSED" });
});
/** POST /races/:id/resume — modo+ (alias of start on PAUSED) */
router.post("/:id/resume", ...roles_js_1.requireModo, async (req, res) => {
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
    ctx.raceStatus = "STARTED";
    await db_js_1.db.update(schema_js_1.race).set({ status: "STARTED" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId));
    await (0, race_context_js_1.persistState)();
    (0, emitter_js_1.emitAll)("race-resumed");
    (0, emitter_js_1.broadcastRaceState)(ctx);
    res.json({ ok: true, status: "STARTED" });
});
/** POST /races/:id/finish — modo+ */
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
        ctx.raceStatus = "FINISHED";
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
 * POST /races/:id/reset — modo+
 * Resets the race to zero (pilotStates, chrono). Race goes back to PENDING.
 */
router.post("/:id/reset", ...roles_js_1.requireModo, async (req, res) => {
    const raceId = String(req.params.id);
    const found = await db_js_1.db.select().from(schema_js_1.race).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId)).get();
    if (!found) {
        res.status(404).json({ error: "Race not found" });
        return;
    }
    // Reset race status to PENDING
    await db_js_1.db.update(schema_js_1.race).set({ status: "PENDING" }).where((0, drizzle_orm_1.eq)(schema_js_1.race.id, raceId));
    // Reset raceState in DB
    await db_js_1.db
        .update(schema_js_1.raceState)
        .set({ pilotStates: {}, startedAt: null, pausedAt: null, totalPausedMs: 0 })
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceState.raceId, raceId));
    // Reload fresh context
    try {
        const ctx = await (0, race_context_js_1.loadRace)(raceId);
        ctx.raceStatus = "PENDING";
        (0, emitter_js_1.broadcastRaceState)(ctx);
        res.json({ ok: true, status: "PENDING" });
    }
    catch {
        // If load fails (e.g. no validated entries), still return ok
        res.json({ ok: true, status: "PENDING" });
    }
});
exports.default = router;
//# sourceMappingURL=races.js.map