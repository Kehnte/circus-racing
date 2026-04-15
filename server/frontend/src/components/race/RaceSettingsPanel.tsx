// RaceSettingsPanel — Collapsible Accordion with race settings, registration controls,
// and circuit management (auto mode only). Settings are buffered locally and applied on save.

import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import { apiFetch, fetcher } from '../../api.ts';
import { useFeatures } from '../../context/FeaturesContext.tsx';
import type { RaceStatePayload, Racetrack } from '../../types.ts';

interface Props {
  raceState: RaceStatePayload;
}

interface LocalSettings {
  name: string;
  session: string;
  weather: string;
  startType: string;
  trackingMode: string;
  sessionMode: string;
  lapCount: string;
  sessionDuration: string;
}

function initLocal(raceState: RaceStatePayload): LocalSettings {
  return {
    name: raceState.raceName,
    session: raceState.session,
    weather: raceState.weather,
    startType: raceState.startType,
    trackingMode: raceState.trackingMode,
    sessionMode: raceState.sessionMode,
    lapCount: String(raceState.lapCount),
    sessionDuration: raceState.sessionDurationMs
      ? String(Math.round(raceState.sessionDurationMs / 60000))
      : '',
  };
}

export default function RaceSettingsPanel({ raceState }: Props) {
  const { raceId, status, racetrackId } = raceState;
  const isStarted = status === 'STARTED';
  const { ocr } = useFeatures();

  const [local, setLocal] = useState<LocalSettings>(() => initLocal(raceState));

  // Sync local state when a different race is loaded.
  useEffect(() => {
    setLocal(initLocal(raceState));
  }, [raceId]);

  function set(field: keyof LocalSettings, value: string) {
    setLocal((prev) => ({ ...prev, [field]: value }));
  }

  async function handleApply() {
    const body: Record<string, unknown> = {
      name: local.name,
      session: local.session,
      weather: local.weather,
      startType: local.startType,
      trackingMode: local.trackingMode,
      sessionMode: local.sessionMode,
      lapCount: Number(local.lapCount),
    };
    if (local.sessionMode === 'timed') {
      body.sessionDurationMs = Number(local.sessionDuration) * 60000;
    }
    await apiFetch(`/api/races/${raceId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    // Revalidate race list so the selector name updates.
    void mutate('/api/races');
  }

  // Circuit management (auto mode only) — remains immediate.
  const isAuto = local.trackingMode === 'auto';
  const { data: racetracks } = useSWR<Racetrack[]>(isAuto ? '/api/racetracks' : null, fetcher);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState('');

  const [renaming, setRenaming] = useState(false);
  const [circuitName, setCircuitName] = useState('');

  useEffect(() => {
    const track = racetracks?.find((r) => r.id === racetrackId);
    setCircuitName(track?.name ?? '');
    setRenaming(false);
  }, [racetrackId, racetracks]);

  function immediatePatch(field: string, value: string | number | boolean | null) {
    void apiFetch(`/api/races/${raceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value }),
    });
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const stem = file.name.replace(/\.json$/i, '');
    setImportFile(file);
    setImportName(stem);
  }

  async function handleImportConfirm() {
    if (!importFile) return;
    try {
      const text = await importFile.text();
      const json = JSON.parse(text) as { checkpoints: unknown[] };
      const created = await apiFetch<Racetrack>('/api/racetracks', {
        method: 'POST',
        body: JSON.stringify({ name: importName.trim() || importFile.name.replace(/\.json$/i, ''), checkpoints: json.checkpoints }),
      });
      await mutate('/api/racetracks');
      immediatePatch('racetrackId', created.id);
    } catch {
      // silently ignore; error visible from failed request
    } finally {
      setImportDialogOpen(false);
      setImportFile(null);
      setImportName('');
    }
  }

  function handleImportCancel() {
    setImportDialogOpen(false);
    setImportFile(null);
    setImportName('');
  }

  async function handleRenameConfirm() {
    if (!racetrackId || !circuitName.trim()) return;
    await apiFetch(`/api/racetracks/${racetrackId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: circuitName.trim() }),
    });
    void mutate('/api/racetracks');
    setRenaming(false);
  }

  async function handleExport() {
    if (!racetrackId) return;
    const track = await apiFetch<Racetrack>(`/api/racetracks/${racetrackId}`);
    const blob = new Blob([JSON.stringify(track, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${track.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!racetrackId) return;
    await apiFetch(`/api/racetracks/${racetrackId}`, { method: 'DELETE' });
    await mutate('/api/racetracks');
    immediatePatch('racetrackId', null);
    setDeleteConfirmOpen(false);
  }

  return (
    <>
      <Accordion disableGutters elevation={0} defaultExpanded={true} sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="overline">Race settings</Typography>
        </AccordionSummary>

        <AccordionDetails>
          <Grid container spacing={2}>
            {/* Name */}
            <Grid size={12}>
              <TextField
                label="Name"
                value={local.name}
                size="small"
                fullWidth
                onChange={(e) => set('name', e.target.value)}
              />
            </Grid>

            {/* Session / Weather / Start type */}
            <Grid size={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Session</InputLabel>
                <Select value={local.session} label="Session" onChange={(e) => set('session', e.target.value)}>
                  {['Practice', 'Qualifying', 'Race', 'Endurance'].map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Weather</InputLabel>
                <Select value={local.weather} label="Weather" onChange={(e) => set('weather', e.target.value)}>
                  {['Clear', 'Cloudy', 'Rain', 'Storm', 'Fog'].map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Start type</InputLabel>
                <Select value={local.startType} label="Start type" onChange={(e) => set('startType', e.target.value)}>
                  {['Grid Start', 'Rolling Start'].map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Tracking mode */}
            <Grid size={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Tracking</InputLabel>
                <Select
                  value={local.trackingMode}
                  label="Tracking"
                  disabled={isStarted}
                  onChange={(e) => set('trackingMode', e.target.value)}
                >
                  <MenuItem value="manual">Manual</MenuItem>
                  {ocr && <MenuItem value="auto">Auto (OCR)</MenuItem>}
                </Select>
              </FormControl>
            </Grid>

            {/* Session mode */}
            <Grid size={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Session mode</InputLabel>
                <Select value={local.sessionMode} label="Session mode" onChange={(e) => set('sessionMode', e.target.value)}>
                  <MenuItem value="laps">Laps</MenuItem>
                  <MenuItem value="timed">Timed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Lap count or duration (conditional) */}
            {local.sessionMode === 'laps' ? (
              <Grid size={4}>
                <TextField
                  label="Laps"
                  type="number"
                  value={local.lapCount}
                  size="small"
                  fullWidth
                  inputProps={{ min: 1 }}
                  onChange={(e) => set('lapCount', e.target.value)}
                />
              </Grid>
            ) : (
              <Grid size={4}>
                <TextField
                  label="Duration (min)"
                  type="number"
                  value={local.sessionDuration}
                  size="small"
                  fullWidth
                  inputProps={{ min: 1 }}
                  onChange={(e) => set('sessionDuration', e.target.value)}
                />
              </Grid>
            )}

            {/* Circuit management (auto mode only) */}
            {isAuto && (
              <>
                <Grid size={12}>
                  <Divider />
                </Grid>

                {/* Selector (or inline rename) + action buttons */}
                <Grid size={12}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {renaming ? (
                      <TextField
                        label="Circuit"
                        value={circuitName}
                        size="small"
                        autoFocus
                        sx={{ flex: 1 }}
                        onChange={(e) => setCircuitName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleRenameConfirm(); if (e.key === 'Escape') setRenaming(false); }}
                      />
                    ) : (
                      <FormControl size="small" sx={{ flex: 1 }}>
                        <InputLabel>Circuit</InputLabel>
                        <Select
                          value={racetrackId ?? ''}
                          label="Circuit"
                          disabled={isStarted}
                          onChange={(e) => immediatePatch('racetrackId', e.target.value || null)}
                        >
                          <MenuItem value="">none</MenuItem>
                          {(racetracks ?? []).map((r) => (
                            <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<UploadFileOutlined />}
                      disabled={isStarted}
                      onClick={() => setImportDialogOpen(true)}
                    >
                      import
                    </Button>
                    {racetrackId && !renaming && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadOutlined />}
                        disabled={isStarted}
                        onClick={() => void handleExport()}
                      >
                        export
                      </Button>
                    )}
                    {racetrackId && !renaming && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditOutlined />}
                        disabled={isStarted}
                        onClick={() => setRenaming(true)}
                      >
                        rename
                      </Button>
                    )}
                    {racetrackId && renaming && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckOutlined />}
                        disabled={!circuitName.trim()}
                        onClick={() => void handleRenameConfirm()}
                      >
                        save
                      </Button>
                    )}
                    {racetrackId && renaming && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<CloseOutlined />}
                        onClick={() => setRenaming(false)}
                      >
                        cancel
                      </Button>
                    )}
                    {racetrackId && !renaming && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlined />}
                        disabled={isStarted}
                        onClick={() => setDeleteConfirmOpen(true)}
                      >
                        delete
                      </Button>
                    )}
                  </Box>
                </Grid>
              </>
            )}
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Apply settings + registration toggle */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              size="small"
              variant="contained"
              onClick={() => void handleApply()}
            >
              apply
            </Button>

            <Button
              size="small"
              variant="outlined"
              color={status === 'SCHEDULED' ? 'error' : 'primary'}
              disabled={status !== 'PENDING' && status !== 'SCHEDULED'}
              onClick={() => void apiFetch(
                `/api/races/${raceId}/${status === 'SCHEDULED' ? 'close' : 'open'}-registrations`,
                { method: 'POST' }
              )}
            >
              {status === 'SCHEDULED' ? 'close registrations' : 'open registrations'}
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Import circuit dialog */}
      <Dialog open={importDialogOpen} onClose={handleImportCancel} maxWidth="xs" fullWidth>
        <DialogTitle>Import circuit</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileChosen}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileOutlined />}
            onClick={() => fileInputRef.current?.click()}
          >
            {importFile ? importFile.name : 'choose file'}
          </Button>
          {importFile && (
            <TextField
              label="Circuit name"
              value={importName}
              size="small"
              fullWidth
              autoFocus
              onChange={(e) => setImportName(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleImportCancel}>cancel</Button>
          <Button
            variant="contained"
            disabled={!importFile || !importName.trim()}
            onClick={() => void handleImportConfirm()}
          >
            import
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete circuit confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs">
        <DialogTitle>Delete circuit?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will permanently delete the circuit and unassign it from this race.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleDelete()}>delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
