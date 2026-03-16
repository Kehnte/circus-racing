import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { pilot, raceEntry } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { requireModo, requireAdmin } from "../middleware/roles.js";

const router = Router();

// Fields a pilot can always edit on their own profile
const ALWAYS_EDITABLE = ["displayName", "country", "avatarUrl"] as const;

// Fields locked after a validated race entry (admin/modo can still change them)
const LOCKABLE_FIELDS = ["handleSC", "teamId", "vehicleId", "controlsId"] as const;

function safePublic(p: typeof pilot.$inferSelect) {
  const { passwordHash, ...safe } = p;
  return safe;
}

/** GET /pilots — admin/modo only (full list with emails) */
router.get("/", ...requireModo, async (_req, res) => {
  const all = await db.select().from(pilot).all();
  res.json(all.map(safePublic));
});

/** GET /pilots/me — authenticated pilot sees own profile */
router.get("/me", requireAuth, async (req, res) => {
  const found = await db.select().from(pilot).where(eq(pilot.id, req.user!.id)).get();
  if (!found) { res.status(404).json({ error: "Pilot not found" }); return; }
  res.json(safePublic(found));
});

/** GET /pilots/:id — admin/modo only */
router.get("/:id", ...requireModo, async (req, res) => {
  const found = await db.select().from(pilot).where(eq(pilot.id, String(req.params.id))).get();
  if (!found) { res.status(404).json({ error: "Pilot not found" }); return; }
  res.json(safePublic(found));
});

/**
 * PATCH /pilots/me — pilot edits their own profile
 * Lockable fields (handleSC, teamId, vehicleId, controlsId) are blocked
 * once the pilot has a VALIDATED race_entry.
 */
router.patch("/me", requireAuth, async (req, res) => {
  const pilotId = req.user!.id;

  // Check if pilot has a validated entry (locks certain fields)
  const validatedEntry = await db.select({ id: raceEntry.id })
    .from(raceEntry)
    .where(eq(raceEntry.pilotId, pilotId))
    .all()
    .then(entries => entries.find(e => (e as any).status === "VALIDATED"));

  const patch: Record<string, unknown> = {};

  // Always-editable fields
  for (const field of ALWAYS_EDITABLE) {
    if (req.body[field] !== undefined) patch[field] = req.body[field];
  }

  // Lockable fields — blocked after validation
  for (const field of LOCKABLE_FIELDS) {
    if (req.body[field] !== undefined) {
      if (validatedEntry) {
        res.status(403).json({ error: `${field} is locked after race validation. Contact an admin to change it.` });
        return;
      }
      patch[field] = req.body[field];
    }
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db.update(pilot).set(patch).where(eq(pilot.id, pilotId)).returning();
  res.json(safePublic(updated));
});

/**
 * PATCH /pilots/:id — admin/modo edits any pilot's profile (no field locks)
 */
router.patch("/:id", ...requireModo, async (req, res) => {
  const allowed = [...ALWAYS_EDITABLE, ...LOCKABLE_FIELDS, "role", "email"] as const;
  const patch: Record<string, unknown> = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) patch[field] = req.body[field];
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }
  const [updated] = await db.update(pilot).set(patch).where(eq(pilot.id, String(req.params.id))).returning();
  if (!updated) { res.status(404).json({ error: "Pilot not found" }); return; }
  res.json(safePublic(updated));
});

/** DELETE /pilots/:id — admin only */
router.delete("/:id", ...requireAdmin, async (req, res) => {
  await db.delete(pilot).where(eq(pilot.id, String(req.params.id)));
  res.sendStatus(204);
});

export default router;
