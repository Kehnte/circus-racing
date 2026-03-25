// PilotsListPage — DataGrid with URL-persisted state, navigate to show/create/edit, delete via dialog.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import { NoRowsOverlay } from '../../components/DataGridOverlays.tsx';
import type { GridActionsColDef, GridColDef, GridFilterModel, GridPaginationModel, GridRenderCellParams, GridRowParams, GridSortModel } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { apiFetch, fetcher } from '../../api.ts';
import PageContainer from '../../components/PageContainer.tsx';
import CrudToolbar from '../../components/CrudToolbar.tsx';
import FlagIcon from '../../components/FlagIcon.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import useDialogs from '../../hooks/useDialogs/useDialogs.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import type { Controls, Pilot, Team, Vehicle } from '../../types.ts';

function roleChipColor(role: string): 'primary' | 'warning' | 'default' {
  if (role === 'ADMIN') return 'primary';
  if (role === 'MODERATOR') return 'warning';
  return 'default';
}

function syncParam(params: URLSearchParams, key: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null) next.delete(key);
  else next.set(key, value);
  return next;
}

export default function PilotsListPage() {
  const navigate = useNavigate();
  const { role: authRole } = useAuth();
  const dialogs = useDialogs();
  const notifications = useNotifications();

  const canCreate = authRole === 'ADMIN';
  const canEdit = authRole === 'ADMIN' || authRole === 'MODERATOR';
  const canDelete = authRole === 'ADMIN';

  const { data: pilots, mutate } = useSWR<Pilot[]>('/api/pilots', fetcher);
  const { data: teams } = useSWR<Team[]>('/api/teams', fetcher);
  const { data: vehicles } = useSWR<Vehicle[]>('/api/vehicles', fetcher);
  const { data: controls } = useSWR<Controls[]>('/api/controls', fetcher);

  const [searchParams, setSearchParams] = useSearchParams();
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: Number(searchParams.get('page') ?? 0),
    pageSize: Number(searchParams.get('pageSize') ?? 25),
  });
  const [sortModel, setSortModel] = useState<GridSortModel>(
    searchParams.get('sort') ? (JSON.parse(searchParams.get('sort')!) as GridSortModel) : []
  );
  const [filterModel, setFilterModel] = useState<GridFilterModel>(
    searchParams.get('filter') ? (JSON.parse(searchParams.get('filter')!) as GridFilterModel) : { items: [] }
  );

  function handlePaginationChange(model: GridPaginationModel) {
    setPaginationModel(model);
    setSearchParams(syncParam(syncParam(searchParams, 'page', String(model.page)), 'pageSize', String(model.pageSize)), { replace: true });
  }
  function handleSortChange(model: GridSortModel) {
    setSortModel(model);
    setSearchParams(syncParam(searchParams, 'sort', model.length ? JSON.stringify(model) : null), { replace: true });
  }
  function handleFilterChange(model: GridFilterModel) {
    setFilterModel(model);
    setSearchParams(syncParam(searchParams, 'filter', model.items.length ? JSON.stringify(model) : null), { replace: true });
  }

  async function handleDelete(pilot: Pilot) {
    const confirmed = await dialogs.confirm(
      `Delete "${pilot.displayName}"? This cannot be undone.`,
      { title: 'Delete pilot', confirmLabel: 'delete', confirmColor: 'error' }
    );
    if (!confirmed) return;
    try {
      await apiFetch(`/api/pilots/${pilot.id}`, { method: 'DELETE' });
      await mutate();
      notifications.show('Pilot deleted.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show(`Delete failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  const teamById = Object.fromEntries((teams ?? []).map((t) => [t.id, t]));
  const vehicleById = Object.fromEntries((vehicles ?? []).map((v) => [v.id, v]));
  const controlsById = Object.fromEntries((controls ?? []).map((c) => [c.id, c]));

  const columns: (GridColDef<Pilot> | GridActionsColDef<Pilot>)[] = [
    { field: 'displayName', headerName: 'Name', flex: 2, minWidth: 120 },
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
        <Chip label={params.value ? params.value.charAt(0) + params.value.slice(1).toLowerCase() : ''} color={roleChipColor(params.value ?? '')} size="small" />
      ),
    },
    {
      field: 'teamId',
      headerName: 'Team',
      flex: 1,
      minWidth: 90,
      renderCell: (params: GridRenderCellParams<Pilot, string | null>) => {
        const team = params.value ? teamById[params.value] : null;
        if (!team) return <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', color: 'text.disabled' }}>—</Box>;
        return <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}><Typography variant="body2" sx={{ color: team.color, fontWeight: 700 }}>{team.acronym}</Typography></Box>;
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
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
            <Chip label={v.type.charAt(0).toUpperCase() + v.type.slice(1)} size="small" />
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
        return <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}><Typography variant="body2">{c ? c.type : '—'}</Typography></Box>;
      },
    },
    {
      field: 'actions',
      type: 'actions',
      headerAlign: 'left',
      align: 'left',
      headerName: 'Actions',
      minWidth: 120,
      getActions: (params: GridRowParams<Pilot>) => [
        ...(canEdit ? [<Tooltip title="Edit" placement="bottom"><GridActionsCellItem icon={<EditOutlined />} label="Edit" onClick={() => navigate(`/pilots/${params.row.id}/edit`)} showInMenu={false} /></Tooltip>] : []),
        ...(canDelete ? [<Tooltip title="Delete" placement="bottom"><GridActionsCellItem icon={<DeleteOutlined />} label="Delete" onClick={() => void handleDelete(params.row)} showInMenu={false} /></Tooltip>] : []),
      ],
    },
  ];

  return (
    <PageContainer
      title="Pilots"
      actions={
        canCreate ? (
          <Button variant="contained" size="small" startIcon={<AddOutlined />} onClick={() => navigate('/pilots/new')}>
            add pilot
          </Button>
        ) : undefined
      }
    >
      <DataGrid
        rows={pilots ?? []}
        columns={columns}

        pageSizeOptions={[25, 50]}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationChange}
        sortModel={sortModel}
        onSortModelChange={handleSortChange}
        filterModel={filterModel}
        onFilterModelChange={handleFilterChange}
        disableRowSelectionOnClick
        slots={{ toolbar: CrudToolbar, noRowsOverlay: NoRowsOverlay }}
        sx={{ flex: 1 }}
      />
    </PageContainer>
  );
}
