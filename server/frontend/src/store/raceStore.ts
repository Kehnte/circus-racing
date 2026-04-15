// raceStore.ts — Zustand store for live race state and active race selection.

import { create } from 'zustand';
import type { OcrStatusMap, RaceStatePayload } from '../types.ts';
import type { OcrHealthMap } from '../types.ts';

const REJECTION_BUFFER_WINDOW_MS = 60_000;
const LS_RACE_ID    = 'circus_active_race_id';
const LS_PANEL_RACE = 'circus_panel_race_open';
const LS_PANEL_OVL  = 'circus_panel_overlay_open';

export interface RejectionSample { speed: number; t: number }
// Per-pilot sliding window (last 60s) of rejection speeds
export type RejectionHistoryMap = Record<string, RejectionSample[]>;

interface RaceStore {
  raceState: RaceStatePayload | null;
  activeRaceId: string | null;
  raceSettingsOpen: boolean;
  overlaySettingsOpen: boolean;
  ocrStatusMap: OcrStatusMap;
  ocrHealthMap: OcrHealthMap;
  rejectionHistory: RejectionHistoryMap;
  entryCancelledPilot: string | null;
  setRaceState: (s: RaceStatePayload | null) => void;
  setActiveRaceId: (id: string | null) => void;
  setRaceSettingsOpen: (v: boolean) => void;
  setOverlaySettingsOpen: (v: boolean) => void;
  setOcrStatusMap: (m: OcrStatusMap) => void;
  setOcrHealthMap: (m: OcrHealthMap) => void;
  setEntryCancelledPilot: (name: string | null) => void;
}

export const useRaceStore = create<RaceStore>((set, get) => ({
  raceState: null,
  activeRaceId: localStorage.getItem(LS_RACE_ID),
  raceSettingsOpen: localStorage.getItem(LS_PANEL_RACE) !== 'false',
  overlaySettingsOpen: localStorage.getItem(LS_PANEL_OVL) !== 'false',
  ocrStatusMap: {},
  ocrHealthMap: {},
  rejectionHistory: {},
  entryCancelledPilot: null,
  setRaceState: (s) => set({ raceState: s }),
  setActiveRaceId: (id) => {
    if (id === null) localStorage.removeItem(LS_RACE_ID);
    else localStorage.setItem(LS_RACE_ID, id);
    set({ activeRaceId: id, ...(id === null ? { raceState: null } : {}) });
  },
  setRaceSettingsOpen: (v) => { localStorage.setItem(LS_PANEL_RACE, String(v)); set({ raceSettingsOpen: v }); },
  setOverlaySettingsOpen: (v) => { localStorage.setItem(LS_PANEL_OVL, String(v)); set({ overlaySettingsOpen: v }); },
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
