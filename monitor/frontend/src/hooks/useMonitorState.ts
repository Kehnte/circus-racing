// useMonitorState.ts — Polls /api/state every 800ms and returns the current monitor state.

import { useState, useEffect } from 'react';
import type { MonitorState } from '../types';

const POLL_INTERVAL = 800;

export function useMonitorState() {
  const [state, setState] = useState<MonitorState | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) { setError(true); return; }
        setState(await res.json());
        setError(false);
      } catch {
        setError(true);
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return { state, error };
}
