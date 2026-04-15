// race-state.ts — Shared in-memory state polled from the server, with change callbacks.

import streamDeck from "@elgato/streamdeck";
import { getActiveRace, getRaceEntries, getRaceState, type PilotEntry, type RaceStatus } from "./api.js";
import { config } from "./config.js";

export interface PilotSlot {
  pilotId:     string;
  displayName: string;
  teamAcronym: string | null;
  lap:         number;
  status:      "RUNNING" | "FINISHED" | "DNF";
  position:    number | null; // live gridPosition (rank in race)
}

export interface RaceSnapshot {
  raceId:     string;
  raceName:   string;
  raceStatus: RaceStatus;
  pilots:     PilotSlot[]; // sorted by entry order (gridPosition at race start), stable
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

    let entries, states;
    try {
      [entries, states] = await Promise.all([
        getRaceEntries(race.id),
        getRaceState(race.id),
      ]);
    } catch (err) {
      streamDeck.logger.error("poll fetch error: " + String(err));
      if (current !== null) { current = null; notify(); }
      return;
    }

    // Sort by pilotId — stable order regardless of live position changes
    const sorted = [...entries].sort((a, b) => a.pilotId.localeCompare(b.pilotId));

    const pilots: PilotSlot[] = sorted.map((e: PilotEntry) => {
      const s = states[e.pilotId];
      return {
        pilotId:     e.pilotId,
        displayName: e.pilot?.displayName ?? e.pilotId.slice(0, 8),
        teamAcronym: e.pilot?.teamAcronym ?? null,
        lap:         s?.lap ?? 0,
        status:      (s?.status ?? "RUNNING") as "RUNNING" | "FINISHED" | "DNF",
        position:    s?.gridPosition ?? e.gridPosition,
      };
    });

    const next: RaceSnapshot = {
      raceId:     race.id,
      raceName:   race.name,
      raceStatus: race.status,
      pilots,
    };

    const changed = JSON.stringify(next) !== JSON.stringify(current);
    if (changed) { current = next; notify(); }
  } catch (err) {
    streamDeck.logger.error("poll error: " + String(err));
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
