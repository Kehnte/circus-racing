// OpenRacesGrid — DataGrid of open races with registration actions. Used in ProfilePage and standalone.

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import type { GridActionsColDef, GridColDef, GridFilterModel, GridPaginationModel, GridRenderCellParams, GridRowParams, GridSortModel } from '@mui/x-data-grid';
import Chip from '@mui/material/Chip';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import HowToRegOutlined from '@mui/icons-material/HowToRegOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import { apiFetch, fetcher } from '../api.ts';
import CrudToolbar from './CrudToolbar.tsx';
import { NoRowsOverlay } from './DataGridOverlays.tsx';
import useNotifications from '../hooks/useNotifications/useNotifications.tsx';

interface OpenRace { id: string; name: string; lapCount: number; trackingMode: string; sessionMode: string; session: string; startType: string; status: string; }
interface RaceEntry { id: string; status: 'PENDING' | 'VALIDATED'; }

export default function OpenRacesGrid() {
  const notifications = useNotifications();
  const { data: openRaces } = useSWR<OpenRace[]>('/api/races?status=PENDING,SCHEDULED', fetcher);

  const raceIds = (openRaces ?? []).map((r) => r.id).join(',');
  const { data: entriesData, mutate: mutateEntries } = useSWR<Record<string, RaceEntry | null>>(
    raceIds ? `/api/races/entries/me?ids=${raceIds}` : null,
    async () => {
      const results = await Promise.all(
        (openRaces ?? []).map((r) =>
          fetcher<RaceEntry>(`/api/races/${r.id}/entries/me`).catch(() => null)
        )
      );
      return Object.fromEntries((openRaces ?? []).map((r, i) => [r.id, results[i]]));
    },
  );
  const entries: Record<string, RaceEntry | null> = entriesData ?? {};

  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });

  const handleRegister = useCallback(async (race: OpenRace) => {
    setActing((prev) => ({ ...prev, [race.id]: true }));
    try {
      const entry = await apiFetch<RaceEntry>(`/api/races/${race.id}/entries`, { method: 'POST' });
      await mutateEntries((prev) => ({ ...prev, [race.id]: entry }), { revalidate: false });
      notifications.show('Registered! Awaiting admin validation.', { severity: 'success' });
    } catch (err) {
      notifications.show((err as Error).message, { severity: 'error' });
    } finally {
      setActing((prev) => ({ ...prev, [race.id]: false }));
    }
  }, [mutateEntries, notifications]);

  const handleCancel = useCallback(async (race: OpenRace) => {
    const entry = entries[race.id];
    if (!entry) return;
    setActing((prev) => ({ ...prev, [race.id]: true }));
    try {
      await apiFetch(`/api/races/${race.id}/entries/${entry.id}`, { method: 'DELETE' });
      await mutateEntries((prev) => ({ ...prev, [race.id]: null }), { revalidate: false });
      notifications.show('Registration cancelled.', { severity: 'success' });
    } catch (err) {
      notifications.show((err as Error).message, { severity: 'error' });
    } finally {
      setActing((prev) => ({ ...prev, [race.id]: false }));
    }
  }, [entries, mutateEntries, notifications]);

  const columns: (GridColDef<OpenRace> | GridActionsColDef<OpenRace>)[] = [
    { field: 'name', headerName: 'Race', flex: 1, minWidth: 120 },
    { field: 'session', headerName: 'Session', minWidth: 90 },
    { field: 'startType', headerName: 'Start type', minWidth: 120 },
    {
      field: 'sessionMode',
      headerName: 'Session mode',
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<OpenRace, string>) => params.value === 'laps' ? 'Laps' : 'Timed',
    },
    {
      field: 'trackingMode',
      headerName: 'Tracking',
      minWidth: 90,
      renderCell: (params: GridRenderCellParams<OpenRace, string>) => params.value === 'auto' ? 'Auto' : 'Manual',
    },
    {
      field: 'lapCount',
      headerName: 'Laps',
      minWidth: 90,
      renderCell: (params: GridRenderCellParams<OpenRace, number>) => `${params.value} laps`,
    },
    {
      field: 'entryStatus',
      headerName: 'Registration',
      minWidth: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams<OpenRace>) => {
        const entry = entries[params.row.id];
        if (entry?.status === 'PENDING') return <Chip label="Pending" size="small" />;
        if (entry?.status === 'VALIDATED') return <Chip label="Validated" color="success" size="small" />;
        if (!entry && params.row.status === 'PENDING') return <Chip label="Closed" size="small" color="error" />;
        if (!entry && params.row.status === 'SCHEDULED') return <Chip label="Open" size="small" color="primary" />;
        return null;
      },
    },
    {
      field: 'actions',
      type: 'actions',
      headerAlign: 'left',
      align: 'left',
      headerName: 'Actions',
      minWidth: 90,
      getActions: (params: GridRowParams<OpenRace>) => {
        const entry = entries[params.row.id];
        const busy = acting[params.row.id] ?? false;
        if (entry === undefined) return [];
        if (!entry) {
          return [
            <GridActionsCellItem icon={<HowToRegOutlined />} label="Register" disabled={busy || params.row.status !== 'SCHEDULED'} onClick={() => void handleRegister(params.row)} showInMenu={false} />,
          ];
        }
        if (entry.status === 'VALIDATED') {
          return [
            <GridActionsCellItem icon={<LogoutOutlined />} label="Leave" disabled={busy} onClick={() => void handleCancel(params.row)} showInMenu={false} />,
          ];
        }
        return [
          <GridActionsCellItem icon={<CancelOutlined />} label="Cancel" disabled={busy} onClick={() => void handleCancel(params.row)} showInMenu={false} />,
        ];
      },
    },
  ];

  return (
    <DataGrid
      rows={openRaces ?? []}
      columns={columns}
      loading={!openRaces}
      pageSizeOptions={[25, 50]}
      paginationModel={pagination}
      onPaginationModelChange={setPagination}
      sortModel={sortModel}
      onSortModelChange={setSortModel}
      filterModel={filterModel}
      onFilterModelChange={setFilterModel}
      density="compact"
      disableColumnResize
      disableRowSelectionOnClick
      slots={{ toolbar: CrudToolbar, noRowsOverlay: NoRowsOverlay }}
      slotProps={{ toolbar: { standaloneKey: 'races' } }}
      autoHeight
    />
  );
}
