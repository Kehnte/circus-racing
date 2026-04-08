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
import { distance3D } from "../engine/math.js";

const MAX_SPEED_MS = 2000; // m/s — above this, position is considered an OCR hallucination

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
  const newPos: [number, number, number] = [x, y, z];
  const now = new Date();

  recordOcrPosition(pilotId, newPos);

  // Speed filter — reject positions that imply physically impossible teleportation
  const ctx = getContext();
  if (ctx) {
    const tracking = ctx.ocrTracking[pilotId];
    if (tracking?.lastReceivedPosition && tracking.lastReceivedAt) {
      const dtMs = now.getTime() - new Date(tracking.lastReceivedAt).getTime();
      if (dtMs > 0) {
        const speed = distance3D(tracking.lastReceivedPosition, newPos) / (dtMs / 1000);
        if (speed > MAX_SPEED_MS) {
          const health = ctx.ocrHealth[pilotId];
          if (health) {
            health.rejectedCount += 1;
            health.lastRejectedAt = now.toISOString();
            health.lastRejectedSpeed = Math.round(speed);
            emitDashboard("ocr-health", ctx.ocrHealth);
          }
          res.json({ ok: true });
          return;
        }
      }
    }
    // Position accepted — update tracking and reset health counter
    if (ctx.ocrTracking[pilotId]) {
      ctx.ocrTracking[pilotId].lastReceivedPosition = newPos;
      ctx.ocrTracking[pilotId].lastReceivedAt = now.toISOString();
    }
    if (ctx.ocrHealth[pilotId]) {
      ctx.ocrHealth[pilotId].rejectedCount = 0;
    }
  }

  const result = processPosition(pilotId, newPos, now);

  if (!result || !ctx) {
    // Race not active, pilot not in race, or not in AUTO mode — silently OK
    res.json({ ok: true });
    return;
  }

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
