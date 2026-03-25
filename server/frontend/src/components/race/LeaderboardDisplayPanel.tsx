// LeaderboardDisplayPanel — Overlay display settings and countdown controls for the leaderboard.

import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import StopOutlined from '@mui/icons-material/StopOutlined';
import { apiFetch } from '../../api.ts';
import type { RaceStatePayload } from '../../types.ts';

interface Props {
  raceState: RaceStatePayload;
}

export default function LeaderboardDisplayPanel({ raceState }: Props) {
  const { raceId, status, teamDisplayMode, chronoDisplayMode, timingEnabled } = raceState;
  const canCountdown = status === 'PENDING' || status === 'SCHEDULED';
  const [countdownSecs, setCountdownSecs] = useState('10');
  const [countdownRunning, setCountdownRunning] = useState(false);

  // Reset button state when the race starts (countdown fired or manual start).
  useEffect(() => {
    if (raceState.status === 'STARTED') setCountdownRunning(false);
  }, [raceState.status]);

  function immediatePatch(field: string, value: string | number | boolean) {
    void apiFetch(`/api/races/${raceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value }),
    });
  }

  async function toggleCountdown() {
    if (countdownRunning) {
      await apiFetch(`/api/race-events/races/${raceId}/countdown-stop`, { method: 'POST' });
      setCountdownRunning(false);
    } else {
      await apiFetch(`/api/race-events/races/${raceId}/countdown`, {
        method: 'POST',
        body: JSON.stringify({ seconds: Number(countdownSecs) }),
      });
      setCountdownRunning(true);
    }
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Team display</InputLabel>
        <Select value={teamDisplayMode} label="Team display" onChange={(e) => immediatePatch('teamDisplayMode', e.target.value)}>
          <MenuItem value="color-bar">Color bar</MenuItem>
          <MenuItem value="acronym">Acronym</MenuItem>
          <MenuItem value="hidden">Hidden</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Chrono mode</InputLabel>
        <Select value={chronoDisplayMode} label="Chrono mode" onChange={(e) => immediatePatch('chronoDisplayMode', e.target.value)}>
          <MenuItem value="leader">Leader</MenuItem>
          <MenuItem value="gap">Gap</MenuItem>
          <MenuItem value="best-lap">Best lap</MenuItem>
          <MenuItem value="last-lap">Last lap</MenuItem>
        </Select>
      </FormControl>

      <Button
        variant="outlined"
        size="small"
        color={timingEnabled ? 'primary' : 'error'}
        onClick={() => immediatePatch('timingEnabled', !timingEnabled)}
      >
        timing {timingEnabled ? 'on' : 'off'}
      </Button>

      <Divider orientation="vertical" flexItem />

      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          type="number"
          label="Countdown (s)"
          value={countdownSecs}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCountdownSecs(e.target.value)}
          size="small"
          sx={{ width: 120 }}
          inputProps={{ min: 1, max: 999 }}
        />
        <Button
          variant={countdownRunning ? 'outlined' : 'contained'}
          size="small"
          color={countdownRunning ? 'error' : 'primary'}
          startIcon={countdownRunning ? <StopOutlined /> : <PlayArrowOutlined />}
          disabled={!canCountdown && !countdownRunning}
          onClick={() => void toggleCountdown()}
        >
          {countdownRunning ? 'stop' : 'start'}
        </Button>
      </Stack>
    </Box>
  );
}
