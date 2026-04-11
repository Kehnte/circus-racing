// TeamsListPage — DataGrid with URL-persisted state and delete via dialog.

import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import { NoRowsOverlay } from '../../components/DataGridOverlays.tsx';
import type { GridActionsColDef, GridColDef, GridFilterModel, GridPaginationModel, GridRenderCellParams, GridRowParams, GridSortModel } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { apiFetch, fetcher } from '../../api.ts';
import PageContainer from '../../components/PageContainer.tsx';
import CrudToolbar from '../../components/CrudToolbar.tsx';
import { useStandalone } from '../../context/StandaloneContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import useDialogs from '../../hooks/useDialogs/useDialogs.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import type { Team } from '../../types.ts';

function syncParam(params: URLSearchParams, key: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null) next.delete(key);
  else next.set(key, value);
  return next;
}

export default function TeamsListPage() {
  const navigate = useNavigate();
  const standalone = useStandalone();
  const { role: authRole } = useAuth();
  const isAdmin = authRole === 'ADMIN';
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const { data, mutate } = useSWR<Team[]>('/api/teams', fetcher);

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

  async function handleDeleteAll() {
    const confirmed = await dialogs.confirm(
      'Delete all teams? This cannot be undone.',
      { title: 'Delete all teams', confirmLabel: 'delete all', confirmColor: 'error' }
    );
    if (!confirmed) return;
    try {
      await apiFetch('/api/teams', { method: 'DELETE' });
      await mutate();
      notifications.show('All teams deleted.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show(`Delete failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  const importFileRef = useRef<HTMLInputElement>(null);

  async function handleImportJson() {
    const file = importFileRef.current?.files?.[0];
    if (!file) return;
    importFileRef.current!.value = '';
    try {
      const json = JSON.parse(await file.text());
      const result = await apiFetch<{ created: number; skipped: string[] }>('/api/teams/bulk', {
        method: 'POST',
        body: JSON.stringify(Array.isArray(json) ? json : [json]),
      });
      await mutate();
      const msg = `Imported ${result.created} team(s)` + (result.skipped.length ? `, skipped: ${result.skipped.join(', ')}` : '');
      notifications.show(msg, { severity: result.created > 0 ? 'success' : 'warning', autoHideDuration: 5000 });
    } catch (err) {
      notifications.show(`Import failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  async function handleDelete(team: Team) {
    const confirmed = await dialogs.confirm(
      `Delete "${team.name}"? This cannot be undone.`,
      { title: 'Delete team', confirmLabel: 'delete', confirmColor: 'error' }
    );
    if (!confirmed) return;
    try {
      await apiFetch(`/api/teams/${team.id}`, { method: 'DELETE' });
      await mutate();
      notifications.show('Team deleted.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show(`Delete failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  const columns: (GridColDef<Team> | GridActionsColDef<Team>)[] = [
    { field: 'name', headerName: 'Name', flex: 2, minWidth: 120 },
    { field: 'acronym', headerName: 'Acronym', minWidth: 60 },
    {
      field: 'color',
      headerName: 'Color',
      minWidth: 60,
      renderCell: (params: GridRenderCellParams<Team, string>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
          <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: params.value, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: 12 }}>{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerAlign: 'left',
      align: 'left',
      headerName: 'Actions',
      minWidth: 120,
      getActions: (params: GridRowParams<Team>) => [
        <GridActionsCellItem icon={<EditOutlined />} label="Edit" onClick={() => navigate(`/teams/${params.row.id}/edit`)} showInMenu={false} />,
        <GridActionsCellItem icon={<DeleteOutlined />} label="Delete" onClick={() => void handleDelete(params.row)} showInMenu={false} />,
      ],
    },
  ];

  return (
    <PageContainer
      title="Teams"
      actions={
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isAdmin && (
            <Button variant="outlined" size="small" color="error" startIcon={<DeleteSweepOutlined />} onClick={() => void handleDeleteAll()}>
              delete all
            </Button>
          )}
          <Button variant="contained" size="small" startIcon={<AddOutlined />} onClick={() => navigate('/teams/new')}>
            add team
          </Button>
        </Box>
      }
    >
      <input
        ref={importFileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={() => void handleImportJson()}
      />
      <DataGrid
        rows={data ?? []}
        columns={columns}

        pageSizeOptions={[25, 50]}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationChange}
        sortModel={sortModel}
        onSortModelChange={handleSortChange}
        filterModel={filterModel}
        onFilterModelChange={handleFilterChange}
        disableColumnResize
        disableRowSelectionOnClick
        slots={{ toolbar: CrudToolbar, noRowsOverlay: NoRowsOverlay }}
        slotProps={{ toolbar: { onImportJson: () => importFileRef.current?.click() } }}
        autoHeight={standalone}
        sx={standalone ? {} : { flex: 1 }}
      />
    </PageContainer>
  );
}
