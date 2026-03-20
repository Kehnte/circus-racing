"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// controls.ts — CRUD routes for control schemes (keyboard, gamepad, etc.).
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
const roles_js_1 = require("../middleware/roles.js");
const emitter_js_1 = require("../socket/emitter.js");
const snapshot_refresh_js_1 = require("../engine/snapshot-refresh.js");
const router = (0, express_1.Router)();
/** GET /controls — public */
router.get("/", async (_req, res) => {
    const all = await db_js_1.db.select().from(schema_js_1.controls).all();
    res.json(all);
});
/** POST /controls — admin/modo */
router.post("/", ...roles_js_1.requireModo, async (req, res) => {
    const { type, img } = req.body;
    if (!type) {
        res.status(400).json({ error: "type is required" });
        return;
    }
    const [created] = await db_js_1.db.insert(schema_js_1.controls).values({ type, img: img ?? null }).returning();
    (0, emitter_js_1.emitDashboard)("data-changed", { resource: "controls" });
    res.status(201).json(created);
});
/** PATCH /controls/:id — admin/modo */
router.patch("/:id", ...roles_js_1.requireModo, async (req, res) => {
    const { type, img } = req.body;
    const [updated] = await db_js_1.db.update(schema_js_1.controls)
        .set({ ...(type && { type }), ...(img !== undefined && { img }) })
        .where((0, drizzle_orm_1.eq)(schema_js_1.controls.id, String(req.params.id)))
        .returning();
    if (!updated) {
        res.status(404).json({ error: "Controls not found" });
        return;
    }
    await (0, snapshot_refresh_js_1.refreshControlsSnapshots)(String(req.params.id));
    (0, emitter_js_1.emitDashboard)("data-changed", { resource: "controls" });
    res.json(updated);
});
/** DELETE /controls/:id — admin/modo */
router.delete("/:id", ...roles_js_1.requireModo, async (req, res) => {
    await db_js_1.db.delete(schema_js_1.controls).where((0, drizzle_orm_1.eq)(schema_js_1.controls.id, String(req.params.id)));
    (0, emitter_js_1.emitDashboard)("data-changed", { resource: "controls" });
    res.sendStatus(204);
});
exports.default = router;
//# sourceMappingURL=controls.js.map