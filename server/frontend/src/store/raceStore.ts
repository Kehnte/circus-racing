// raceStore.ts — Zustand store for live race state and active race selection.

import { create } from 'zustand';
import type { RaceStatePayload } from '../types.ts';

interface RaceStore {
  raceState: RaceStatePayload | null;
  activeRaceId: string | null;
  setRaceState: (s: RaceStatePayload | null) => void;
  setActiveRaceId: (id: string | null) => void;
}

export const useRaceStore = create<RaceStore>((set) => ({
  raceState: null,
  activeRaceId: null,
  setRaceState: (s) => set({ raceState: s }),
  setActiveRaceId: (id) => set({ activeRaceId: id, ...(id === null ? { raceState: null } : {}) }),
}));
