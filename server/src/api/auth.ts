// auth.ts — Authentication routes: register, login, OCR token regeneration.
import { Router } from "express";
import bcrypt from "@node-rs/bcrypt";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { pilot } from "../db/schema.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema, changePasswordSchema } from "../validation/schemas.js";

const router = Router();
const SALT_ROUNDS = 12;

/**
 * POST /auth/register
 * Body: { displayName, password, country?, avatarUrl?, teamId?, vehicleId?, controlsId? }
 */
router.post("/register", validate(registerSchema), async (req, res) => {
  const { displayName, password, country, avatarUrl, teamId, vehicleId, controlsId } = req.body;

  const existingName = await db.select({ id: pilot.id })
    .from(pilot)
    .where(eq(pilot.displayName, displayName))
    .get();
  if (existingName) {
    res.status(409).json({ error: "Display name already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const token = generateOcrToken();

  // First pilot ever becomes ADMIN automatically
  const count = await db.select({ id: pilot.id }).from(pilot).all();
  const role = count.length === 0 ? "ADMIN" : "PILOT";

  const [created] = await db.insert(pilot).values({
    displayName,
    passwordHash,
    role,
    token,
    country: country ?? "un",
    avatarUrl: avatarUrl ?? null,
    teamId: teamId ?? null,
    vehicleId: vehicleId ?? null,
    controlsId: controlsId ?? null,
  }).returning();

  const jwt = signToken({ id: created.id, role: created.role });

  res.status(201).json({
    token: jwt,
    ocrToken: created.token,
    pilot: safePublic(created),
  });
});

/**
 * POST /auth/login
 * Body: { displayName, password }
 */
router.post("/login", validate(loginSchema), async (req, res) => {
  const { displayName, password } = req.body;

  const found = await db.select().from(pilot).where(eq(pilot.displayName, displayName)).get();
  if (!found) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const match = await bcrypt.compare(password, found.passwordHash);
  if (!match) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const jwt = signToken({ id: found.id, role: found.role });

  res.json({
    token: jwt,
    ocrToken: found.token,
    pilot: safePublic(found),
  });
});

/**
 * POST /auth/regenerate-token
 * Regenerates the OCR token for the authenticated pilot.
 */
router.post("/regenerate-token", ...([requireAuth] as any), async (req, res) => {
  const newToken = generateOcrToken();
  await db.update(pilot).set({ token: newToken }).where(eq(pilot.id, req.user!.id));
  res.json({ ocrToken: newToken });
});

/**
 * POST /auth/change-password
 * Body: { currentPassword, newPassword }
 */
router.post("/change-password", validate(changePasswordSchema), ...([requireAuth] as any), async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const found = await db.select().from(pilot).where(eq(pilot.id, req.user!.id)).get();
  if (!found) {
    res.status(404).json({ error: "Pilot not found" });
    return;
  }

  const match = await bcrypt.compare(currentPassword, found.passwordHash);
  if (!match) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.update(pilot).set({ passwordHash: newHash }).where(eq(pilot.id, req.user!.id));

  res.json({ ok: true });
});

// Helpers

function generateOcrToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function safePublic(p: typeof pilot.$inferSelect) {
  const { passwordHash, ...safe } = p;
  return safe;
}

export default router;
