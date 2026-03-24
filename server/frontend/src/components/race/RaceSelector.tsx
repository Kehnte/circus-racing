// RaceSelector — Dropdown to load an active race and trigger CreateRaceDialog.

import { useState } from 'react';
import useSWR from 'swr';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { apiFetch, fetcher } from '../../api.ts';
import { useRaceStore } from '../../store/raceStore.ts';
import type { RaceMeta } from '../../types.ts';
import CreateRaceDialog from './CreateRaceDialog.tsx';

export default function RaceSelector() {
  const { activeRaceId, setActiveRaceId } = useRaceStore();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: races } = useSWR<RaceMeta[]>('/api/races', fetcher);

  async function handleSelect(raceId: string) {
    await apiFetch(`/api/races/${raceId}/load`, { method: 'POST' });
    setActiveRaceId(raceId);
  }

  function handleCreated(raceId: string) {
    setCreateOpen(false);
    setActiveRaceId(raceId);
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel>Active race</InputLabel>
          <Select
            value={activeRaceId ?? ''}
            label="Active race"
            onChange={(e) => void handleSelect(e.target.value)}
            displayEmpty
          >
            {(races ?? []).map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.name}
              </MenuItem>
            ))}
            {(races ?? []).length === 0 && (
              <MenuItem disabled value="">
                No active races
              </MenuItem>
            )}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          size="small"
          startIcon={<AddOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          new race
        </Button>
      </Box>

      <CreateRaceDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </>
  );
}
