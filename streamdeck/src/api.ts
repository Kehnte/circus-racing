// api.ts — Thin HTTP client wrapping the Circus Racing REST API.

import { config } from "./config.js";

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${config.serverUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

// Race state
export type RaceStatus = "PENDING" | "SCHEDULED" | "STARTED" | "PAUSED" | "FINISHED";

export interface Race {
  id: string;
  name: string;
  status: RaceStatus;
}

export interface PilotEntry {
  id: string;
  pilotId: string;
  pilot: { id: string; displayName: string; teamAcronym: string | null } | null;
  gridPosition: number | null;
}

export interface PilotState {
  lap: number;
  status: "RUNNING" | "FINISHED" | "DNF";
  gridPosition: number | null;
}

export interface RaceContext {
  raceId: string;
  raceStatus: RaceStatus;
  pilotStates: Record<string, PilotState>;
  pilotProfiles: Record<string, { displayName: string }>;
}

// Fetch the most relevant race: active first, then scheduled/pending
export async function getActiveRace(): Promise<Race | null> {
  const active = await request("GET", "/api/races?status=STARTED,PAUSED") as Race[];
  if (active.length > 0) return active[0];
  const pending = await request("GET", "/api/races?status=SCHEDULED,PENDING") as Race[];
  return pending[0] ?? null;
}

export async function getRaceEntries(raceId: string): Promise<PilotEntry[]> {
  return request("GET", `/api/races/${raceId}/entries`) as Promise<PilotEntry[]>;
}

// Lifecycle
export const startRace  = (id: string) => request("POST", `/api/races/${id}/start`);
export const pauseRace  = (id: string) => request("POST", `/api/races/${id}/pause`);
export const resumeRace = (id: string) => request("POST", `/api/races/${id}/resume`);
export const finishRace = (id: string) => request("POST", `/api/races/${id}/finish`);
export const resetRace  = (id: string) => request("POST", `/api/races/${id}/reset`);

// Pilot actions
export const manualLap = (raceId: string, pilotId: string, delta: 1 | -1) =>
  request("POST", `/api/race-events/races/${raceId}/manual-lap`, { pilotId, delta });

export const manualDnf = (raceId: string, pilotId: string) =>
  request("POST", `/api/race-events/races/${raceId}/manual-dnf`, { pilotId });

export const manualPosition = (raceId: string, pilotId: string, position: number) =>
  request("POST", `/api/race-events/races/${raceId}/manual-position`, { pilotId, position });
