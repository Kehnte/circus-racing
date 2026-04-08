// TelemetryPage — Live AUTO mode OCR telemetry view for race directors.

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridFilterModel, GridPaginationModel, GridRenderCellParams, GridSortModel } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { NoRowsOverlay } from '../components/DataGridOverlays.tsx';
import PageContainer from '../components/PageContainer.tsx';
import CrudToolbar from '../components/CrudToolbar.tsx';
import { useRaceStore } from '../store/raceStore.ts';
import type { RejectionSample } from '../store/raceStore.ts';
import type { OcrStatus } from '../types.ts';

function formatLapTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const millis = ms % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return 'now';
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s ago`;
}

function ocrStatusColor(status: OcrStatus | undefined): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'active') return 'success';
  if (status === 'stale') return 'warning';
  if (status === 'offline') return 'error';
  return 'default';
}

function raceStatusColor(status: string | undefined): 'success' | 'primary' | 'error' | 'default' {
  if (status === 'RUNNING') return 'success';
  if (status === 'FINISHED') return 'primary';
  if (status === 'DNF') return 'error';
  return 'default';
}

function syncParam(params: URLSearchParams, key: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null) next.delete(key);
  else next.set(key, value);
  return next;
}

interface TelemetryRow {
  id: string;
  displayName: string;
  ocrStatus: OcrStatus | undefined;
  lastPositionAt: string | null;
  rejectedCount: number;
  lastRejectedSpeed: number | null;
  lastRejectedAt: string | null;
  rejectionTrend: RejectionSample[];
  lap: number;
  raceStatus: string;
  bestLap: number | null;
}

export default function TelemetryPage() {
  const raceState = useRaceStore((s) => s.raceState);
  const ocrStatusMap = useRaceStore((s) => s.ocrStatusMap);
  const ocrHealthMap = useRaceStore((s) => s.ocrHealthMap);
  const rejectionHistory = useRaceStore((s) => s.rejectionHistory);

  // Tick every second to refresh relative timestamps
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

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

  const rows: TelemetryRow[] = useMemo(() => {
    if (!raceState || raceState.trackingMode !== 'auto') return [];
    return raceState.pilots.map((pilot) => {
      const ocrEntry = ocrStatusMap[pilot.id];
      const health = ocrHealthMap[pilot.id];
      const bestLap = pilot.lapTimes?.length ? Math.min(...pilot.lapTimes) : null;
      return {
        id: pilot.id,
        displayName: pilot.displayName,
        ocrStatus: ocrEntry?.status,
        lastPositionAt: ocrEntry?.lastPositionAt ?? null,
        rejectedCount: health?.rejectedCount ?? 0,
        lastRejectedSpeed: health?.lastRejectedSpeed ?? null,
        lastRejectedAt: health?.lastRejectedAt ?? null,
        rejectionTrend: rejectionHistory[pilot.id] ?? [],
        lap: pilot.lap,
        raceStatus: pilot.status,
        bestLap,
      };
    });
  }, [raceState, ocrStatusMap, ocrHealthMap, rejectionHistory]);

  const columns: GridColDef<TelemetryRow>[] = [
    { field: 'displayName', headerName: 'Pilot', flex: 2, minWidth: 120 },
    {
      field: 'ocrStatus',
      headerName: 'OCR status',
      minWidth: 110,
      renderCell: (params: GridRenderCellParams<TelemetryRow, OcrStatus | undefined>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip
            label={params.value ?? 'unknown'}
            color={ocrStatusColor(params.value)}
            size="small"
          />
        </Box>
      ),
    },
    {
      field: 'lastPositionAt',
      headerName: 'Last position',
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<TelemetryRow, string | null>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color={params.value ? 'text.primary' : 'text.disabled'}>
            {relativeTime(params.value)}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'rejectedCount',
      headerName: 'Rejections',
      minWidth: 100,
      renderCell: (params: GridRenderCellParams<TelemetryRow, number>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color={(params.value ?? 0) > 0 ? 'error.main' : 'text.primary'}>
            {params.value ?? 0}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'lastRejectedSpeed',
      headerName: 'Rejection speed',
      minWidth: 130,
      renderCell: (params: GridRenderCellParams<TelemetryRow, number | null>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color={params.value ? 'text.primary' : 'text.disabled'}>
            {params.value != null ? `${params.value} m/s` : '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'lastRejectedAt',
      headerName: 'Last rejection',
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<TelemetryRow, string | null>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color={params.value ? 'text.primary' : 'text.disabled'}>
            {relativeTime(params.value)}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'rejectionTrend',
      headerName: 'Rejection trend (1 min)',
      minWidth: 200,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<TelemetryRow, RejectionSample[]>) => {
        const samples = params.value ?? [];
        if (samples.length < 2) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <Typography variant="body2" color="text.disabled">—</Typography>
            </Box>
          );
        }
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%', px: 1 }}>
            <SparkLineChart
              data={samples.map((s) => s.speed)}
              height={36}
              color="#f44336"
              showHighlight
              showTooltip
              valueFormatter={(v) => `${v ?? 0} m/s`}
            />
          </Box>
        );
      },
    },
    { field: 'lap', headerName: 'Lap', minWidth: 70, type: 'number' },
    {
      field: 'raceStatus',
      headerName: 'Race status',
      minWidth: 110,
      renderCell: (params: GridRenderCellParams<TelemetryRow, string>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip
            label={params.value ? params.value.charAt(0) + params.value.slice(1).toLowerCase() : ''}
            color={raceStatusColor(params.value)}
            size="small"
          />
        </Box>
      ),
    },
    {
      field: 'bestLap',
      headerName: 'Best lap',
      minWidth: 110,
      renderCell: (params: GridRenderCellParams<TelemetryRow, number | null>) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color={params.value ? 'text.primary' : 'text.disabled'}>
            {params.value != null ? formatLapTime(params.value) : '—'}
          </Typography>
        </Box>
      ),
    },
  ];

  return (
    <PageContainer title="Telemetry">
      <DataGrid
        rows={rows}
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
