// raceStore.ts — Zustand store for live race state and active race selection.

import { create } from 'zustand';
import type { OcrStatusMap, RaceStatePayload } from '../types.ts';
import type { OcrHealthMap } from '../types.ts';

const REJECTION_BUFFER_WINDOW_MS = 60_000;

export interface RejectionSample { speed: number; t: number }
// Per-pilot sliding window (last 60s) of rejection speeds
export type RejectionHistoryMap = Record<string, RejectionSample[]>;

interface RaceStore {
  raceState: RaceStatePayload | null;
  activeRaceId: string | null;
  ocrStatusMap: OcrStatusMap;
  ocrHealthMap: OcrHealthMap;
  rejectionHistory: RejectionHistoryMap;
  entryCancelledPilot: string | null;
  setRaceState: (s: RaceStatePayload | null) => void;
  setActiveRaceId: (id: string | null) => void;
  setOcrStatusMap: (m: OcrStatusMap) => void;
  setOcrHealthMap: (m: OcrHealthMap) => void;
  setEntryCancelledPilot: (name: string | null) => void;
}

export const useRaceStore = create<RaceStore>((set, get) => ({
  raceState: null,
  activeRaceId: null,
  ocrStatusMap: {},
  ocrHealthMap: {},
  rejectionHistory: {},
  entryCancelledPilot: null,
  setRaceState: (s) => set({ raceState: s }),
  setActiveRaceId: (id) => set({ activeRaceId: id, ...(id === null ? { raceState: null } : {}) }),
  setOcrStatusMap: (m) => set({ ocrStatusMap: m }),
  setEntryCancelledPilot: (name) => set({ entryCancelledPilot: name }),
  setOcrHealthMap: (m) => {
    const now = Date.now();
    const prev = get().rejectionHistory;
    const next: RejectionHistoryMap = { ...prev };

    for (const [pilotId, health] of Object.entries(m)) {
      if (health.lastRejectedSpeed != null && health.lastRejectedAt != null) {
        const sampleT = new Date(health.lastRejectedAt).getTime();
        const existing = prev[pilotId] ?? [];
        // Only push if this sample is newer than the last recorded one
        const lastSample = existing.at(-1);
        if (!lastSample || sampleT > lastSample.t) {
          const pruned = existing.filter((s) => now - s.t < REJECTION_BUFFER_WINDOW_MS);
          next[pilotId] = [...pruned, { speed: health.lastRejectedSpeed, t: sampleT }];
        }
      } else {
        // No active rejection — just prune stale entries
        next[pilotId] = (prev[pilotId] ?? []).filter((s) => now - s.t < REJECTION_BUFFER_WINDOW_MS);
      }
    }

    set({ ocrHealthMap: m, rejectionHistory: next });
  },
}));
