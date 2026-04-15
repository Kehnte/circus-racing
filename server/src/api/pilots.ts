// pilots.ts — Pilot CRUD routes, profile updates, and config file download.
import { Router } from "express";
import { eq, ne, sql as drizzleSql } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";
import { hash } from "@node-rs/bcrypt";
import { db } from "../db/db.js";
import { pilot, raceEntry, deviceToken } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { requireModo, requireAdmin } from "../middleware/roles.js";
import { emitDashboard } from "../socket/emitter.js";
import { refreshPilotEntrySnapshots } from "../engine/snapshot-refresh.js";
import { validate } from "../middleware/validate.js";
import { createPilotSchema, updatePilotSchema } from "../validation/schemas.js";
import { WORDS } from "../utils/passphraseWords.js";
import { syncPilot, deactivatePilot, notifyPasswordChanged, issueSsoToken } from "../services/broadcastService.js";

function generatePassphrase(): string {
  const pick = () => WORDS[randomBytes(4).readUInt32BE() % WORDS.length];
  const num = randomBytes(1)[0] % 90 + 10; // 10-99
  return `${pick()}-${pick()}-${pick()}-${num}`;
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "avatars");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${randomBytes(16).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG and WebP images are allowed"));
  },
});

const router = Router();

// Fields a pilot can always edit on their own profile
const ALWAYS_EDITABLE = ["displayName", "country", "avatarUrl"] as const;

// Fields locked after a validated race entry (admin/modo can still change them)
const LOCKABLE_FIELDS = ["teamId", "vehicleId", "controlsId"] as const;

function safePublic(p: typeof pilot.$inferSelect) {
  const { passwordHash, ...safe } = p;
  return safe;
}

// POST /pilots — admin only, creates a pilot manually for dashboard manual mode.
router.post("/", ...requireAdmin, validate(createPilotSchema), async (req, res) => {
  const { displayName, country, avatarUrl, teamId, vehicleId, controlsId, role } = req.body;

  const password     = randomBytes(16).toString("hex");
  const passwordHash = await hash(password, 12);
  const token        = randomBytes(32).toString("hex");

  const [created] = await db.insert(pilot).values({
    displayName: displayName.trim(),
    passwordHash,
    token,
    role: role ?? "PILOT",
    ...(country    ? { country }    : {}),
    ...(avatarUrl  ? { avatarUrl }  : {}),
    ...(teamId     ? { teamId }     : {}),
    ...(vehicleId  ? { vehicleId }  : {}),
    ...(controlsId ? { controlsId } : {}),
  }).returning();

  void syncPilot(created);
  emitDashboard("data-changed", { resource: "pilots" });
  res.status(201).json(safePublic(created));
});

/** GET /pilots — admin/modo only */
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

/** GET /pilots/me/config — génère et télécharge un config.cfg pré-rempli pour le Monitor OCR */
router.get("/me/config", requireAuth, async (req, res) => {
  const found = await db.select().from(pilot).where(eq(pilot.id, req.user!.id)).get();
  if (!found) { res.status(404).json({ error: "Pilot not found" }); return; }

  const serverUrl = `${req.protocol}://${req.get("host")}`;
  const cfg = [
    "[auth]",
    `token=${found.token}`,
    "",
    "[server]",
    `url=${serverUrl}`,
    "",
    "[screen]",
    "resolution_width=2560",
    "resolution_height=1440",
    "",
    "[debug]",
    "delta_time_s=1",
    "checkpoint_save=False",
    "checkpoint_save_distance=150",
  ].join("\n");

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", 'attachment; filename="config.cfg"');
  res.send(cfg);
});

/** POST /pilots/me/avatar — upload a profile picture (JPEG/PNG/WebP, max 2 MB) */
router.post("/me/avatar", requireAuth, (req, res, next) => {
  avatarUpload.single("avatar")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File too large. Maximum size is 2 MB." });
      return;
    }
    if (err) { res.status(400).json({ error: (err as Error).message }); return; }
    next();
  });
}, async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }

  const pilotId = req.user!.id;
  const newUrl = `/uploads/avatars/${req.file.filename}`;

  // Delete previous uploaded avatar if it was a local file
  const current = await db.select({ avatarUrl: pilot.avatarUrl }).from(pilot).where(eq(pilot.id, pilotId)).get();
  if (current?.avatarUrl?.startsWith("/uploads/avatars/")) {
    const oldPath = path.resolve(process.cwd(), current.avatarUrl.slice(1));
    fs.unlink(oldPath, () => {});
  }

  const [updated] = await db.update(pilot).set({ avatarUrl: newUrl }).where(eq(pilot.id, pilotId)).returning();
  emitDashboard("data-changed", { resource: "pilots" });
  res.json(safePublic(updated));
});

