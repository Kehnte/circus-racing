// RaceControlBar — Race lifecycle controls with status-aware button states.

import { useState } from 'react';
import type { ChangeEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import PauseOutlined from '@mui/icons-material/PauseOutlined';
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import StopOutlined from '@mui/icons-material/StopOutlined';
import { apiFetch } from '../../api.ts';
import type { RaceStatePayload } from '../../types.ts';

interface Props {
  raceState: RaceStatePayload;
}

export default function RaceControlBar({ raceState }: Props) {
  const { raceId, status } = raceState;
  const [countdownSecs, setCountdownSecs] = useState('10');

  const isPending = status === 'PENDING' || status === 'SCHEDULED';
  const isStarted = status === 'STARTED';
  const isPaused = status === 'PAUSED';
  const isFinished = status === 'FINISHED';

  async function call(path: string) {
    await apiFetch(path, { method: 'POST' });
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
      {/* Lifecycle controls */}
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowOutlined />}
          disabled={!(isPending || isPaused)}
          onClick={() => void call(isPaused ? `/api/races/${raceId}/resume` : `/api/races/${raceId}/start`)}
        >
          {isPaused ? 'resume' : 'start'}
        </Button>

        <Button
          variant="outlined"
          size="small"
          startIcon={<PauseOutlined />}
          disabled={!isStarted}
          onClick={() => void call(`/api/races/${raceId}/pause`)}
        >
          pause
        </Button>

        <Button
          variant="outlined"
          size="small"
          startIcon={<StopOutlined />}
          disabled={!(isStarted || isPaused)}
          onClick={() => void call(`/api/races/${raceId}/finish`)}
        >
          finish
        </Button>

        <Button
          variant="outlined"
          size="small"
          color="warning"
          startIcon={<RefreshOutlined />}
          disabled={isFinished ? false : !(isStarted || isPaused)}
          onClick={() => void call(`/api/races/${raceId}/reset`)}
        >
          reset
        </Button>

        <Button
          variant="text"
          size="small"
          onClick={() => void call(`/api/races/${raceId}/load`)}
        >
          reload
        </Button>
      </Stack>

      <Divider orientation="vertical" flexItem />

      {/* Countdown */}
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
          variant="outlined"
          size="small"
          onClick={() =>
            void apiFetch(`/api/race-events/races/${raceId}/countdown`, {
              method: 'POST',
              body: JSON.stringify({ seconds: Number(countdownSecs) }),
            })
          }
        >
          start
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() =>
            void apiFetch(`/api/race-events/races/${raceId}/countdown-stop`, { method: 'POST' })
          }
        >
          stop
        </Button>
      </Stack>
    </Box>
  );
}
