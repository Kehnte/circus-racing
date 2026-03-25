// AddPilotDialog — Selects pilots from roster to add directly to the race as VALIDATED.

import { useState } from 'react';
import useSWR from 'swr';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import { apiFetch, fetcher } from '../../api.ts';
import type { Pilot, RaceStatePayload } from '../../types.ts';

interface Props {
  open: boolean;
  raceState: RaceStatePayload;
  onClose: () => void;
}

const columns: GridColDef<Pilot>[] = [
  { field: 'displayName', headerName: 'Name', flex: 1 },
];

export default function AddPilotDialog({ open, raceState, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: allPilots } = useSWR<Pilot[]>(open ? '/api/pilots' : null, fetcher);

  // Filter out pilots already in the race.
  const alreadyIn = new Set(raceState.pilots.map((p) => p.id));
  const available = (allPilots ?? []).filter((p) => !alreadyIn.has(p.id));

  async function handleAdd() {
    setLoading(true);
    for (const pilotId of selected) {
      await apiFetch(`/api/races/${raceState.raceId}/entries/admin`, {
        method: 'POST',
        body: JSON.stringify({ pilotId }),
      });
    }
    setLoading(false);
    setSelected([]);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add pilots</DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        <DataGrid
          rows={available}
          columns={columns}

          checkboxSelection
          disableColumnMenu
          autoHeight
          hideFooter={available.length <= 25}
          pageSizeOptions={[25]}
          rowSelectionModel={selected}
          onRowSelectionModelChange={(ids) => setSelected(ids as string[])}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>cancel</Button>
        <Button
          variant="contained"
          disabled={selected.length === 0 || loading}
          onClick={() => void handleAdd()}
        >
          add {selected.length > 0 ? `(${selected.length})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