/** DELETE /pilots/me/avatar — remove avatar and delete local file if any */
router.delete("/me/avatar", requireAuth, async (req, res) => {
  const pilotId = req.user!.id;
  const current = await db.select({ avatarUrl: pilot.avatarUrl }).from(pilot).where(eq(pilot.id, pilotId)).get();
  if (current?.avatarUrl?.startsWith("/uploads/avatars/")) {
    const oldPath = path.resolve(process.cwd(), current.avatarUrl.slice(1));
    fs.unlink(oldPath, () => {});
  }
  const [updated] = await db.update(pilot).set({ avatarUrl: null }).where(eq(pilot.id, pilotId)).returning();
  emitDashboard("data-changed", { resource: "pilots" });
  res.json(safePublic(updated));
});

/** POST /pilots/bulk — admin only, creates multiple pilots from a JSON array */
router.post("/bulk", ...requireAdmin, async (req, res) => {
  const items: Array<{ displayName: string; country?: string; role?: string }> = req.body;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "Body must be an array" });
    return;
  }
  let created = 0;
  const skipped: string[] = [];
  const createdPilots: typeof pilot.$inferSelect[] = [];
  for (const item of items) {
    if (!item.displayName) { skipped.push("(missing displayName)"); continue; }
    const exists = await db.select({ id: pilot.id }).from(pilot).where(eq(pilot.displayName, item.displayName)).get();
    if (exists) { skipped.push(item.displayName); continue; }
    const passwordHash = await hash(generatePassphrase(), 12);
    const token  = randomBytes(32).toString("hex");
    const [inserted] = await db.insert(pilot).values({
      displayName: item.displayName.trim(),
      passwordHash,
      token,
      role: (item.role as any) ?? "PILOT",
      country: item.country ?? "un",
    }).returning();
    createdPilots.push(inserted);
    created++;
  }
  for (const p of createdPilots) void syncPilot(p);
  emitDashboard("data-changed", { resource: "pilots" });
  res.status(201).json({ created, skipped });
});

/** GET /pilots/me/device-token — returns the pilot's own Stream Deck device token (ADMIN/MODERATOR only) */
router.get("/me/device-token", ...requireModo, async (req, res) => {
  const found = await db.select({
    id: deviceToken.id, tokenRaw: deviceToken.tokenRaw, createdAt: deviceToken.createdAt,
  }).from(deviceToken).where(eq(deviceToken.pilotId, req.user!.id)).get();
  res.json(found ?? null);
});

/** POST /pilots/me/device-token — creates or regenerates the pilot's Stream Deck device token */
router.post("/me/device-token", ...requireModo, async (req, res) => {
  const raw  = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  const name = `stream-deck:${req.user!.id}`;

  // Delete any existing token for this pilot, then insert fresh
  await db.delete(deviceToken).where(eq(deviceToken.pilotId, req.user!.id));
  const [created] = await db.insert(deviceToken).values({
    name, tokenHash: hash, tokenRaw: raw, pilotId: req.user!.id,
  }).returning({ id: deviceToken.id, tokenRaw: deviceToken.tokenRaw, createdAt: deviceToken.createdAt });
  res.status(201).json(created);
});

/** GET /pilots/me/broadcast-sso — authenticated pilot opens their own share-portal */
router.get("/me/broadcast-sso", requireAuth, async (req, res) => {
  const found = await db.select().from(pilot).where(eq(pilot.id, req.user!.id)).get();
  if (!found) {
    res.status(404).json({ error: "Pilot not found" });
    return;
  }

  await syncPilot(found);

  const result = await issueSsoToken(found.id);
  if (!result) {
    res.status(503).json({ error: "Share-portal unavailable or not configured" });
    return;
  }

  res.json(result);
});

