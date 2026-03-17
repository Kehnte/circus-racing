"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
const roles_js_1 = require("../middleware/roles.js");
const router = (0, express_1.Router)();
/** GET /racetracks — public */
router.get("/", async (_req, res) => {
    const all = await db_js_1.db.select().from(schema_js_1.racetrack).all();
    res.json(all);
});
/** GET /racetracks/:id — public */
router.get("/:id", async (req, res) => {
    const found = await db_js_1.db.select().from(schema_js_1.racetrack).where((0, drizzle_orm_1.eq)(schema_js_1.racetrack.id, String(req.params.id))).get();
    if (!found) {
        res.status(404).json({ error: "Racetrack not found" });
        return;
    }
    res.json(found);
});
/** POST /racetracks — admin/modo */
router.post("/", ...roles_js_1.requireModo, async (req, res) => {
    const { name, checkpoints, bufferRadius } = req.body;
    if (!name) {
        res.status(400).json({ error: "name is required" });
        return;
    }
    const cps = Array.isArray(checkpoints) ? checkpoints : [];
    const normalized = cps.map((cp, i) => ({
        order: i,
        position: cp.position ?? cp,
    }));
    const [created] = await db_js_1.db.insert(schema_js_1.racetrack)
        .values({ name, checkpoints: normalized, bufferRadius: bufferRadius ?? null })
        .returning();
    res.status(201).json(created);
});
/** PATCH /racetracks/:id — admin/modo */
router.patch("/:id", ...roles_js_1.requireModo, async (req, res) => {
    const { name, checkpoints, bufferRadius } = req.body;
    const patch = {};
    if (name)
        patch.name = name;
    if (bufferRadius !== undefined)
        patch.bufferRadius = bufferRadius;
    if (Array.isArray(checkpoints)) {
        patch.checkpoints = checkpoints.map((cp, i) => ({
            order: i,
            position: cp.position ?? cp,
        }));
    }
    const [updated] = await db_js_1.db.update(schema_js_1.racetrack)
        .set(patch)
        .where((0, drizzle_orm_1.eq)(schema_js_1.racetrack.id, String(req.params.id)))
        .returning();
    if (!updated) {
        res.status(404).json({ error: "Racetrack not found" });
        return;
    }
    res.json(updated);
});
/** DELETE /racetracks/:id — admin/modo */
router.delete("/:id", ...roles_js_1.requireModo, async (req, res) => {
    await db_js_1.db.delete(schema_js_1.racetrack).where((0, drizzle_orm_1.eq)(schema_js_1.racetrack.id, String(req.params.id)));
    res.sendStatus(204);
});
exports.default = router;
//# sourceMappingURL=racetracks.js.map