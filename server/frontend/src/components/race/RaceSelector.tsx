// RaceSelector — Dropdown to load an active race, with new/delete race actions.

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import { apiFetch, fetcher } from '../../api.ts';
import { useRaceStore } from '../../store/raceStore.ts';
import useDialogs from '../../hooks/useDialogs/useDialogs.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import type { RaceMeta } from '../../types.ts';
import CreateRaceDialog from './CreateRaceDialog.tsx';

export default function RaceSelector() {
  const { activeRaceId, setActiveRaceId } = useRaceStore();
  const [createOpen, setCreateOpen] = useState(false);
  const dialogs = useDialogs();
  const notifications = useNotifications();

  const { data: races } = useSWR<RaceMeta[]>('/api/races', fetcher);

  const selectedRace = (races ?? []).find((r) => r.id === activeRaceId) ?? null;
  const canDelete = selectedRace !== null &&
    selectedRace.status !== 'STARTED' &&
    selectedRace.status !== 'PAUSED';

  async function handleSelect(raceId: string) {
    try {
      await apiFetch(`/api/races/${raceId}/load`, { method: 'POST' });
    } catch (err) {
      notifications.show((err as Error).message, { severity: 'error' });
    }
    // Set even on failure so the dropdown stays selected and delete is accessible.
    setActiveRaceId(raceId);
  }

  async function handleDelete() {
    if (!activeRaceId) return;
    const confirmed = await dialogs.confirm(
      `Delete "${selectedRace?.name}"? This cannot be undone.`,
      { title: 'Delete race', confirmLabel: 'delete', confirmColor: 'error' }
    );
    if (!confirmed) return;
    await apiFetch(`/api/races/${activeRaceId}`, { method: 'DELETE' });
    await mutate('/api/races');
    setActiveRaceId(null);
  }

  function handleCreated(raceId: string) {
    setCreateOpen(false);
    setActiveRaceId(raceId);
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <InputLabel shrink>Active race</InputLabel>
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

        <Button
          variant="outlined"
          size="small"
          color="error"
          startIcon={<DeleteOutlined />}
          disabled={!canDelete}
          onClick={() => void handleDelete()}
        >
          delete race
        </Button>
      </Box>

      <CreateRaceDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </>
  );
}
