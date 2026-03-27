// race-engine.ts — AUTO mode race engine (checkpoint detection, lap counting).
import { distance3D, type Vec3 } from "./math.js";
import {
  getContext, setPilotState, CHECKPOINT_RADIUS,
  type RaceContext,
} from "./race-context.js";
import type { PilotState } from "../db/schema.js";

// Event types returned by processPosition

export type EngineEvent =
  | { type: "fastest-lap"; pilotId: string; lapMs: number; lapFormatted: string }
  | { type: "finished";    pilotId: string }
  | { type: "race-finished" };

export interface ProcessPositionResult {
  pilotState: PilotState;
  events: EngineEvent[];
}

// Helpers

function formatLapTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const millis = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function allDone(ctx: RaceContext): boolean {
  return Object.values(ctx.pilotStates).every(
    s => s.status === "FINISHED" || s.status === "DNF"
  );
}

// processPosition

export function processPosition(
  pilotId: string,
  position: Vec3,
  now: Date
): ProcessPositionResult | null {
  const ctx = getContext();
  if (!ctx) return null;
  if (ctx.trackingMode !== "auto") return null;

  const state = ctx.pilotStates[pilotId];
  if (!state) return null;
  if (state.status === "FINISHED" || state.status === "DNF") return null;

  const events: EngineEvent[] = [];
  const cps = ctx.checkpoints;
  const cpLen = cps.length;

  // Update position
  state.position = position;

  // Checkpoint detection
  if (cpLen > 0) {
    const nextIdx = state.nextCheckpointOrder % cpLen;
    const nextCP = cps[nextIdx];

    if (distance3D(position, nextCP.position as Vec3) < CHECKPOINT_RADIUS) {
      const nowIso = now.toISOString();

      if (nextIdx === 0 && state.lap > 0) {
        // Crossing the finish line → lap completed
        const lapMs = state.lastCheckpointTime
          ? now.getTime() - new Date(state.lastCheckpointTime).getTime()
          : 0;

        state.lapTimes.push(lapMs);

        // Check fastest lap
        if (lapMs > 0 && (ctx.globalFastestLapMs === null || lapMs < ctx.globalFastestLapMs)) {
          ctx.globalFastestLapMs = lapMs;
          ctx.globalFastestLapPilotId = pilotId;
          events.push({
            type: "fastest-lap",
            pilotId,
            lapMs,
            lapFormatted: formatLapTime(lapMs),
          });
        }

        state.lap += 1;

        // Check finish condition (laps mode)
        if (ctx.sessionMode === "laps" && state.lap > ctx.lapCount) {
          state.status = "FINISHED";
          state.frozenTime = nowIso;
          events.push({ type: "finished", pilotId });

          if (allDone(ctx)) events.push({ type: "race-finished" });

          setPilotState(pilotId, state);
          updateRaceProgress(ctx, pilotId, nextIdx, cpLen);
          return { pilotState: state, events };
        }
      } else if (nextIdx === 0 && state.lap === 0) {
        // First crossing of start/finish line — race has started for this pilot
        state.lap = 1;
      }

      state.nextCheckpointOrder = (nextIdx + 1) % cpLen;
      state.lastCheckpointTime = nowIso;
    }
  }

  updateRaceProgress(ctx, pilotId, state.nextCheckpointOrder % cpLen, cpLen);
  setPilotState(pilotId, state);

  return { pilotState: state, events };
}

function updateRaceProgress(
  ctx: RaceContext,
  pilotId: string,
  nextIdx: number,
  cpLen: number
): void {
  const state = ctx.pilotStates[pilotId];
  if (!state) return;
  const progress = cpLen > 0 ? nextIdx / cpLen : 0;
  state.progress = progress;
  state.raceProgress = state.lap + progress;
}
