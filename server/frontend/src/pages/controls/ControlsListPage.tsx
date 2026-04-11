// ControlsListPage — DataGrid with URL-persisted state and delete via dialog.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import { NoRowsOverlay } from '../../components/DataGridOverlays.tsx';
import type { GridActionsColDef, GridColDef, GridFilterModel, GridPaginationModel, GridRenderCellParams, GridRowParams, GridSortModel } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { apiFetch, fetcher } from '../../api.ts';
import PageContainer from '../../components/PageContainer.tsx';
import CrudToolbar from '../../components/CrudToolbar.tsx';
import { useStandalone } from '../../context/StandaloneContext.tsx';
import useDialogs from '../../hooks/useDialogs/useDialogs.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import type { Controls } from '../../types.ts';

function syncParam(params: URLSearchParams, key: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null) next.delete(key);
  else next.set(key, value);
  return next;
}

export default function ControlsListPage() {
  const navigate = useNavigate();
  const standalone = useStandalone();
  const dialogs = useDialogs();
  const notifications = useNotifications();
  const { data, mutate } = useSWR<Controls[]>('/api/controls', fetcher);

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

  async function handleDelete(ctrl: Controls) {
    const confirmed = await dialogs.confirm(
      `Delete "${ctrl.type}"? This cannot be undone.`,
      { title: 'Delete controls', confirmLabel: 'delete', confirmColor: 'error' }
    );
    if (!confirmed) return;
    try {
      await apiFetch(`/api/controls/${ctrl.id}`, { method: 'DELETE' });
      await mutate();
      notifications.show('Controls deleted.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show(`Delete failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  const columns: (GridColDef<Controls> | GridActionsColDef<Controls>)[] = [
    {
      field: 'img',
      headerName: 'Image',
      minWidth: 60,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Controls, string | null>) =>
        params.value ? (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Box component="img" src={params.value} alt="" sx={{ width: 32, height: 32, objectFit: 'contain' }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', color: 'text.disabled' }}>—</Box>
        ),
    },
    { field: 'type', headerName: 'Type', flex: 1, minWidth: 60 },
    {
      field: 'actions',
      type: 'actions',
      headerAlign: 'left',
      align: 'left',
      headerName: 'Actions',
      minWidth: 120,
      getActions: (params: GridRowParams<Controls>) => [
        <GridActionsCellItem icon={<EditOutlined />} label="Edit" onClick={() => navigate(`/controls/${params.row.id}/edit`)} showInMenu={false} />,
        <GridActionsCellItem icon={<DeleteOutlined />} label="Delete" onClick={() => void handleDelete(params.row)} showInMenu={false} />,
      ],
    },
  ];

  return (
    <PageContainer
      title="Controls"
      actions={
        <Button variant="contained" size="small" startIcon={<AddOutlined />} onClick={() => navigate('/controls/new')}>
          add controls
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
        autoHeight={standalone}
        sx={standalone ? {} : { flex: 1 }}
      />
    </PageContainer>
  );
}

