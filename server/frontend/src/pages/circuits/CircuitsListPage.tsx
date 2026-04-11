// CircuitsListPage — DataGrid with URL-persisted state and delete via dialog.

import { useState } from 'react';
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
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import { apiFetch, fetcher } from '../../api.ts';
import PageContainer from '../../components/PageContainer.tsx';
import CrudToolbar from '../../components/CrudToolbar.tsx';
import useDialogs from '../../hooks/useDialogs/useDialogs.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import type { Checkpoint, Racetrack } from '../../types.ts';

function syncParam(params: URLSearchParams, key: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null) next.delete(key);
  else next.set(key, value);
  return next;
}

export default function CircuitsListPage() {
  const navigate = useNavigate();
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const { data, mutate } = useSWR<Racetrack[]>('/api/racetracks', fetcher);

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

  async function handleDelete(circuit: Racetrack) {
    const confirmed = await dialogs.confirm(
      `Delete "${circuit.name}"? This cannot be undone.`,
      { title: 'Delete circuit', confirmLabel: 'delete', confirmColor: 'error' }
    );
    if (!confirmed) return;
    try {
      await apiFetch(`/api/racetracks/${circuit.id}`, { method: 'DELETE' });
      await mutate();
      notifications.show('Circuit deleted.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show(`Delete failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  const columns: (GridColDef<Racetrack> | GridActionsColDef<Racetrack>)[] = [
    { field: 'name', headerName: 'Name', flex: 2, minWidth: 120 },
    {
      field: 'checkpoints',
      headerName: 'Checkpoints',
      flex: 1,
      minWidth: 120,
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
      type: 'actions',
      headerAlign: 'left',
      align: 'left',
      headerName: 'Actions',
      minWidth: 120,
      getActions: (params: GridRowParams<Racetrack>) => [
        <GridActionsCellItem icon={<DeleteOutlined />} label="Delete" onClick={() => void handleDelete(params.row)} showInMenu={false} />,
      ],
    },
  ];

  return (
    <PageContainer
      title="Circuits"
      actions={
        <Button variant="contained" size="small" startIcon={<AddOutlined />} onClick={() => navigate('/circuits/new')}>
          add circuit
        </Button>
      }
    >
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
        sx={{ flex: 1 }}
      />
    </PageContainer>
  );
}