/** GET /pilots/:id/broadcast-sso — admin/modo only, issues a share-portal SSO token for the pilot */
router.get("/:id/broadcast-sso", ...requireModo, async (req, res) => {
  const found = await db.select().from(pilot).where(eq(pilot.id, String(req.params.id))).get();
  if (!found) {
    res.status(404).json({ error: "Pilot not found" });
    return;
  }

  await syncPilot(found);

  const result = await issueSsoToken(found.id);
  if (!result) {
    res.status(503).json({ error: "Share-portal unavailable or not configured" });
    return;
  }

  res.json(result);
});

/** GET /pilots/:id — admin/modo only */
router.get("/:id", ...requireModo, async (req, res) => {
  const found = await db.select().from(pilot).where(eq(pilot.id, String(req.params.id))).get();
  if (!found) { res.status(404).json({ error: "Pilot not found" }); return; }
  res.json(safePublic(found));
});

/**
 * PATCH /pilots/me — pilot edits their own profile
 * Lockable fields (teamId, vehicleId, controlsId) are blocked
 * once the pilot has a VALIDATED race_entry.
 */
router.patch("/me", requireAuth, validate(updatePilotSchema), async (req, res) => {
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
  const configChanged = LOCKABLE_FIELDS.some(f => patch[f] !== undefined)
    || patch.displayName !== undefined || patch.country !== undefined;
  if (configChanged) await refreshPilotEntrySnapshots(pilotId);
  if (patch.displayName !== undefined) void syncPilot(updated);
  emitDashboard("data-changed", { resource: "pilots" });
  res.json(safePublic(updated));
});

/**
 * PATCH /pilots/:id — admin/modo edits any pilot's profile (no field locks)
 */
router.patch("/:id", ...requireModo, validate(updatePilotSchema), async (req, res) => {
  const allowed = [...ALWAYS_EDITABLE, ...LOCKABLE_FIELDS, "role"] as const;
  const patch: Record<string, unknown> = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) patch[field] = req.body[field];
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }
  if (patch.role !== undefined) {
    patch.tokenVersion = drizzleSql`${pilot.tokenVersion} + 1`;
    if (patch.role === "PILOT") {
      await db.delete(deviceToken).where(eq(deviceToken.pilotId, String(req.params.id)));
    }
  }
  const [updated] = await db.update(pilot).set(patch).where(eq(pilot.id, String(req.params.id))).returning();
  if (!updated) { res.status(404).json({ error: "Pilot not found" }); return; }
  const configChanged = LOCKABLE_FIELDS.some(f => patch[f] !== undefined)
    || patch.displayName !== undefined || patch.country !== undefined;
  if (configChanged) await refreshPilotEntrySnapshots(String(req.params.id));
  if (patch.displayName !== undefined) void syncPilot(updated);
  emitDashboard("data-changed", { resource: "pilots" });
  res.json(safePublic(updated));
});

/** POST /pilots/:id/reset-password — admin only, generates a passphrase and invalidates existing sessions */
router.post("/:id/reset-password", ...requireAdmin, async (req, res) => {
  const passphrase = generatePassphrase();
  const passwordHash = await hash(passphrase, 12);
  const updated = await db.update(pilot)
    .set({ passwordHash, tokenVersion: drizzleSql`${pilot.tokenVersion} + 1` })
    .where(eq(pilot.id, String(req.params.id)))
    .returning({ id: pilot.id })
    .get();
  if (!updated) { res.status(404).json({ error: "Pilot not found" }); return; }
  void notifyPasswordChanged(String(req.params.id));
  res.json({ passphrase });
});

/** DELETE /pilots — admin only, deletes all pilots except the authenticated requester */
router.delete("/", ...requireAdmin, async (req, res) => {
  await db.delete(pilot).where(ne(pilot.id, req.user!.id));
  emitDashboard("data-changed", { resource: "pilots" });
  res.sendStatus(204);
});

/** DELETE /pilots/:id — admin only */
router.delete("/:id", ...requireAdmin, async (req, res) => {
  const pilotId = String(req.params.id);
  void deactivatePilot(pilotId);
  await db.delete(pilot).where(eq(pilot.id, pilotId));
  emitDashboard("data-changed", { resource: "pilots" });
  res.sendStatus(204);
});

export default router;
