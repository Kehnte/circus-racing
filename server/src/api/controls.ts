// controls.ts — CRUD routes for control schemes (keyboard, gamepad, etc.).
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { controls } from "../db/schema.js";
import { requireModo } from "../middleware/roles.js";
import { emitDashboard } from "../socket/emitter.js";
import { refreshControlsSnapshots } from "../engine/snapshot-refresh.js";

const router = Router();

/** GET /controls — public */
router.get("/", async (_req, res) => {
  const all = await db.select().from(controls).all();
  res.json(all);
});

/** POST /controls — admin/modo */
router.post("/", ...requireModo, async (req, res) => {
  const { type, img } = req.body;
  if (!type) {
    res.status(400).json({ error: "type is required" });
    return;
  }
  const [created] = await db.insert(controls).values({ type, img: img ?? null }).returning();
  emitDashboard("data-changed", { resource: "controls" });
  res.status(201).json(created);
});

/** PATCH /controls/:id — admin/modo */
router.patch("/:id", ...requireModo, async (req, res) => {
  const { type, img } = req.body;
  const [updated] = await db.update(controls)
    .set({ ...(type && { type }), ...(img !== undefined && { img }) })
    .where(eq(controls.id, String(req.params.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Controls not found" }); return; }
  await refreshControlsSnapshots(String(req.params.id));
  emitDashboard("data-changed", { resource: "controls" });
  res.json(updated);
});

/** DELETE /controls/:id — admin/modo */
router.delete("/:id", ...requireModo, async (req, res) => {
  await db.delete(controls).where(eq(controls.id, String(req.params.id)));
  emitDashboard("data-changed", { resource: "controls" });
  res.sendStatus(204);
});

export default router;
