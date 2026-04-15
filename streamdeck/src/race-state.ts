// race-state.ts — Shared in-memory state polled from the server, with change callbacks.

import { getActiveRace, getRaceEntries, type Race, type PilotEntry, type RaceStatus } from "./api.js";
import { config } from "./config.js";

export interface PilotSlot {
  pilotId: string;
  displayName: string;
  teamAcronym: string | null;
  lap: number;
  status: "RUNNING" | "FINISHED" | "DNF";
  position: number | null;
}

export interface RaceSnapshot {
  raceId:     string;
  raceName:   string;
  raceStatus: RaceStatus;
  pilots:     PilotSlot[];  // sorted by gridPosition
}

type ChangeListener = (snapshot: RaceSnapshot | null) => void;

let current: RaceSnapshot | null = null;
const listeners: ChangeListener[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

export function getSnapshot(): RaceSnapshot | null { return current; }

export function onStateChange(fn: ChangeListener): () => void {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); };
}

function notify() { for (const fn of listeners) fn(current); }

async function poll() {
  try {
    const race = await getActiveRace();
    if (!race) {
      if (current !== null) { current = null; notify(); }
      return;
    }

    const entries = await getRaceEntries(race.id);
    const sorted  = [...entries].sort((a, b) => (a.gridPosition ?? 99) - (b.gridPosition ?? 99));

    const pilots: PilotSlot[] = sorted.map(e => ({
      pilotId:     e.pilotId,
      displayName: e.pilot?.displayName ?? e.pilotId.slice(0, 8),
      teamAcronym: e.pilot?.teamAcronym ?? null,
      lap:         0,
      status:      "RUNNING",
      position:    e.gridPosition,
    }));

    const next: RaceSnapshot = {
      raceId:     race.id,
      raceName:   race.name,
      raceStatus: race.status,
      pilots,
    };

    const changed = JSON.stringify(next) !== JSON.stringify(current);
    if (changed) { current = next; notify(); }
  } catch {
    // server unreachable — keep last known state
  }
}

export function startPolling() {
  if (timer) return;
  void poll();
  timer = setInterval(() => { void poll(); }, config.pollIntervalMs);
}

export function stopPolling() {
  if (timer) { clearInterval(timer); timer = null; }
}
