// RaceControlBar — Race lifecycle controls with status-aware button states.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import PauseOutlined from '@mui/icons-material/PauseOutlined';
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SyncOutlined from '@mui/icons-material/SyncOutlined';
import StopOutlined from '@mui/icons-material/StopOutlined';
import { apiFetch } from '../../api.ts';
import type { RaceStatePayload } from '../../types.ts';

interface Props {
  raceState: RaceStatePayload;
}

export default function RaceControlBar({ raceState }: Props) {
  const { raceId, status, trackingMode, racetrackId } = raceState;

  const isPending = status === 'PENDING' || status === 'SCHEDULED';
  const isStarted = status === 'STARTED';
  const isPaused = status === 'PAUSED';
  const isFinished = status === 'FINISHED';
  const missingCircuit = trackingMode === 'auto' && !racetrackId;

  async function call(path: string) {
    await apiFetch(path, { method: 'POST' });
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowOutlined />}
          disabled={!(isPending || isPaused) || missingCircuit}
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
          variant="outlined"
          size="small"
          startIcon={<SyncOutlined />}
          onClick={() => void call(`/api/races/${raceId}/load`)}
        >
          reload
        </Button>
      </Stack>
    </Box>
  );
}
