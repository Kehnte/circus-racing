// PilotsPage — CRUD for pilots with FK dropdowns (ADMIN for create/delete, MODERATOR+ for edit).

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
import Autocomplete from '@mui/material/Autocomplete';
import { apiFetch, fetcher } from '../api.ts';
import ConfirmDialog from '../components/ConfirmDialog.tsx';
import CrudToolbar from '../components/CrudToolbar.tsx';
import FlagIcon from '../components/FlagIcon.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import type { Controls, Pilot, Team, Vehicle } from '../types.ts';
import { COUNTRIES, findCountry, resolveCountryCode } from '../utils/countries.ts';
import type { Country } from '../utils/countries.ts';

const ROLES = ['ADMIN', 'MODERATOR', 'PILOT'];

interface PilotCreateForm {
  displayName: string;
  country: string;
  teamId: string;
  vehicleId: string;
  controlsId: string;
}

interface PilotEditForm extends PilotCreateForm {
  role: string;
}

const EMPTY_CREATE: PilotCreateForm = {
  displayName: '', country: 'un', teamId: '', vehicleId: '', controlsId: '',
};

function roleChipColor(role: string): 'primary' | 'warning' | 'default' {
  if (role === 'ADMIN') return 'primary';
  if (role === 'MODERATOR') return 'warning';
  return 'default';
}

