// socket-events.ts — Typed Socket.IO event payloads for all server emissions.

import type { RaceStatePayload } from "./race-state.js";

export type OcrStatus = 'active' | 'stale' | 'offline';

export interface OcrPilotStatusEntry {
  status: OcrStatus;
  lastPositionAt: string | null;
}

export type OcrStatusMap = Record<string, OcrPilotStatusEntry>;

export interface ServerToClientEvents {
  "race-state": (payload: RaceStatePayload) => void;
  "race-event": (payload: RaceEventPayload) => void;
  "race-data": (payload: unknown) => void; // legacy overlay format
  "ocr-status": (payload: OcrStatusMap) => void;
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
