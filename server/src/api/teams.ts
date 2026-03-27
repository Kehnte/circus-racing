// teams.ts — CRUD routes for teams (name, acronym, color).
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { team } from "../db/schema.js";
import { requireModo } from "../middleware/roles.js";
import { emitDashboard } from "../socket/emitter.js";
import { refreshTeamSnapshots } from "../engine/snapshot-refresh.js";
import { validate } from "../middleware/validate.js";
import { createTeamSchema, updateTeamSchema } from "../validation/schemas.js";

const router = Router();

/** GET /teams — public */
router.get("/", async (_req, res) => {
  const teams = await db.select().from(team).all();
  res.json(teams);
});

/** GET /teams/:id — public */
router.get("/:id", async (req, res) => {
  const found = await db.select().from(team).where(eq(team.id, String(req.params.id))).get();
  if (!found) { res.status(404).json({ error: "Team not found" }); return; }
  res.json(found);
});

/** POST /teams — admin/modo */
router.post("/", ...requireModo, validate(createTeamSchema), async (req, res) => {
  const { name, acronym, color } = req.body;
  const [created] = await db.insert(team).values({ name, acronym, color }).returning();
  emitDashboard("data-changed", { resource: "teams" });
  res.status(201).json(created);
});

/** PATCH /teams/:id — admin/modo */
router.patch("/:id", ...requireModo, validate(updateTeamSchema), async (req, res) => {
  const { name, acronym, color } = req.body;
  const [updated] = await db.update(team)
    .set({ ...(name && { name }), ...(acronym && { acronym }), ...(color && { color }) })
    .where(eq(team.id, String(req.params.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Team not found" }); return; }
  await refreshTeamSnapshots(String(req.params.id));
  emitDashboard("data-changed", { resource: "teams" });
  res.json(updated);
});

/** DELETE /teams/:id — admin/modo */
router.delete("/:id", ...requireModo, async (req, res) => {
  await db.delete(team).where(eq(team.id, String(req.params.id)));
  emitDashboard("data-changed", { resource: "teams" });
  res.sendStatus(204);
});

export default router;
