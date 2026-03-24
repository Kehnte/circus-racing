// CircuitsPage — CRUD for racetracks with JSON checkpoint import (MODERATOR+).

import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import useSWR from 'swr';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import { apiFetch, fetcher } from '../api.ts';
import CrudToolbar from '../components/CrudToolbar.tsx';
import ConfirmDialog from '../components/ConfirmDialog.tsx';
import type { Checkpoint, Racetrack } from '../types.ts';

// Normalize various JSON checkpoint formats into the canonical {order, position} shape.
function parseCheckpoints(raw: unknown): Checkpoint[] {
  if (!Array.isArray(raw)) throw new Error('Expected a JSON array');

  return raw.map((item: unknown, i: number) => {
    if (Array.isArray(item) && item.length >= 3) {
      return { order: i, position: [Number(item[0]), Number(item[1]), Number(item[2])] as [number, number, number] };
    }
    if (item !== null && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      if ('position' in obj && Array.isArray(obj.position)) {
        const p = obj.position as unknown[];
        return { order: i, position: [Number(p[0]), Number(p[1]), Number(p[2])] as [number, number, number] };
      }
      if ('x' in obj) {
        return { order: i, position: [Number(obj.x), Number(obj.y), Number(obj.z)] as [number, number, number] };
      }
    }
    throw new Error(`Unrecognized checkpoint format at index ${i}`);
  });
}

export default function CircuitsPage() {
  const { data, mutate } = useSWR<Racetrack[]>('/api/racetracks', fetcher);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Racetrack | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openCreate() {
    setName('');
    setCheckpoints(null);
    setParseError('');
    setDialogOpen(true);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as unknown;
        setCheckpoints(parseCheckpoints(parsed));
        setParseError('');
      } catch (err) {
        setCheckpoints(null);
        setParseError(err instanceof Error ? err.message : 'Invalid JSON');
      }
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/racetracks', {
      method: 'POST',
      body: JSON.stringify({ name, checkpoints: checkpoints ?? [] }),
    });
    await mutate();
    setDialogOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/api/racetracks/${deleteTarget.id}`, { method: 'DELETE' });
    await mutate();
    setDeleteTarget(null);
  }

  const columns: GridColDef<Racetrack>[] = [
    { field: 'name', headerName: 'Name', flex: 2, minWidth: 120 },
    {
      field: 'checkpoints',
      headerName: 'Checkpoints',
      flex: 1,
      minWidth: 110,
      renderCell: (params: GridRenderCellParams<Racetrack, Checkpoint[]>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
          <LocationOnOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: 12 }}>
            {params.value?.length ?? 0}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      minWidth: 48,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Racetrack>) => (
        <IconButton size="small" onClick={() => setDeleteTarget(params.row)}>
          <DeleteOutlined fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="overline">Circuits</Typography>
        <Button variant="contained" size="small" startIcon={<AddOutlined />} onClick={openCreate}>
          add circuit
        </Button>
      </Stack>

      <DataGrid
        rows={data ?? []}
        columns={columns}
        density="compact"
        pageSizeOptions={[25, 50]}
        disableRowSelectionOnClick
        slots={{ toolbar: CrudToolbar }}
        sx={{ flex: 1 }}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add circuit</DialogTitle>
        <Box component="form" onSubmit={(e: FormEvent) => void handleSubmit(e)}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Name"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              required
              fullWidth
            />
            <Box>
              <Button component="label" variant="outlined" size="small" fullWidth>
                {checkpoints ? `${checkpoints.length} checkpoints loaded` : 'Upload checkpoints JSON'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  hidden
                  onChange={handleFileChange}
                />
              </Button>
              <Collapse in={!!parseError}>
                <Alert severity="error" sx={{ mt: 1 }}>{parseError}</Alert>
              </Collapse>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete circuit"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
