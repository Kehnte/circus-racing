// VehiclesPage — CRUD for vehicles (ships, rovers, bikes) (MODERATOR+).

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import useSWR from 'swr';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { apiFetch, fetcher } from '../api.ts';
import CrudToolbar from '../components/CrudToolbar.tsx';
import ConfirmDialog from '../components/ConfirmDialog.tsx';
import type { Vehicle } from '../types.ts';

const TYPES = ['ship', 'rover', 'bike'];

interface VehicleForm { type: string; model: string; img: string }
const EMPTY_FORM: VehicleForm = { type: 'ship', model: '', img: '' };

export default function VehiclesPage() {
  const { data, mutate } = useSWR<Vehicle[]>('/api/vehicles', fetcher);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditTarget(v);
    setForm({ type: v.type, model: v.model, img: v.img ?? '' });
    setDialogOpen(true);
  }

  function handleField(field: keyof VehicleForm) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = { ...form, img: form.img || null };
    if (editTarget) {
      await apiFetch(`/api/vehicles/${editTarget.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await apiFetch('/api/vehicles', { method: 'POST', body: JSON.stringify(payload) });
    }
    await mutate();
    setDialogOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/api/vehicles/${deleteTarget.id}`, { method: 'DELETE' });
    await mutate();
    setDeleteTarget(null);
  }

  const columns: GridColDef<Vehicle>[] = [
    {
      field: 'img',
      headerName: '',
      minWidth: 48,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Vehicle, string | null>) =>
        params.value ? (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Box component="img" src={params.value} alt="" sx={{ width: 32, height: 32, objectFit: 'contain' }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', color: 'text.disabled' }}>—</Box>
        ),
    },
    { field: 'model', headerName: 'Model', flex: 2, minWidth: 120 },
    {
      field: 'type',
      headerName: 'Type',
      flex: 1,
      minWidth: 80,
      renderCell: (params: GridRenderCellParams<Vehicle, string>) => (
        <Chip label={params.value ? params.value.charAt(0).toUpperCase() + params.value.slice(1) : ''} size="small" />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      minWidth: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Vehicle>) => (
        <>
          <IconButton size="small" onClick={() => openEdit(params.row)}>
            <EditOutlined fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setDeleteTarget(params.row)}>
            <DeleteOutlined fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="overline">Vehicles</Typography>
        <Button variant="contained" size="small" startIcon={<AddOutlined />} onClick={openCreate}>
          add vehicle
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
        <DialogTitle>{editTarget ? 'Edit vehicle' : 'Add vehicle'}</DialogTitle>
        <Box component="form" onSubmit={(e: FormEvent) => void handleSubmit(e)}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Model" value={form.model} onChange={handleField('model')} required fullWidth />
            <TextField
              select
              label="Type"
              value={form.type}
              onChange={handleField('type')}
              required
              fullWidth
            >
              {TYPES.map((t) => (
                <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>
              ))}
            </TextField>
            <TextField label="Image URL" value={form.img} onChange={handleField('img')} fullWidth />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete vehicle"
        description={`Delete "${deleteTarget?.model}"? This cannot be undone.`}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
