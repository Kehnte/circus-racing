"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// pilots.ts — Pilot CRUD routes, profile updates, and config file download.
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const bcrypt_1 = require("@node-rs/bcrypt");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
const auth_js_1 = require("../middleware/auth.js");
const roles_js_1 = require("../middleware/roles.js");
const emitter_js_1 = require("../socket/emitter.js");
const snapshot_refresh_js_1 = require("../engine/snapshot-refresh.js");
const router = (0, express_1.Router)();
// Fields a pilot can always edit on their own profile
const ALWAYS_EDITABLE = ["displayName", "country", "avatarUrl"];
// Fields locked after a validated race entry (admin/modo can still change them)
const LOCKABLE_FIELDS = ["teamId", "vehicleId", "controlsId"];
function safePublic(p) {
    const { passwordHash, ...safe } = p;
    return safe;
}
// POST /pilots — admin only
// Creates a pilot manually for dashboard manual mode.
// Generates a placeholder email/password; the pilot can be merged with a real
// self-registered account later via the admin "rebind" flow.
router.post("/", ...roles_js_1.requireAdmin, async (req, res) => {
    const { displayName, country, avatarUrl, teamId, vehicleId, controlsId } = req.body;
    if (!displayName?.trim()) {
        res.status(400).json({ error: "displayName is required" });
        return;
    }
    const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const suffix = (0, crypto_1.randomBytes)(4).toString("hex");
    const email = `manual-${slug}-${suffix}@circus.local`;
    const password = (0, crypto_1.randomBytes)(16).toString("hex");
    const passwordHash = await (0, bcrypt_1.hash)(password, 12);
    const token = (0, crypto_1.randomBytes)(32).toString("hex");
    const [created] = await db_js_1.db.insert(schema_js_1.pilot).values({
        displayName: displayName.trim(),
        email,
        passwordHash,
        token,
        role: "PILOT",
        ...(country ? { country } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(teamId ? { teamId } : {}),
        ...(vehicleId ? { vehicleId } : {}),
        ...(controlsId ? { controlsId } : {}),
    }).returning();
    (0, emitter_js_1.emitDashboard)("data-changed", { resource: "pilots" });
    res.status(201).json(safePublic(created));
});
/** GET /pilots — admin/modo only (full list with emails) */
router.get("/", ...roles_js_1.requireModo, async (_req, res) => {
    const all = await db_js_1.db.select().from(schema_js_1.pilot).all();
    res.json(all.map(safePublic));
});
/** GET /pilots/me — authenticated pilot sees own profile */
router.get("/me", auth_js_1.requireAuth, async (req, res) => {
    const found = await db_js_1.db.select().from(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, req.user.id)).get();
    if (!found) {
        res.status(404).json({ error: "Pilot not found" });
        return;
    }
    res.json(safePublic(found));
});
/** GET /pilots/me/config — génère et télécharge un config.cfg pré-rempli pour le Monitor OCR */
router.get("/me/config", auth_js_1.requireAuth, async (req, res) => {
    const found = await db_js_1.db.select().from(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, req.user.id)).get();
    if (!found) {
        res.status(404).json({ error: "Pilot not found" });
        return;
    }
    const serverUrl = `${req.protocol}://${req.get("host")}`;
    const cfg = [
        "[auth]",
        `token=${found.token}`,
        "",
        "[server]",
        `url=${serverUrl}`,
        "",
        "[screen]",
        "resolution_width=2560",
        "resolution_height=1440",
        "",
        "[debug]",
        "delta_time_s=1",
        "checkpoint_save=False",
        "checkpoint_save_distance=150",
    ].join("\n");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", 'attachment; filename="config.cfg"');
    res.send(cfg);
});
/** GET /pilots/:id — admin/modo only */
router.get("/:id", ...roles_js_1.requireModo, async (req, res) => {
    const found = await db_js_1.db.select().from(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, String(req.params.id))).get();
    if (!found) {
        res.status(404).json({ error: "Pilot not found" });
        return;
    }
    res.json(safePublic(found));
});
/**
 * PATCH /pilots/me — pilot edits their own profile
 * Lockable fields (teamId, vehicleId, controlsId) are blocked
 * once the pilot has a VALIDATED race_entry.
 */
router.patch("/me", auth_js_1.requireAuth, async (req, res) => {
    const pilotId = req.user.id;
    // Check if pilot has a validated entry (locks certain fields)
    const validatedEntry = await db_js_1.db.select({ id: schema_js_1.raceEntry.id })
        .from(schema_js_1.raceEntry)
        .where((0, drizzle_orm_1.eq)(schema_js_1.raceEntry.pilotId, pilotId))
        .all()
        .then(entries => entries.find(e => e.status === "VALIDATED"));
    const patch = {};
    // Always-editable fields
    for (const field of ALWAYS_EDITABLE) {
        if (req.body[field] !== undefined)
            patch[field] = req.body[field];
    }
    // Lockable fields — blocked after validation
    for (const field of LOCKABLE_FIELDS) {
        if (req.body[field] !== undefined) {
            if (validatedEntry) {
                res.status(403).json({ error: `${field} is locked after race validation. Contact an admin to change it.` });
                return;
            }
            patch[field] = req.body[field];
        }
    }
    if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: "No valid fields to update" });
        return;
    }
    const [updated] = await db_js_1.db.update(schema_js_1.pilot).set(patch).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, pilotId)).returning();
    const configChanged = LOCKABLE_FIELDS.some(f => patch[f] !== undefined)
        || patch.displayName !== undefined || patch.country !== undefined;
    if (configChanged)
        await (0, snapshot_refresh_js_1.refreshPilotEntrySnapshots)(pilotId);
    (0, emitter_js_1.emitDashboard)("data-changed", { resource: "pilots" });
    res.json(safePublic(updated));
});
/**
 * PATCH /pilots/:id — admin/modo edits any pilot's profile (no field locks)
 */
router.patch("/:id", ...roles_js_1.requireModo, async (req, res) => {
    const allowed = [...ALWAYS_EDITABLE, ...LOCKABLE_FIELDS, "role", "email"];
    const patch = {};
    for (const field of allowed) {
        if (req.body[field] !== undefined)
            patch[field] = req.body[field];
    }
    if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: "No valid fields to update" });
        return;
    }
    const [updated] = await db_js_1.db.update(schema_js_1.pilot).set(patch).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, String(req.params.id))).returning();
    if (!updated) {
        res.status(404).json({ error: "Pilot not found" });
        return;
    }
    const configChanged = LOCKABLE_FIELDS.some(f => patch[f] !== undefined)
        || patch.displayName !== undefined || patch.country !== undefined;
    if (configChanged)
        await (0, snapshot_refresh_js_1.refreshPilotEntrySnapshots)(String(req.params.id));
    (0, emitter_js_1.emitDashboard)("data-changed", { resource: "pilots" });
    res.json(safePublic(updated));
});
/** DELETE /pilots/:id — admin only */
router.delete("/:id", ...roles_js_1.requireAdmin, async (req, res) => {
    await db_js_1.db.delete(schema_js_1.pilot).where((0, drizzle_orm_1.eq)(schema_js_1.pilot.id, String(req.params.id)));
    (0, emitter_js_1.emitDashboard)("data-changed", { resource: "pilots" });
    res.sendStatus(204);
});
exports.default = router;
//# sourceMappingURL=pilots.js.map