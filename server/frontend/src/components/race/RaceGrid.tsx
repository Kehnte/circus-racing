// RaceGrid — Live race DataGrid with per-pilot controls (DNF available in all tracking modes).

import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams, GridRowParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import RemoveOutlined from '@mui/icons-material/RemoveOutlined';
import useSWR from 'swr';
import { apiFetch, fetcher } from '../../api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import CrudToolbar from '../CrudToolbar.tsx';
import FlagIcon from '../FlagIcon.tsx';
import { NoRowsOverlay } from '../DataGridOverlays.tsx';
import NumberSpinner from '../NumberSpinner.tsx';
import type { OcrStatusMap, PilotRaceState, RaceStatePayload } from '../../types.ts';
import { useRaceStore } from '../../store/raceStore.ts';
import ChronoDisplay from './ChronoDisplay.tsx';

interface PendingEntryRow {
  _kind: 'pending';
  id: string;
  entryId: string;
  raceId: string;
  pilotId: string;
  displayName: string;
  country: string;
  teamSnapshot: { name: string; color: string; acronym: string } | null;
  vehicleSnapshot: { type: string; manufacturer: string; model: string } | null;
}

interface RaceEntryEnriched {
  id: string;
  raceId: string;
  pilotId: string;
  status: 'PENDING' | 'VALIDATED';
  gridPosition: number | null;
  teamSnapshot: Record<string, unknown> | null;
  vehicleSnapshot: Record<string, unknown> | null;
  controlsSnapshot: Record<string, unknown> | null;
  pilot: { id: string; displayName: string; country: string } | null;
}

type GridRow = (PilotRaceState & { _kind: 'validated' }) | PendingEntryRow;

interface Props {
  raceState: RaceStatePayload;
}


function ocrTooltip(entry: OcrStatusMap[string] | undefined): string {
  if (!entry || !entry.lastPositionAt) return 'No position received';
  const ago = Math.round((Date.now() - new Date(entry.lastPositionAt).getTime()) / 1000);
  return `Last position: ${ago}s ago`;
}

