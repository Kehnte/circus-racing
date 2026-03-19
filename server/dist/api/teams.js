"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// teams.ts — CRUD routes for teams (name, acronym, color).
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_js_1 = require("../db/db.js");
const schema_js_1 = require("../db/schema.js");
const roles_js_1 = require("../middleware/roles.js");
const router = (0, express_1.Router)();
/** GET /teams — public */
router.get("/", async (_req, res) => {
    const teams = await db_js_1.db.select().from(schema_js_1.team).all();
    res.json(teams);
});
/** POST /teams — admin/modo */
router.post("/", ...roles_js_1.requireModo, async (req, res) => {
    const { name, acronym, color } = req.body;
    if (!name || !acronym || !color) {
        res.status(400).json({ error: "name, acronym and color are required" });
        return;
    }
    const [created] = await db_js_1.db.insert(schema_js_1.team).values({ name, acronym, color }).returning();
    res.status(201).json(created);
});
/** PATCH /teams/:id — admin/modo */
router.patch("/:id", ...roles_js_1.requireModo, async (req, res) => {
    const { name, acronym, color } = req.body;
    const [updated] = await db_js_1.db.update(schema_js_1.team)
        .set({ ...(name && { name }), ...(acronym && { acronym }), ...(color && { color }) })
        .where((0, drizzle_orm_1.eq)(schema_js_1.team.id, String(req.params.id)))
        .returning();
    if (!updated) {
        res.status(404).json({ error: "Team not found" });
        return;
    }
    res.json(updated);
});
/** DELETE /teams/:id — admin/modo */
router.delete("/:id", ...roles_js_1.requireModo, async (req, res) => {
    await db_js_1.db.delete(schema_js_1.team).where((0, drizzle_orm_1.eq)(schema_js_1.team.id, String(req.params.id)));
    res.sendStatus(204);
});
exports.default = router;
//# sourceMappingURL=teams.js.map