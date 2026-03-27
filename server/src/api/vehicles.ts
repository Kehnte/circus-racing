// vehicles.ts — CRUD routes for vehicles (model, type, image).
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { vehicle } from "../db/schema.js";
import { requireModo } from "../middleware/roles.js";
import { emitDashboard } from "../socket/emitter.js";
import { refreshVehicleSnapshots } from "../engine/snapshot-refresh.js";
import { validate } from "../middleware/validate.js";
import { createVehicleSchema, updateVehicleSchema } from "../validation/schemas.js";

const router = Router();

/** GET /vehicles — public */
router.get("/", async (_req, res) => {
  const vehicles = await db.select().from(vehicle).all();
  res.json(vehicles);
});

/** GET /vehicles/:id — public */
router.get("/:id", async (req, res) => {
  const found = await db.select().from(vehicle).where(eq(vehicle.id, String(req.params.id))).get();
  if (!found) { res.status(404).json({ error: "Vehicle not found" }); return; }
  res.json(found);
});

/** POST /vehicles — admin/modo */
router.post("/", ...requireModo, validate(createVehicleSchema), async (req, res) => {
  const { type, manufacturer, model, img } = req.body;
  const [created] = await db.insert(vehicle).values({ type, manufacturer: manufacturer ?? null, model, img: img ?? null }).returning();
  emitDashboard("data-changed", { resource: "vehicles" });
  res.status(201).json(created);
});

/** PATCH /vehicles/:id — admin/modo */
router.patch("/:id", ...requireModo, validate(updateVehicleSchema), async (req, res) => {
  const { type, manufacturer, model, img } = req.body;
  const [updated] = await db.update(vehicle)
    .set({
      ...(type         && { type }),
      ...(manufacturer !== undefined && { manufacturer }),
      ...(model        && { model }),
      ...(img          !== undefined && { img }),
    })
    .where(eq(vehicle.id, String(req.params.id)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Vehicle not found" }); return; }
  await refreshVehicleSnapshots(String(req.params.id));
  emitDashboard("data-changed", { resource: "vehicles" });
  res.json(updated);
});

/** DELETE /vehicles/:id — admin/modo */
router.delete("/:id", ...requireModo, async (req, res) => {
  await db.delete(vehicle).where(eq(vehicle.id, String(req.params.id)));
  emitDashboard("data-changed", { resource: "vehicles" });
  res.sendStatus(204);
});

export default router;
