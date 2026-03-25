// RaceGrid — Live race DataGrid with per-pilot controls in MANUAL mode.

import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import RemoveOutlined from '@mui/icons-material/RemoveOutlined';
import { apiFetch } from '../../api.ts';
import FlagIcon from '../FlagIcon.tsx';
import type { PilotRaceState, RaceStatePayload } from '../../types.ts';
import ChronoDisplay from './ChronoDisplay.tsx';

interface Props {
  raceState: RaceStatePayload;
}

function statusChipColor(status: string): 'success' | 'error' | 'default' {
  if (status === 'FINISHED') return 'success';
  if (status === 'DNF') return 'error';
  return 'default';
}

export default function RaceGrid({ raceState }: Props) {
  const { raceId, pilots, trackingMode, status, teamDisplayMode, timingEnabled } = raceState;
  const isManual = trackingMode === 'manual';
  const canAct = status === 'STARTED';

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
      width: 56,
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
          width: 120,
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
      width: 90,
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
          width: 140,
          sortable: false,
          renderCell: (params: GridRenderCellParams<PilotRaceState>) => (
            <ChronoDisplay pilot={params.row} raceState={raceState} />
          ),
        }]
      : []),
    ...(isManual
      ? [{
          field: 'actions' as const,
          headerName: 'Controls',
          width: 170,
          sortable: false,
          renderCell: (params: GridRenderCellParams<PilotRaceState>) => {
            const isDnf = params.row.status === 'DNF';
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <IconButton size="small" disabled={!canAct} onClick={() => void changeLap(params.row.id, -1)}>
                  <RemoveOutlined fontSize="small" />
                </IconButton>
                <IconButton size="small" disabled={!canAct} onClick={() => void changeLap(params.row.id, 1)}>
                  <AddOutlined fontSize="small" />
                </IconButton>
                <IconButton size="small" disabled={!canAct} onClick={() => void reorder(params.row.id, 'up')}>
                  <ArrowUpwardOutlined fontSize="small" />
                </IconButton>
                <IconButton size="small" disabled={!canAct} onClick={() => void reorder(params.row.id, 'down')}>
                  <ArrowDownwardOutlined fontSize="small" />
                </IconButton>
                <Chip
                  label="DNF"
                  size="small"
                  color={isDnf ? statusChipColor('DNF') : 'default'}
                  variant={isDnf ? 'filled' : 'outlined'}
                  onClick={canAct ? () => void toggleDnf(params.row.id) : undefined}
                  sx={{ cursor: canAct ? 'pointer' : 'default', fontSize: 11 }}
                />
              </Box>
            );
          },
        }]
      : []),
  ];

  return (
    <DataGrid
      rows={pilots}
      columns={columns}

      disableColumnFilter
      disableColumnMenu
      hideFooter={pilots.length <= 25}
      pageSizeOptions={[25, 50]}
      disableRowSelectionOnClick
      getRowId={(row) => row.id}
      sx={{ width: '100%' }}
    />
  );
}
