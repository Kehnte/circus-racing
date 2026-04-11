// teams.ts — CRUD routes for teams (name, acronym, color).
import { Router } from "express";
import { eq, ne } from "drizzle-orm";
import { db } from "../db/db.js";
import { team } from "../db/schema.js";
import { requireModo } from "../middleware/roles.js";
import { emitDashboard } from "../socket/emitter.js";
import { refreshTeamSnapshots, clearTeamSnapshots } from "../engine/snapshot-refresh.js";
import { validate } from "../middleware/validate.js";
import { createTeamSchema, updateTeamSchema } from "../validation/schemas.js";

const router = Router();

/** GET /teams — public */
router.get("/", async (_req, res) => {
  const teams = await db.select().from(team).all();
  res.json(teams);
});

/** POST /teams/bulk — admin/modo, creates multiple teams from a JSON array */
router.post("/bulk", ...requireModo, async (req, res) => {
  const items: Array<{ name: string; acronym: string; color: string }> = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "Body must be an array" });
    return;
  }
  let created = 0;
  const skipped: string[] = [];
  for (const item of items) {
    if (!item.name || !item.acronym || !item.color) { skipped.push(item.name ?? "(missing name)"); continue; }
    const exists = await db.select({ id: team.id }).from(team).where(eq(team.name, item.name)).get();
    if (exists) { skipped.push(item.name); continue; }
    await db.insert(team).values({ name: item.name, acronym: item.acronym, color: item.color });
    created++;
  }
  emitDashboard("data-changed", { resource: "teams" });
  res.status(201).json({ created, skipped });
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

/** DELETE /teams — admin/modo, deletes all teams */
router.delete("/", ...requireModo, async (_req, res) => {
  const allTeams = await db.select({ id: team.id }).from(team).all();
  for (let i = 0; i < allTeams.length; i++) {
    await clearTeamSnapshots(allTeams[i].id, i === allTeams.length - 1);
  }
  await db.delete(team);
  emitDashboard("data-changed", { resource: "teams" });
  res.sendStatus(204);
});

/** DELETE /teams/:id — admin/modo */
router.delete("/:id", ...requireModo, async (req, res) => {
  const id = String(req.params.id);
  const remaining = await db.select({ id: team.id }).from(team).where(ne(team.id, id)).all();
  await clearTeamSnapshots(id, remaining.length === 0);
  await db.delete(team).where(eq(team.id, id));
  emitDashboard("data-changed", { resource: "teams" });
  res.sendStatus(204);
});

export default router;
