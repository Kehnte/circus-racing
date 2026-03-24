// TeamsPage — CRUD for race teams (MODERATOR+).

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import useSWR from 'swr';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { apiFetch, fetcher } from '../api.ts';
import CrudToolbar from '../components/CrudToolbar.tsx';
import ConfirmDialog from '../components/ConfirmDialog.tsx';
import type { Team } from '../types.ts';

interface TeamForm { name: string; acronym: string; color: string }
const EMPTY_FORM: TeamForm = { name: '', acronym: '', color: '#FFD54F' };

export default function TeamsPage() {
  const { data, mutate } = useSWR<Team[]>('/api/teams', fetcher);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Team | null>(null);
  const [form, setForm] = useState<TeamForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(team: Team) {
    setEditTarget(team);
    setForm({ name: team.name, acronym: team.acronym, color: team.color });
    setDialogOpen(true);
  }

  function handleField(field: keyof TeamForm) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (editTarget) {
      await apiFetch(`/api/teams/${editTarget.id}`, { method: 'PATCH', body: JSON.stringify(form) });
    } else {
      await apiFetch('/api/teams', { method: 'POST', body: JSON.stringify(form) });
    }
    await mutate();
    setDialogOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/api/teams/${deleteTarget.id}`, { method: 'DELETE' });
    await mutate();
    setDeleteTarget(null);
  }

  const columns: GridColDef<Team>[] = [
    { field: 'name', headerName: 'Name', flex: 2, minWidth: 120 },
    { field: 'acronym', headerName: 'Acronym', flex: 1, minWidth: 80 },
    {
      field: 'color',
      headerName: 'Color',
      flex: 1,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<Team, string>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
          <Box sx={{ width: 16, height: 16, bgcolor: params.value, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: 12 }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      minWidth: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Team>) => (
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
        <Typography variant="overline">Teams</Typography>
        <Button variant="contained" size="small" startIcon={<AddOutlined />} onClick={openCreate}>
          add team
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
        <DialogTitle>{editTarget ? 'Edit team' : 'Add team'}</DialogTitle>
        <Box component="form" onSubmit={(e: FormEvent) => void handleSubmit(e)}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Name" value={form.name} onChange={handleField('name')} required fullWidth />
            <TextField
              label="Acronym"
              value={form.acronym}
              onChange={handleField('acronym')}
              required
              fullWidth
              inputProps={{ maxLength: 4 }}
            />
            <TextField
              label="Color"
              value={form.color}
              onChange={handleField('color')}
              required
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box
                        component="input"
                        type="color"
                        value={form.color}
                        onChange={handleField('color')}
                        sx={{ width: 28, height: 28, border: 'none', p: 0, cursor: 'pointer', bgcolor: 'transparent' }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete team"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