export default function PilotsPage() {
  const { role: authRole } = useAuth();
  const canCreate = authRole === 'ADMIN';
  const canEdit = authRole === 'ADMIN' || authRole === 'MODERATOR';
  const canDelete = authRole === 'ADMIN';

  const { data: pilots, mutate } = useSWR<Pilot[]>('/api/pilots', fetcher);
  const { data: teams } = useSWR<Team[]>('/api/teams', fetcher);
  const { data: vehicles } = useSWR<Vehicle[]>('/api/vehicles', fetcher);
  const { data: controls } = useSWR<Controls[]>('/api/controls', fetcher);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<PilotCreateForm>(EMPTY_CREATE);
  const [editTarget, setEditTarget] = useState<Pilot | null>(null);
  const [editForm, setEditForm] = useState<PilotEditForm>({ ...EMPTY_CREATE, role: 'PILOT' });
  const [deleteTarget, setDeleteTarget] = useState<Pilot | null>(null);

  function openCreate() {
    setCreateForm(EMPTY_CREATE);
    setCreateOpen(true);
  }

  function openEdit(p: Pilot) {
    setEditTarget(p);
    setEditForm({
      displayName: p.displayName,
      country: p.country,
      teamId: p.teamId ?? '',
      vehicleId: p.vehicleId ?? '',
      controlsId: p.controlsId ?? '',
      role: p.role,
    });
  }

  function handleCreateField(field: keyof PilotCreateForm) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setCreateForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleEditField(field: keyof PilotEditForm) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setEditForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const payload = {
      displayName: createForm.displayName,
      country: createForm.country || 'un',
      teamId: createForm.teamId || undefined,
      vehicleId: createForm.vehicleId || undefined,
      controlsId: createForm.controlsId || undefined,
    };
    await apiFetch('/api/pilots', { method: 'POST', body: JSON.stringify(payload) });
    await mutate();
    setCreateOpen(false);
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    const payload = {
      displayName: editForm.displayName,
      country: editForm.country || 'un',
      teamId: editForm.teamId || null,
      vehicleId: editForm.vehicleId || null,
      controlsId: editForm.controlsId || null,
      role: editForm.role,
    };
    await apiFetch(`/api/pilots/${editTarget.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    await mutate();
    setEditTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/api/pilots/${deleteTarget.id}`, { method: 'DELETE' });
    await mutate();
    setDeleteTarget(null);
  }

  // Build lookup maps for FK display.
  const teamById = Object.fromEntries((teams ?? []).map((t) => [t.id, t]));
  const vehicleById = Object.fromEntries((vehicles ?? []).map((v) => [v.id, v]));
  const controlsById = Object.fromEntries((controls ?? []).map((c) => [c.id, c]));

  const columns: GridColDef<Pilot>[] = [
    { field: 'displayName', headerName: 'Display Name', flex: 2, minWidth: 120 },
    {
      field: 'country',
      headerName: 'Country',
      minWidth: 56,
      renderCell: (params: GridRenderCellParams<Pilot, string>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <FlagIcon code={params.value ?? 'un'} size={20} />
        </Box>
      ),
    },
    {
      field: 'role',
      headerName: 'Role',
      flex: 1,
      minWidth: 90,
      renderCell: (params: GridRenderCellParams<Pilot, string>) => (
        <Chip
          label={params.value}
          color={roleChipColor(params.value ?? '')}
          size="small"
          variant="filled"
        />
      ),
    },
    {
      field: 'teamId',
      headerName: 'Team',
      flex: 1,
      minWidth: 90,
      renderCell: (params: GridRenderCellParams<Pilot, string | null>) => {
        const team = params.value ? teamById[params.value] : null;
        if (!team) return <Typography color="text.disabled">—</Typography>;
        return (
          <Typography variant="body2" sx={{ color: team.color, fontWeight: 700 }}>
            {team.acronym}
          </Typography>
        );
      },
    },
    {
      field: 'vehicleId',
      headerName: 'Vehicle',
      flex: 1,
      minWidth: 130,
      renderCell: (params: GridRenderCellParams<Pilot, string | null>) => {
        const v = params.value ? vehicleById[params.value] : null;
        if (!v) return <Typography color="text.disabled">—</Typography>;
        const typeLabel = v.type.charAt(0).toUpperCase() + v.type.slice(1);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
            <Chip label={typeLabel} size="small" />
            <Typography variant="body2">{v.model}</Typography>
          </Box>
        );
      },
    },
    {
      field: 'controlsId',
      headerName: 'Controls',
      flex: 1,
      minWidth: 100,
      renderCell: (params: GridRenderCellParams<Pilot, string | null>) => {
        const c = params.value ? controlsById[params.value] : null;
        return <Typography variant="body2">{c ? c.type : '—'}</Typography>;
      },
    },
    {
      field: 'actions',
      headerName: '',
      minWidth: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Pilot>) => (
        <>
          {canEdit && (
            <IconButton size="small" onClick={() => openEdit(params.row)}>
              <EditOutlined fontSize="small" />
            </IconButton>
          )}
          {canDelete && (
            <IconButton size="small" onClick={() => setDeleteTarget(params.row)}>
              <DeleteOutlined fontSize="small" />
            </IconButton>
          )}
        </>
      ),
    },
  ];

  // Country Autocomplete — accepts code ("gb") or full name ("United Kingdom").
  function CountrySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
    return (
      <Autocomplete<Country, false, false, true>
        options={COUNTRIES}
        freeSolo
        value={findCountry(value) ?? null}
        getOptionLabel={(o) => typeof o === 'string' ? o : o.name}
        filterOptions={(opts, { inputValue }) => {
          const q = inputValue.toLowerCase();
          return opts.filter(
            (o) => o.code.startsWith(q) || o.name.toLowerCase().includes(q)
          );
        }}
        onChange={(_, v) => {
          if (!v) { onChange('un'); return; }
          if (typeof v === 'string') { onChange(resolveCountryCode(v)); return; }
          onChange(v.code);
        }}
        renderOption={(props, o) => (
          <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <FlagIcon code={o.code} size={18} />
            <span>{o.name}</span>
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Country"
            slotProps={{
              input: {
                ...params.InputProps,
                startAdornment: value && value !== 'un'
                  ? <Box sx={{ mr: 0.5, display: 'flex', alignItems: 'center' }}><FlagIcon code={value} size={16} /></Box>
                  : null,
              },
            }}
          />
        )}
      />
    );
  }

  // Shared FK select fields used in both create and edit dialogs.
  function FkSelects({
    teamId, vehicleId, controlsId, onTeam, onVehicle, onControls,
  }: {
    teamId: string; vehicleId: string; controlsId: string;
    onTeam: (e: ChangeEvent<HTMLInputElement>) => void;
    onVehicle: (e: ChangeEvent<HTMLInputElement>) => void;
    onControls: (e: ChangeEvent<HTMLInputElement>) => void;
  }) {
    return (
      <>
        <TextField select label="Team" value={teamId} onChange={onTeam} fullWidth>
          <MenuItem value="">none</MenuItem>
          {(teams ?? []).map((t) => (
            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
          ))}
        </TextField>
        <TextField select label="Vehicle" value={vehicleId} onChange={onVehicle} fullWidth>
          <MenuItem value="">none</MenuItem>
          {(vehicles ?? []).map((v) => (
            <MenuItem key={v.id} value={v.id}>
              {v.type.charAt(0).toUpperCase() + v.type.slice(1)} — {v.model}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Controls" value={controlsId} onChange={onControls} fullWidth>
          <MenuItem value="">none</MenuItem>
          {(controls ?? []).map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.type}</MenuItem>
          ))}
        </TextField>
      </>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="overline">Pilots</Typography>
        {canCreate && (
          <Button variant="contained" size="small" startIcon={<AddOutlined />} onClick={openCreate}>
            add pilot
          </Button>
        )}
      </Stack>

      <DataGrid
        rows={pilots ?? []}
        columns={columns}
        density="compact"
        pageSizeOptions={[25, 50]}
        disableRowSelectionOnClick
        slots={{ toolbar: CrudToolbar }}
        sx={{ flex: 1 }}
      />

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add pilot</DialogTitle>
        <Box component="form" onSubmit={(e: FormEvent) => void handleCreate(e)}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Display name"
              value={createForm.displayName}
              onChange={handleCreateField('displayName')}
              required
              fullWidth
            />
            <CountrySelect
              value={createForm.country}
              onChange={(code) => setCreateForm((f) => ({ ...f, country: code }))}
            />
            <FkSelects
              teamId={createForm.teamId}
              vehicleId={createForm.vehicleId}
              controlsId={createForm.controlsId}
              onTeam={handleCreateField('teamId')}
              onVehicle={handleCreateField('vehicleId')}
              onControls={handleCreateField('controlsId')}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Edit pilot</DialogTitle>
        <Box component="form" onSubmit={(e: FormEvent) => void handleEdit(e)}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Display name"
              value={editForm.displayName}
              onChange={handleEditField('displayName')}
              required
              fullWidth
            />
            <CountrySelect
              value={editForm.country}
              onChange={(code) => setEditForm((f) => ({ ...f, country: code }))}
            />
            <TextField select label="Role" value={editForm.role} onChange={handleEditField('role')} fullWidth>
              {ROLES.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
            <FkSelects
              teamId={editForm.teamId}
              vehicleId={editForm.vehicleId}
              controlsId={editForm.controlsId}
              onTeam={handleEditField('teamId')}
              onVehicle={handleEditField('vehicleId')}
              onControls={handleEditField('controlsId')}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete pilot"
        description={`Delete "${deleteTarget?.displayName}"? This cannot be undone.`}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
