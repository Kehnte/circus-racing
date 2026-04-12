// streaming.ts — Stream config, director layout, and active-path proxy for mediamtx.
import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { streamSettings, directorState } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { requireModo } from "../middleware/roles.js";
import { emitAll } from "../socket/emitter.js";

const router = Router();

const MEDIAMTX_API = process.env.MEDIAMTX_API ?? "http://localhost:9997";

async function ensureStreamSettings() {
  const existing = await db.select().from(streamSettings).where(eq(streamSettings.id, 1)).get();
  if (!existing) {
    await db.insert(streamSettings).values({ id: 1, maxResolution: "1080p", maxFps: 30 });
    return { id: 1, maxResolution: "1080p" as const, maxFps: 30 };
  }
  return existing;
}

async function ensureDirectorState() {
  const existing = await db.select().from(directorState).where(eq(directorState.id, 1)).get();
  if (!existing) {
    await db.insert(directorState).values({ id: 1, mode: "single", slots: [] });
    return { id: 1, mode: "single", slots: [] as Array<{ type: "pilot" | "camera"; id: string } | null> };
  }
  return existing;
}

// GET /api/streaming/config — any authenticated user (pilots need quality constraints)
router.get("/config", requireAuth, async (_req: Request, res: Response) => {
  try {
    const cfg = await ensureStreamSettings();
    res.json(cfg);
  } catch {
    res.status(500).json({ error: "Failed to load stream config" });
  }
});

// PATCH /api/streaming/config — MODO+ only
router.patch("/config", requireModo, async (req: Request, res: Response) => {
  const { maxResolution, maxFps } = req.body as { maxResolution?: string; maxFps?: number };

  if (maxResolution !== undefined && !["480p", "720p", "1080p"].includes(maxResolution)) {
    res.status(400).json({ error: "maxResolution must be 480p, 720p, or 1080p" });
    return;
  }
  if (maxFps !== undefined && ![30, 60].includes(maxFps)) {
    res.status(400).json({ error: "maxFps must be 30 or 60" });
    return;
  }

  try {
    await ensureStreamSettings();
    const update: Partial<{ maxResolution: string; maxFps: number }> = {};
    if (maxResolution !== undefined) update.maxResolution = maxResolution;
    if (maxFps !== undefined) update.maxFps = maxFps;
    const [updated] = await db.update(streamSettings).set(update).where(eq(streamSettings.id, 1)).returning();
    emitAll("stream-config", updated);
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update stream config" });
  }
});

// GET /api/streaming/active — proxy mediamtx path list
router.get("/active", requireAuth, async (_req: Request, res: Response) => {
  try {
    const resp = await fetch(`${MEDIAMTX_API}/v3/paths/list`);
    if (!resp.ok) { res.json({ paths: [] }); return; }
    const data = await resp.json() as { items?: Array<{ name: string; ready: boolean }> };
    const paths = (data.items ?? []).filter((p) => p.ready).map((p) => p.name);
    res.json({ paths });
  } catch {
    res.json({ paths: [] });
  }
});

// GET /api/streaming/director — current layout (any authenticated user)
router.get("/director", requireAuth, async (_req: Request, res: Response) => {
  try {
    const state = await ensureDirectorState();
    res.json(state);
  } catch {
    res.status(500).json({ error: "Failed to load director state" });
  }
});

// PATCH /api/streaming/director — update layout, broadcast to all clients
router.patch("/director", requireModo, async (req: Request, res: Response) => {
  type Slot = { type: "pilot" | "camera"; id: string } | null;
  const { mode, slots } = req.body as { mode?: string; slots?: Slot[] };

  if (mode !== undefined && !["single", "side-by-side", "quad", "pip"].includes(mode)) {
    res.status(400).json({ error: "mode must be single, side-by-side, quad, or pip" });
    return;
  }

  try {
    await ensureDirectorState();
    const update: Partial<{ mode: string; slots: Slot[] }> = {};
    if (mode !== undefined) update.mode = mode;
    if (slots !== undefined) update.slots = slots;
    const [updated] = await db.update(directorState).set(update).where(eq(directorState.id, 1)).returning();
    emitAll("director-layout", updated);
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update director state" });
  }
});

export default router;
