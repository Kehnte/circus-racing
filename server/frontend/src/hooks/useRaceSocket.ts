// useRaceSocket — Connects to Socket.IO and syncs race-state and ocr-status to the Zustand store.
// Also invalidates the SWR race list cache on race-list-changed events.

import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { mutate } from 'swr';
import type { OcrStatusMap, RaceStatePayload } from '../types.ts';
import type { OcrHealthMap } from '../types.ts';
import { useRaceStore } from '../store/raceStore.ts';

export function useRaceSocket() {
  const setRaceState = useRaceStore((s) => s.setRaceState);
  const setOcrStatusMap = useRaceStore((s) => s.setOcrStatusMap);
  const setOcrHealthMap = useRaceStore((s) => s.setOcrHealthMap);

  useEffect(() => {
    const socket = io(window.location.origin, {
      query: { role: 'dashboard' },
      path: '/socket.io',
    });

    socket.on('race-state', (data: RaceStatePayload & { ocrHealth?: OcrHealthMap }) => {
      if (useRaceStore.getState().activeRaceId !== null) {
        setRaceState(data);
        if (data.ocrHealth) setOcrHealthMap(data.ocrHealth);
      }
    });

    socket.on('ocr-status', (data: OcrStatusMap) => {
      setOcrStatusMap(data);
    });

    socket.on('ocr-health', (data: OcrHealthMap) => {
      setOcrHealthMap(data);
    });

    socket.on('race-list-changed', () => {
      void mutate('/api/races');
    });

    return () => {
      socket.disconnect();
    };
  }, [setRaceState, setOcrStatusMap, setOcrHealthMap]);
}
