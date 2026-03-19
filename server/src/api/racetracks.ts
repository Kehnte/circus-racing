// racetracks.ts — CRUD routes for racetracks and their checkpoints.
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { racetrack } from "../db/schema.js";
import { requireModo } from "../middleware/roles.js";

const router = Router();

/** GET /racetracks — public */
router.get("/", async (_req, res) => {
  const all = await db.select().from(racetrack).all();
  res.json(all);
});

/** GET /racetracks/:id — public */
router.get("/:id", async (req, res) => {
  const found = await db.select().from(racetrack).where(eq(racetrack.id, String(req.params.id))).get();
  if (!found) { res.status(404).json({ error: "Racetrack not found" }); return; }
  res.json(found);
});

/** POST /racetracks — admin/modo */
router.post("/", ...requireModo, async (req, res) => {
  const { name, checkpoints, bufferRadius } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const cps = Array.isArray(checkpoints) ? checkpoints : [];
  const normalized = cps.map((cp: any, i: number) => ({
    order: i,
    position: cp.position ?? cp,
  }));
  const [created] = await db.insert(racetrack)
    .values({ name, checkpoints: normalized, bufferRadius: bufferRadius ?? null })
    .returning();
  res.status(201).json(created);
});

/** PATCH /racetracks/:id — admin/modo */
router.patch("/:id", ...requireModo, async (req, res) => {
  const { name, checkpoints, bufferRadius } = req.body;
  const patch: Record<string, unknown> = {};
  if (name) patch.name = name;
  if (bufferRadius !== undefined) patch.bufferRadius = bufferRadius;
  if (Array.isArray(checkpoints)) {
    patch.checkpoints = checkpoints.map((cp: any, i: number) => ({
      order: i,
      position: cp.position ?? cp,
    }));
  }
  const [updated] = await db.update(racetrack)
    .set(patch)
    .where(eq(racetrack.id, String(req.params.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Racetrack not found" }); return; }
  res.json(updated);
});

/** DELETE /racetracks/:id — admin/modo */
router.delete("/:id", ...requireModo, async (req, res) => {
  await db.delete(racetrack).where(eq(racetrack.id, String(req.params.id)));
  res.sendStatus(204);
});

export default router;
