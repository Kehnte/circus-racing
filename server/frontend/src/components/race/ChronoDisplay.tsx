// ChronoDisplay — Autonomous elapsed-time display with 100ms internal interval.
// Computes and formats pilot chrono based on race chronoDisplayMode.

import { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import type { PilotRaceState, RaceStatePayload } from '../../types.ts';

function formatMs(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const millis = Math.floor((ms % 1000) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
}

function computeElapsedMs(pilot: PilotRaceState, raceState: RaceStatePayload, now: number): number {
  if (pilot.frozenTime) {
    if (!raceState.startedAt) return 0;
    return new Date(pilot.frozenTime).getTime() - new Date(raceState.startedAt).getTime() - raceState.totalPausedMs;
  }
  if (!raceState.startedAt) return 0;
  const pauseOffset = raceState.status === 'PAUSED' && raceState.pausedAt
    ? now - new Date(raceState.pausedAt).getTime()
    : 0;
  return now - new Date(raceState.startedAt).getTime() - raceState.totalPausedMs - pauseOffset;
}

interface Props {
  pilot: PilotRaceState;
  raceState: RaceStatePayload;
}

export default function ChronoDisplay({ pilot, raceState }: Props) {
  const [, tick] = useState(0);

  // Tick every 100ms only while the race is running.
  useEffect(() => {
    if (raceState.status !== 'STARTED') return;
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [raceState.status]);

  const now = Date.now();
  const { chronoDisplayMode } = raceState;

  if (chronoDisplayMode === 'hidden') return null;

  let display = '—';

  if (chronoDisplayMode === 'static') {
    display = '--:--.---';
  } else if (chronoDisplayMode === 'best-lap') {
    if (pilot.lapTimes.length > 0) {
      display = formatMs(Math.min(...pilot.lapTimes));
    }
  } else if (chronoDisplayMode === 'last-lap') {
    if (pilot.lapTimes.length > 0) {
      display = formatMs(pilot.lapTimes[pilot.lapTimes.length - 1]);
    }
  } else {
    // leader or gap — need elapsed times
    const myElapsed = computeElapsedMs(pilot, raceState, now);

    if (chronoDisplayMode === 'leader') {
      display = formatMs(myElapsed);
    } else {
      // gap: difference vs. pilot in position 1
      const leader = raceState.pilots.find((p) => p.position === 1);
      if (leader && leader.id !== pilot.id) {
        const leaderElapsed = computeElapsedMs(leader, raceState, now);
        const delta = myElapsed - leaderElapsed;
        display = delta > 0 ? `+${formatMs(delta)}` : formatMs(myElapsed);
      } else {
        display = formatMs(myElapsed);
      }
    }
  }

  return (
    <Typography
      component="span"
      variant="body2"
      sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: 13 }}
    >
      {display}
    </Typography>
  );
}
