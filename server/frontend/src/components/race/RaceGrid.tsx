// RaceGrid — Live race DataGrid with per-pilot controls in MANUAL mode.

import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams, GridRowParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import RemoveOutlined from '@mui/icons-material/RemoveOutlined';
import { apiFetch } from '../../api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import CrudToolbar from '../CrudToolbar.tsx';
import FlagIcon from '../FlagIcon.tsx';
import { NoRowsOverlay } from '../DataGridOverlays.tsx';
import NumberSpinner from '../NumberSpinner.tsx';
import type { PilotRaceState, RaceStatePayload } from '../../types.ts';
import ChronoDisplay from './ChronoDisplay.tsx';

interface Props {
  raceState: RaceStatePayload;
}


export default function RaceGrid({ raceState }: Props) {
  const { raceId, pilots, trackingMode, status, teamDisplayMode, timingEnabled } = raceState;
  const isManual = trackingMode === 'manual';
  const canAct = status === 'STARTED';
  // Pos and DNF editable before and during the race, locked when finished
  const canEditGrid = status === 'PENDING' || status === 'STARTED';
  // Remove only allowed before the race starts
  const canRemove = status === 'PENDING';

  const { role } = useAuth();
  const notifications = useNotifications();
  const canDelete = role === 'ADMIN' || role === 'MODERATOR';

  async function handleRemovePilot(pilot: PilotRaceState) {
    try {
      await apiFetch(`/api/races/${raceId}/entries/${pilot.entryId}`, { method: 'DELETE' });
      notifications.show('Pilot removed.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show(`Remove failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
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

  const columns: GridColDef<PilotRaceState>[] = [
    {
      field: 'position',
      headerName: 'Pos',
      minWidth: 60,
      renderCell: (params: GridRenderCellParams<PilotRaceState, number>) => (
        <Typography component="span" variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: 13, fontWeight: 700 }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'country',
      headerName: 'Country',
      minWidth: 60,
      sortable: false,
      renderCell: (params: GridRenderCellParams<PilotRaceState>) => (
        <FlagIcon code={params.row.country} size={18} />
      ),
    },
    {
      field: 'displayName',
      headerName: 'Name',
      flex: 1,
      renderCell: (params: GridRenderCellParams<PilotRaceState>) => (
        <Typography component="span" variant="body2">{params.row.displayName}</Typography>
      ),
    },
    ...(teamDisplayMode !== 'hidden'
      ? [{
          field: 'teamSnapshot' as const,
          headerName: 'Team',
          minWidth: 60,
          renderCell: (params: GridRenderCellParams<PilotRaceState>) => {
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
      renderCell: (params: GridRenderCellParams<PilotRaceState>) => {
        const s = params.row.status;
        if (s === 'FINISHED') return <Chip label="Finished" color="success" size="small" />;
        if (s === 'DNF') return <Chip label="DNF" color="error" size="small" />;
        return (
          <Typography component="span" variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: 13 }}>
            {params.value}
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
          renderCell: (params: GridRenderCellParams<PilotRaceState>) => (
            <ChronoDisplay pilot={params.row} raceState={raceState} />
          ),
        }]
      : []),
    ...(isManual
      ? [
          {
            field: 'ctrlLaps' as const,
            headerName: 'Laps controls',
            minWidth: 60,
            sortable: false,
            renderCell: (params: GridRenderCellParams<PilotRaceState>) => (
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <IconButton size="small" disabled={!canAct} onClick={() => void changeLap(params.row.id, -1)}>
                  <RemoveOutlined fontSize="small" />
                </IconButton>
                <IconButton size="small" disabled={!canAct} onClick={() => void changeLap(params.row.id, 1)}>
                  <AddOutlined fontSize="small" />
                </IconButton>
              </Box>
            ),
          },
          {
            field: 'ctrlPos' as const,
            headerName: 'Pos controls',
            minWidth: 180,
            sortable: false,
            renderCell: (params: GridRenderCellParams<PilotRaceState>) => {
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
                    onCommit={(v) => { if (v !== params.row.position) void setPosition(params.row.id, v); }}
                  />
                </Box>
              );
            },
          },
          {
            field: 'ctrlDnf' as const,
            headerName: 'DNF',
            minWidth: 60,
            sortable: false,
            renderCell: (params: GridRenderCellParams<PilotRaceState>) => {
              const isDnf = params.row.status === 'DNF';
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <Button
                    size="small"
                    variant={isDnf ? 'contained' : 'outlined'}
                    color={isDnf ? 'error' : 'inherit'}
                    disabled={!canEditGrid}
                    onClick={() => void toggleDnf(params.row.id)}
                  >
                    DNF
                  </Button>
                </Box>
              );
            },
          },
        ]
      : []),
    {
      field: 'delete',
      type: 'actions' as const,
      headerName: 'Remove',
      headerAlign: 'left' as const,
      align: 'left' as const,
      minWidth: 60,
      getActions: (params: GridRowParams<PilotRaceState>) => [
        ...(canDelete ? [
          <GridActionsCellItem
            icon={<DeleteOutlined />}
            label="Remove"
            onClick={() => void handleRemovePilot(params.row)}
            showInMenu={false}
            disabled={!canRemove}
          />,
        ] : []),
      ],
    },
  ];

  return (
    <DataGrid
      rows={pilots}
      columns={columns}

      pageSizeOptions={[25, 50]}
      disableColumnResize
      disableRowSelectionOnClick
      getRowId={(row) => row.id}
      density="compact"
      slots={{ toolbar: CrudToolbar, noRowsOverlay: NoRowsOverlay }}
      sx={{ flex: 1 }}
    />
  );
}
