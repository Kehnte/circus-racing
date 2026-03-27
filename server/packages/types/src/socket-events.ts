// socket-events.ts — Typed Socket.IO event payloads for all server emissions.

import type { RaceStatePayload } from "./race-state.js";

export interface ServerToClientEvents {
  "race-state": (payload: RaceStatePayload) => void;
  "race-event": (payload: RaceEventPayload) => void;
  "race-data": (payload: unknown) => void; // legacy overlay format
}

export type RaceEventType =
  | "checkpoint"
  | "lap"
  | "fastest-lap"
  | "finished"
  | "dnf"
  | "race-started"
  | "race-paused"
  | "race-resumed"
  | "race-finished"
  | "race-restarted";

export interface RaceEventPayload {
  type: RaceEventType;
  pilotId?: string;
  pilotName?: string;
  lap?: number;
  lapTimeMs?: number;
  position?: number;
  timestamp: string;
}
