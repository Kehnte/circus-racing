// ocr.ts — OCR position ingestion endpoint (receives monitor position data).
import { Router, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { pilot } from "../db/schema.js";
import { getContext, persistState } from "../engine/race-context.js";
import { processPosition } from "../engine/race-engine.js";
import { emitAll, emitDashboard, broadcastRaceState } from "../socket/emitter.js";
import { validate } from "../middleware/validate.js";
import { ocrPositionSchema } from "../validation/schemas.js";
import { recordOcrPosition } from "../engine/ocr-tracker.js";

const router = Router();

// Token auth middleware — reads x-token header, looks up pilot.token

async function requireOcrToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers["x-token"] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Missing x-token header" });
    return;
  }

  const found = await db.select({
    id: pilot.id,
    role: pilot.role,
  }).from(pilot).where(eq(pilot.token, token)).get();

  if (!found) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  req.user = { id: found.id, role: found.role };
  next();
}

// PUT /ocr/position
// Body: { x: number, y: number, z: number }

router.put("/position", requireOcrToken, validate(ocrPositionSchema), async (req, res) => {
  const { x, y, z } = req.body;
  const pilotId = req.user!.id;
  recordOcrPosition(pilotId, [x, y, z]);
  const result = processPosition(pilotId, [x, y, z], new Date());

  if (!result) {
    // Race not active, pilot not in race, or not in AUTO mode — silently OK
    res.json({ ok: true });
    return;
  }

  const ctx = getContext();
  if (!ctx) { res.json({ ok: true }); return; }

  // Emit events
  for (const event of result.events) {
    switch (event.type) {
      case "fastest-lap":
        emitAll("race-event", {
          type: "fastest-lap",
          pilotId: event.pilotId,
          pilotName: ctx.pilotProfiles[event.pilotId]?.displayName ?? event.pilotId,
          pilotCountry: ctx.pilotProfiles[event.pilotId]?.country ?? "un",
          teamName: (ctx.pilotProfiles[event.pilotId]?.teamSnapshot as Record<string,unknown>)?.name ?? null,
          teamColor: (ctx.pilotProfiles[event.pilotId]?.teamSnapshot as Record<string,unknown>)?.color ?? null,
          shipModel: (ctx.pilotProfiles[event.pilotId]?.vehicleSnapshot as Record<string,unknown>)?.model ?? null,
          time: event.lapFormatted,
          displayDuration: ctx.eventDuration,
        });
        break;
      case "finished":
        emitAll("race-event", {
          type: "finished",
          pilotId: event.pilotId,
          pilotName: ctx.pilotProfiles[event.pilotId]?.displayName ?? event.pilotId,
          pilotCountry: ctx.pilotProfiles[event.pilotId]?.country ?? "un",
          teamName: (ctx.pilotProfiles[event.pilotId]?.teamSnapshot as Record<string,unknown>)?.name ?? null,
          teamColor: (ctx.pilotProfiles[event.pilotId]?.teamSnapshot as Record<string,unknown>)?.color ?? null,
          shipModel: (ctx.pilotProfiles[event.pilotId]?.vehicleSnapshot as Record<string,unknown>)?.model ?? null,
          displayDuration: ctx.eventDuration,
        });
        break;
      case "race-finished":
        emitAll("race-event", { type: "race-finished" });
        emitDashboard("race-auto-finished", { raceId: ctx.raceId });
        break;
    }
  }

  broadcastRaceState(ctx);
  persistState(); // fire-and-forget

  res.json({ ok: true, lap: result.pilotState.lap });
});

export default router;
