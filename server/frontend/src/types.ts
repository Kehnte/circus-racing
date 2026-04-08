// types.ts — Re-exports from @circus-racing/types for use across the dashboard.

export type {
  Team, Vehicle, Controls, Checkpoint, Racetrack, PilotRole, Pilot,
  RaceStatus, TrackingMode, SessionMode, TeamDisplayMode, ChronoDisplayMode,
  RaceEntryStatus, Race, RaceMeta,
  PilotRuntimeStatus, PilotRaceState, RaceStatePayload,
  RaceEventType, RaceEventPayload,
  OcrStatus, OcrPilotStatusEntry, OcrStatusMap,
} from "@circus-racing/types";

// PilotStatus is an alias kept for internal dashboard usage.
export type { PilotRuntimeStatus as PilotStatus } from "@circus-racing/types";

// OCR health data — admin-only, not part of the shared types package.
export interface OcrHealthEntry {
  rejectedCount: number;
  lastRejectedAt: string | null;
  lastRejectedSpeed: number | null;
}
export type OcrHealthMap = Record<string, OcrHealthEntry>;
