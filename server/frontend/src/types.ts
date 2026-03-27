// types.ts — Shared entity types matching the server DB schema.

export interface Team {
  id: string;
  name: string;
  acronym: string;
  color: string;
}

export interface Vehicle {
  id: string;
  type: string;
  model: string;
  img: string | null;
}

export interface Controls {
  id: string;
  type: string;
  img: string | null;
}

export interface Checkpoint {
  order: number;
  position: [number, number, number];
}

export interface Racetrack {
  id: string;
  name: string;
  checkpoints: Checkpoint[];
}

export interface Pilot {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
  country: string;
  avatarUrl: string | null;
  teamId: string | null;
  vehicleId: string | null;
  controlsId: string | null;
  createdAt: string;
  token: string;
}

// Race engine types.

export type RaceStatus = 'PENDING' | 'SCHEDULED' | 'STARTED' | 'PAUSED' | 'FINISHED';
export type PilotStatus = 'RUNNING' | 'DNF' | 'FINISHED';

export interface PilotRaceState {
  id: string;
  entryId: string;
  displayName: string;
  country: string;
  teamSnapshot: { name: string; color: string; acronym: string } | null;
  vehicleSnapshot: { type: string; model: string } | null;
  position: number;       // rank 1-based
  lap: number;
  lapTimes: number[];     // ms per lap
  status: PilotStatus;
  frozenTime: string | null; // ISO — set when FINISHED or DNF
}

export interface RaceStatePayload {
  raceId: string;
  raceName: string;
  racetrackId: string | null;
  status: RaceStatus;
  trackingMode: 'manual' | 'auto';
  session: string;
  weather: string;
  startType: string;
  sessionMode: 'laps' | 'time';
  lapCount: number;
  sessionDurationMs: number | null;
  startedAt: string | null;
  pausedAt: string | null;
  totalPausedMs: number;
  globalFastestLapMs: number | null;
  globalFastestLapPilotId: string | null;
  teamDisplayMode: string;
  chronoDisplayMode: 'gap' | 'leader' | 'best-lap' | 'last-lap';
  timingEnabled: boolean;
  eventDuration: number;
  pilots: PilotRaceState[];
}

export interface RaceMeta {
  id: string;
  name: string;
  status: RaceStatus;
  trackingMode: 'manual' | 'auto';
  session: string;
}
