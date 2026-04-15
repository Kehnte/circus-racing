// admin.ts — Admin-only reset endpoints.
import { Router } from "express";
import { ne } from "drizzle-orm";
import { db } from "../db/db.js";
import { race, raceEntry, raceState, pilot, team, vehicle, controls, racetrack } from "../db/schema.js";
import { requireAdmin } from "../middleware/roles.js";
import { clearContext } from "../engine/race-context.js";
import { emitDashboard } from "../socket/emitter.js";

const router = Router();

/** POST /admin/reset-races — deletes all race data, preserving roster */
router.post("/reset-races", ...requireAdmin, async (_req, res) => {
  await clearContext();
  await db.delete(raceState);
  await db.delete(raceEntry);
  await db.delete(race);
  emitDashboard("race-list-changed");
  res.json({ ok: true });
});

/** POST /admin/reset-roster — deletes all pilots (except self), teams, vehicles, controls */
router.post("/reset-roster", ...requireAdmin, async (req, res) => {
  await db.delete(pilot).where(ne(pilot.id, req.user!.id));
  await db.delete(controls);
  await db.delete(vehicle);
  await db.delete(team);
  emitDashboard("data-changed", { resource: "pilots" });
  res.json({ ok: true });
});

/** POST /admin/reset-all — deletes everything except the requesting admin account */
router.post("/reset-all", ...requireAdmin, async (req, res) => {
  await clearContext();
  await db.delete(raceState);
  await db.delete(raceEntry);
  await db.delete(race);
  await db.delete(racetrack);
  await db.delete(pilot).where(ne(pilot.id, req.user!.id));
  await db.delete(controls);
  await db.delete(vehicle);
  await db.delete(team);
  emitDashboard("race-list-changed");
  emitDashboard("data-changed", { resource: "pilots" });
  res.json({ ok: true });
});

export default router;
