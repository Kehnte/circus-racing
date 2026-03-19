"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// vehicles.ts — CRUD routes for vehicles (model, type, image).
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
const roles_js_1 = require("../middleware/roles.js");
const router = (0, express_1.Router)();
/** GET /vehicles — public */
router.get("/", async (_req, res) => {
    const vehicles = await db_js_1.db.select().from(schema_js_1.vehicle).all();
    res.json(vehicles);
});
/** POST /vehicles — admin/modo */
router.post("/", ...roles_js_1.requireModo, async (req, res) => {
    const { type, model, img } = req.body;
    if (!type || !model) {
        res.status(400).json({ error: "type and model are required" });
        return;
    }
    const [created] = await db_js_1.db.insert(schema_js_1.vehicle).values({ type, model, img: img ?? null }).returning();
    res.status(201).json(created);
});
/** PATCH /vehicles/:id — admin/modo */
router.patch("/:id", ...roles_js_1.requireModo, async (req, res) => {
    const { type, model, img } = req.body;
    const [updated] = await db_js_1.db.update(schema_js_1.vehicle)
        .set({ ...(type && { type }), ...(model && { model }), ...(img !== undefined && { img }) })
        .where((0, drizzle_orm_1.eq)(schema_js_1.vehicle.id, String(req.params.id)))
        .returning();
    if (!updated) {
        res.status(404).json({ error: "Vehicle not found" });
        return;
    }
    res.json(updated);
});
/** DELETE /vehicles/:id — admin/modo */
router.delete("/:id", ...roles_js_1.requireModo, async (req, res) => {
    await db_js_1.db.delete(schema_js_1.vehicle).where((0, drizzle_orm_1.eq)(schema_js_1.vehicle.id, String(req.params.id)));
    res.sendStatus(204);
});
exports.default = router;
//# sourceMappingURL=vehicles.js.map