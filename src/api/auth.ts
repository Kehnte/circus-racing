import { Router } from "express";
import bcrypt from "@node-rs/bcrypt";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { pilot } from "../db/schema.js";
import { signToken } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const SALT_ROUNDS = 12;

/**
 * POST /auth/register
 * Body: { displayName, email, password, handleSC?, country?, avatarUrl?, teamId?, vehicleId?, controlsId? }
 */
router.post("/register", async (req, res) => {
  const { displayName, email, password, handleSC, country, avatarUrl, teamId, vehicleId, controlsId } = req.body;

  if (!displayName || !email || !password) {
    res.status(400).json({ error: "displayName, email and password are required" });
    return;
  }

  // Check uniqueness
  const existing = await db.select({ id: pilot.id })
    .from(pilot)
    .where(eq(pilot.email, email))
    .get();
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

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
    email,
    passwordHash,
    role,
    token,
    handleSC: handleSC ?? null,
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
 * Body: { email, password }
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const found = await db.select().from(pilot).where(eq(pilot.email, email)).get();
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateOcrToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function safePublic(p: typeof pilot.$inferSelect) {
  const { passwordHash, ...safe } = p;
  return safe;
}

export default router;
