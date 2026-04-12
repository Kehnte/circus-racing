// RegiePage — Director/production control view (MODO+).
// Left: stream source thumbnails. Centre: programme preview. Right: layout + quality controls.

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import useSWR from 'swr';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { apiFetch, fetcher } from '../api.ts';
import PageContainer from '../components/PageContainer.tsx';
import StreamThumbnail from '../components/streaming/StreamThumbnail.tsx';
import ProgramView, { type LayoutMode, type SlotSource } from '../components/streaming/ProgramView.tsx';
import type { Pilot } from '../types.ts';

interface StreamConfig { maxResolution: string; maxFps: number; }
interface DirectorState { mode: string; slots: (SlotSource | null)[]; }

const SLOT_COUNT: Record<LayoutMode, number> = {
  'single': 1, 'side-by-side': 2, 'quad': 4, 'pip': 2,
};

export default function RegiePage() {
  const { data: pilots } = useSWR<Pilot[]>('/api/pilots', fetcher);
  const { data: cfg, mutate: mutateCfg } = useSWR<StreamConfig>('/api/streaming/config', fetcher);
  const { data: dirState, mutate: mutateDirState } = useSWR<DirectorState>('/api/streaming/director', fetcher);

  const [activePaths, setActivePaths] = useState<string[]>([]);
  const [savingCfg, setSavingCfg] = useState(false);
  const [maxResolution, setMaxResolution] = useState('1080p');
  const [maxFps, setMaxFps] = useState(30);

  useEffect(() => {
    if (cfg) { setMaxResolution(cfg.maxResolution); setMaxFps(cfg.maxFps); }
  }, [cfg]);

  useEffect(() => {
    const socket = io(window.location.origin, { query: { role: 'dashboard' }, path: '/socket.io' });
    socket.on('stream-status', ({ paths }: { paths: string[] }) => setActivePaths(paths));
    socket.on('director-layout', () => void mutateDirState());
    return () => { socket.disconnect(); };
  }, [mutateDirState]);

  const mode: LayoutMode = (dirState?.mode as LayoutMode) ?? 'single';
  const slots: (SlotSource | null)[] = dirState?.slots ?? [];
  const slotCount = SLOT_COUNT[mode];

  const pilotSources = (pilots ?? []).map((p) => ({
    path: `pilots/${p.id}`,
    label: p.displayName,
    source: { type: 'pilot' as const, id: p.id },
  }));

  const cameraSources = activePaths
    .filter((p) => p.startsWith('cameras/'))
    .map((p) => ({
      path: p,
      label: p.replace('cameras/', 'Camera '),
      source: { type: 'camera' as const, id: p.replace('cameras/', '') },
    }));

  const allSources = [...pilotSources, ...cameraSources];

  function slotLabel(s: SlotSource | null): string | undefined {
    if (!s) return undefined;
    return allSources.find((x) => x.source.type === s.type && x.source.id === s.id)?.label;
  }

  async function assignToSlot(index: number, source: SlotSource) {
    const newSlots = Array.from({ length: slotCount }, (_, i) => slots[i] ?? null);
    newSlots[index] = source;
    await apiFetch('/api/streaming/director', { method: 'PATCH', body: JSON.stringify({ slots: newSlots }) });
    void mutateDirState();
  }

  async function clearSlot(index: number) {
    const newSlots = Array.from({ length: slotCount }, (_, i) => slots[i] ?? null);
    newSlots[index] = null;
    await apiFetch('/api/streaming/director', { method: 'PATCH', body: JSON.stringify({ slots: newSlots }) });
    void mutateDirState();
  }

  async function setMode(newMode: LayoutMode) {
    await apiFetch('/api/streaming/director', { method: 'PATCH', body: JSON.stringify({ mode: newMode, slots: [] }) });
    void mutateDirState();
  }

  async function saveConfig() {
    setSavingCfg(true);
    try {
      await apiFetch('/api/streaming/config', { method: 'PATCH', body: JSON.stringify({ maxResolution, maxFps }) });
      void mutateCfg();
    } finally {
      setSavingCfg(false);
    }
  }

  function handleThumbnailClick(source: SlotSource) {
    const newSlots = Array.from({ length: slotCount }, (_, i) => slots[i] ?? null);
    const emptyIdx = newSlots.findIndex((s) => s === null);
    void assignToSlot(emptyIdx >= 0 ? emptyIdx : 0, source);
  }

  return (
    <PageContainer title="Régie">
      <Box sx={{ display: 'flex', gap: 2, height: '100%', minHeight: 0, overflow: 'hidden' }}>

        {/* Sources */}
        <Paper elevation={0} sx={{ width: 200, flexShrink: 0, p: 1.5, overflow: 'auto' }}>
          <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>Sources</Typography>
          {allSources.length === 0 && (
            <Typography variant="caption" color="text.disabled">No streams detected.</Typography>
          )}
          <Stack spacing={1}>
            {allSources.map(({ path, label, source }) => (
              <StreamThumbnail
                key={path} path={path} label={label}
                active={activePaths.includes(path)}
                selected={slots.some((s) => s?.type === source.type && s?.id === source.id)}
                onClick={() => handleThumbnailClick(source)}
              />
            ))}
          </Stack>
        </Paper>

        {/* Programme */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">Programme</Typography>
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
            <ProgramView
              mode={mode}
              slots={Array.from({ length: slotCount }, (_, i) => slots[i] ?? null)}
              labels={Array.from({ length: slotCount }, (_, i) => slotLabel(slots[i] ?? null))}
            />
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {Array.from({ length: slotCount }, (_, i) => (
              <Paper key={i} variant="outlined" sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">Slot {i + 1}:</Typography>
                <Typography variant="caption" fontWeight={600}>{slotLabel(slots[i] ?? null) ?? 'empty'}</Typography>
                {slots[i] && (
                  <Button size="small" sx={{ minWidth: 0, px: 0.5, py: 0 }} onClick={() => void clearSlot(i)}>✕</Button>
                )}
              </Paper>
            ))}
          </Stack>
          <Alert severity="info" sx={{ py: 0.5 }}>
            Click a source thumbnail to assign it to the next empty slot.
          </Alert>
        </Box>

        {/* Controls */}
        <Paper elevation={0} sx={{ width: 220, flexShrink: 0, p: 1.5, overflow: 'auto' }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>Layout</Typography>
              <Stack spacing={0.5}>
                {(['single', 'side-by-side', 'quad', 'pip'] as LayoutMode[]).map((m) => (
                  <Button key={m} variant={mode === m ? 'contained' : 'outlined'} size="small" fullWidth onClick={() => void setMode(m)}>
                    {m}
                  </Button>
                ))}
              </Stack>
            </Box>
            <Divider />
            <Box>
              <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>Quality</Typography>
              <Stack spacing={1.5}>
                <TextField select label="Max resolution" size="small" value={maxResolution} onChange={(e) => setMaxResolution(e.target.value)}>
                  <MenuItem value="480p">480p</MenuItem>
                  <MenuItem value="720p">720p</MenuItem>
                  <MenuItem value="1080p">1080p</MenuItem>
                </TextField>
                <TextField select label="Max fps" size="small" value={maxFps} onChange={(e) => setMaxFps(Number(e.target.value))}>
                  <MenuItem value={30}>30 fps</MenuItem>
                  <MenuItem value={60}>60 fps</MenuItem>
                </TextField>
                <Button variant="contained" size="small" onClick={() => void saveConfig()} disabled={savingCfg}>apply</Button>
                <Typography variant="caption" color="text.secondary">
                  Changes apply to new streams — pilots must restart their share.
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </Paper>

      </Box>
    </PageContainer>
  );
}
