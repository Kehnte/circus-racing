import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { team } from "../db/schema.js";
import { requireModo } from "../middleware/roles.js";

const router = Router();

/** GET /teams — public */
router.get("/", async (_req, res) => {
  const teams = await db.select().from(team).all();
  res.json(teams);
});

/** POST /teams — admin/modo */
router.post("/", ...requireModo, async (req, res) => {
  const { name, acronym, color } = req.body;
  if (!name || !acronym || !color) {
    res.status(400).json({ error: "name, acronym and color are required" });
    return;
  }
  const [created] = await db.insert(team).values({ name, acronym, color }).returning();
  res.status(201).json(created);
});

/** PATCH /teams/:id — admin/modo */
router.patch("/:id", ...requireModo, async (req, res) => {
  const { name, acronym, color } = req.body;
  const [updated] = await db.update(team)
    .set({ ...(name && { name }), ...(acronym && { acronym }), ...(color && { color }) })
    .where(eq(team.id, String(req.params.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Team not found" }); return; }
  res.json(updated);
});

/** DELETE /teams/:id — admin/modo */
router.delete("/:id", ...requireModo, async (req, res) => {
  await db.delete(team).where(eq(team.id, String(req.params.id)));
  res.sendStatus(204);
});

export default router;