export default function RaceGrid({ raceState }: Props) {
  const { raceId, pilots, trackingMode, status, teamDisplayMode, timingEnabled } = raceState;
  const ocrStatusMap = useRaceStore((s) => s.ocrStatusMap);
  const isManual = trackingMode === 'manual';
  const canAct = status === 'STARTED';
  // Pos and DNF editable before and during the race, locked when finished
  const canEditGrid = status === 'PENDING' || status === 'STARTED';
  // Remove only allowed before the race starts
  const canRemove = status === 'PENDING';

  const { role } = useAuth();
  const notifications = useNotifications();
  const canDelete = role === 'ADMIN' || role === 'MODERATOR';

  const { data: entriesData, mutate: mutateEntries } = useSWR<RaceEntryEnriched[]>(
    canDelete ? `/api/races/${raceId}/entries` : null,
    fetcher,
  );

  const pendingRows: PendingEntryRow[] = (entriesData ?? [])
    .filter((e) => e.status === 'PENDING')
    .map((e) => ({
      _kind: 'pending' as const,
      id: e.id,
      entryId: e.id,
      raceId: e.raceId,
      pilotId: e.pilotId,
      displayName: e.pilot?.displayName ?? '(unknown)',
      country: e.pilot?.country ?? 'un',
      teamSnapshot: e.teamSnapshot as PendingEntryRow['teamSnapshot'],
      vehicleSnapshot: e.vehicleSnapshot as PendingEntryRow['vehicleSnapshot'],
    }));

  const validatedRows = pilots.map((p) => ({ ...p, _kind: 'validated' as const }));
  const rows: GridRow[] = [...validatedRows, ...pendingRows];

  async function handleRemovePilot(pilot: PilotRaceState) {
    try {
      await apiFetch(`/api/races/${raceId}/entries/${pilot.entryId}`, { method: 'DELETE' });
      notifications.show('Pilot removed.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show(`Remove failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  async function handleApprovePending(row: PendingEntryRow) {
    try {
      await apiFetch(`/api/races/${raceId}/entries/${row.id}/validate`, { method: 'PATCH' });
      notifications.show('Entry approved.', { severity: 'success', autoHideDuration: 3000 });
      void mutateEntries();
    } catch (err) {
      notifications.show(`Approve failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  async function handleRejectPending(row: PendingEntryRow) {
    try {
      await apiFetch(`/api/races/${raceId}/entries/${row.id}`, { method: 'DELETE' });
      notifications.show('Entry rejected.', { severity: 'success', autoHideDuration: 3000 });
      void mutateEntries();
    } catch (err) {
      notifications.show(`Reject failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  async function changeLap(pilotId: string, delta: 1 | -1) {
    await apiFetch(`/api/race-events/races/${raceId}/manual-lap`, {
      method: 'POST',
      body: JSON.stringify({ pilotId, delta }),
    });
  }

  async function reorder(pilotId: string, direction: 'up' | 'down') {
    await apiFetch(`/api/race-events/races/${raceId}/manual-reorder`, {
      method: 'POST',
      body: JSON.stringify({ pilotId, direction }),
    });
  }

  async function setPosition(pilotId: string, position: number) {
    await apiFetch(`/api/race-events/races/${raceId}/manual-position`, {
      method: 'POST',
      body: JSON.stringify({ pilotId, position }),
    });
  }

  // Returns the allowed [min, max] position range for a pilot based on lap counts.
  // Cannot move above a pilot with more laps, nor below a pilot with fewer laps.
  function positionRange(pilot: PilotRaceState): { min: number; max: number } {
    const activePilots = pilots.filter(p => p.status !== 'DNF' && p.status !== 'FINISHED');
    let min = 1;
    let max = activePilots.length || pilots.length;
    for (const p of pilots) {
      if (p.id === pilot.id) continue;
      if (p.lap > pilot.lap && p.position >= min) min = p.position + 1;
      if (p.lap < pilot.lap && p.position <= max) max = p.position - 1;
    }
    return { min: Math.max(1, min), max: Math.min(pilots.length, max) };
  }

  async function toggleDnf(pilotId: string) {
    await apiFetch(`/api/race-events/races/${raceId}/manual-dnf`, {
      method: 'POST',
      body: JSON.stringify({ pilotId }),
    });
  }

  const columns: GridColDef<GridRow>[] = [
    {
      field: 'position',
      headerName: 'Pos',
      minWidth: 60,
      renderCell: (params: GridRenderCellParams<GridRow, number>) => {
        if (params.row._kind === 'pending') return null;
        return (
          <Typography component="span" variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: 13, fontWeight: 700 }}>
            {params.value}
          </Typography>
        );
      },
    },
    {
      field: 'country',
      headerName: 'Country',
      minWidth: 60,
      sortable: false,
      renderCell: (params: GridRenderCellParams<GridRow>) => (
        <FlagIcon code={params.row.country} size={18} />
      ),
    },
    {
      field: 'displayName',
      headerName: 'Name',
      flex: 1,
      renderCell: (params: GridRenderCellParams<GridRow>) => (
        <Typography component="span" variant="body2">{params.row.displayName}</Typography>
      ),
    },
    ...(teamDisplayMode !== 'hidden'
      ? [{
          field: 'teamSnapshot' as const,
          headerName: 'Team',
          minWidth: 60,
          renderCell: (params: GridRenderCellParams<GridRow>) => {
            const t = params.row.teamSnapshot;
            if (!t) return <Typography color="text.disabled">—</Typography>;
            return (
              <Typography component="span" variant="body2" sx={{ color: t.color, fontWeight: 700 }}>
                {t.acronym}
              </Typography>
            );
          },
        }]
      : []),
    {
      field: 'lap',
      headerName: 'Laps',
      minWidth: 60,
      renderCell: (params: GridRenderCellParams<GridRow>) => {
        if (params.row._kind === 'pending') return null;
        const s = params.row.status;
        if (s === 'FINISHED') return <Chip label="Finished" color="success" size="small" />;
        if (s === 'DNF') return <Chip label="DNF" color="error" size="small" />;
        return (
          <Typography component="span" variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: 13 }}>
            {params.row.lap}
          </Typography>
        );
      },
    },
    ...(timingEnabled
      ? [{
          field: 'chrono' as const,
          headerName: 'Chrono',
          minWidth: 150,
          sortable: false,
          renderCell: (params: GridRenderCellParams<GridRow>) => {
            if (params.row._kind === 'pending') return null;
            return <ChronoDisplay pilot={params.row} raceState={raceState} />;
          },
        }]
      : []),
    ...(isManual
      ? [
          {
            field: 'ctrlLaps' as const,
            headerName: 'Laps controls',
            minWidth: 60,
            sortable: false,
            renderCell: (params: GridRenderCellParams<GridRow>) => {
              if (params.row._kind === 'pending') return null;
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <IconButton size="small" disabled={!canAct} onClick={() => void changeLap(params.row.id, -1)}>
                    <RemoveOutlined fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={!canAct} onClick={() => void changeLap(params.row.id, 1)}>
                    <AddOutlined fontSize="small" />
                  </IconButton>
                </Box>
              );
            },
          },
          {
            field: 'ctrlPos' as const,
            headerName: 'Pos controls',
            minWidth: 180,
            sortable: false,
            renderCell: (params: GridRenderCellParams<GridRow>) => {
              if (params.row._kind === 'pending') return null;
              const { min, max } = positionRange(params.row);
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
                  <IconButton size="small" disabled={!canEditGrid} onClick={() => void reorder(params.row.id, 'up')}>
                    <ArrowUpwardOutlined fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={!canEditGrid} onClick={() => void reorder(params.row.id, 'down')}>
                    <ArrowDownwardOutlined fontSize="small" />
                  </IconButton>
                  <NumberSpinner
                    size="small"
                    value={params.row.position}
                    min={min}
                    max={max}
                    disabled={!canEditGrid}
                    onCommit={(v) => { const row = params.row as PilotRaceState; if (v !== row.position) void setPosition(row.id, v); }}
                  />
                </Box>
              );
            },
          },
        ]
      : []),
    ...(!isManual
      ? [{
          field: 'ocrStatus' as const,
          headerName: 'OCR',
          minWidth: 70,
          sortable: false,
          renderCell: (params: GridRenderCellParams<GridRow>) => {
            if (params.row._kind === 'pending') return null;
            const s = params.row.status;
            if (s === 'FINISHED' || s === 'DNF') return null;
            const entry = ocrStatusMap[params.row.id];
            const ocrStatus = entry?.status ?? 'offline';
            const color = ocrStatus === 'active' ? 'success' : ocrStatus === 'stale' ? 'warning' : 'error';
            return (
              <Tooltip title={ocrTooltip(entry)}>
                <Chip label="OCR" color={color} size="small" variant="outlined" />
              </Tooltip>
            );
          },
        }]
      : []),
    {
      field: 'ctrlDnf' as const,
      headerName: 'DNF',
      minWidth: 60,
      sortable: false,
      renderCell: (params: GridRenderCellParams<GridRow>) => {
        if (params.row._kind === 'pending') return null;
        const isDnf = params.row.status === 'DNF';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Button
              size="small"
              variant={isDnf ? 'contained' : 'outlined'}
              color={isDnf ? 'error' : 'inherit'}
              disabled={!canEditGrid || params.row.status === 'FINISHED'}
              onClick={() => void toggleDnf(params.row.id)}
            >
              DNF
            </Button>
          </Box>
        );
      },
    },
    {
      field: 'delete',
      type: 'actions' as const,
      headerName: 'Actions',
      headerAlign: 'left' as const,
      align: 'left' as const,
      minWidth: 120,
      getActions: (params: GridRowParams<GridRow>) => {
        if (!canDelete) return [];
        if (params.row._kind === 'pending') {
          return [
            <GridActionsCellItem
              key="remove"
              icon={<DeleteOutlined />}
              label="Remove"
              disabled
              showInMenu={false}
            />,
            <GridActionsCellItem
              key="approve"
              icon={<CheckOutlined />}
              label="Approve"
              onClick={() => void handleApprovePending(params.row as PendingEntryRow)}
              showInMenu={false}
            />,
            <GridActionsCellItem
              key="reject"
              icon={<CloseOutlined />}
              label="Reject"
              onClick={() => void handleRejectPending(params.row as PendingEntryRow)}
              showInMenu={false}
            />,
          ];
        }
        return [
          <GridActionsCellItem
            key="remove"
            icon={<DeleteOutlined />}
            label="Remove"
            onClick={() => void handleRemovePilot(params.row as PilotRaceState)}
            showInMenu={false}
            disabled={!canRemove}
          />,
        ];
      },
    },
  ];

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      pageSizeOptions={[25, 50]}
      disableColumnResize
      disableRowSelectionOnClick
      getRowId={(row) => row.id}
      density="compact"
      slots={{ toolbar: CrudToolbar, noRowsOverlay: NoRowsOverlay }}
      getRowClassName={(params) => (params.row as GridRow)._kind === 'pending' ? 'row-pending' : ''}
      sx={{
        flex: 1,
        '& .row-pending': { opacity: 0.5, fontStyle: 'italic' },
        '& .row-pending:hover': { opacity: 0.7 },
      }}
    />
  );
}
