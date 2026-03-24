// DnfWarningPanel — Shows AUTO mode DNF warnings with confirm/ignore actions.
// Visible only when trackingMode === 'auto' and there are WARNING_DNF pilots.

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { apiFetch } from '../../api.ts';
import type { RaceStatePayload } from '../../types.ts';

interface Props {
  raceState: RaceStatePayload;
}

export default function DnfWarningPanel({ raceState }: Props) {
  const warnings = raceState.pilots.filter((p) => p.status === 'WARNING_DNF');
  if (raceState.trackingMode !== 'auto' || warnings.length === 0) return null;

  async function confirm(pilotId: string) {
    await apiFetch(`/api/race-events/races/${raceState.raceId}/confirm-dnf/${pilotId}`, { method: 'POST' });
  }

  async function ignore(pilotId: string) {
    await apiFetch(`/api/race-events/races/${raceState.raceId}/ignore-dnf/${pilotId}`, { method: 'POST' });
  }

  return (
    <Stack spacing={1} mb={2}>
      {warnings.map((p) => (
        <Alert
          key={p.id}
          severity="warning"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button color="inherit" size="small" onClick={() => void confirm(p.id)}>
                confirm dnf
              </Button>
              <Button color="inherit" size="small" onClick={() => void ignore(p.id)}>
                ignore
              </Button>
            </Box>
          }
        >
          {p.displayName} is out of track
        </Alert>
      ))}
    </Stack>
  );
}
