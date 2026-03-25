// RaceSettingsPanel — Collapsible Accordion with race settings, registration controls,
// and circuit management (auto mode only).

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
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import { apiFetch, fetcher } from '../../api.ts';
import type { RaceStatePayload, Racetrack } from '../../types.ts';

interface Props {
  raceState: RaceStatePayload;
}

export default function RaceSettingsPanel({ raceState }: Props) {
  const { raceId, status, trackingMode, racetrackId } = raceState;
  const isStarted = status === 'STARTED';
  const isAuto = trackingMode === 'auto';

  // Local controlled state for debounced text fields.
  const [name, setName] = useState(raceState.raceName);
  const [lapCount, setLapCount] = useState(String(raceState.lapCount));
  const [sessionDuration, setSessionDuration] = useState(
    raceState.sessionDurationMs ? String(Math.round(raceState.sessionDurationMs / 60000)) : ''
  );

  // Sync local text state when a new race is loaded.
  useEffect(() => {
    setName(raceState.raceName);
    setLapCount(String(raceState.lapCount));
    setSessionDuration(
      raceState.sessionDurationMs ? String(Math.round(raceState.sessionDurationMs / 60000)) : ''
    );
  }, [raceId]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function debouncedPatch(field: string, value: string | number) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void apiFetch(`/api/races/${raceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value }),
      });
    }, 600);
  }

  // Name patch also revalidates the race list so the selector dropdown updates.
  function debouncedPatchName(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await apiFetch(`/api/races/${raceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: value }),
      });
      void mutate('/api/races');
    }, 600);
  }

  function immediatePatch(field: string, value: string | number | boolean | null) {
    void apiFetch(`/api/races/${raceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value }),
    });
  }

  // Circuit management (auto mode only)
  const { data: racetracks } = useSWR<Racetrack[]>(isAuto ? '/api/racetracks' : null, fetcher);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const json = JSON.parse(text) as { name: string; checkpoints: unknown[]; bufferRadius?: number };
      const created = await apiFetch<Racetrack>('/api/racetracks', {
        method: 'POST',
        body: JSON.stringify(json),
      });
      await mutate('/api/racetracks');
      immediatePatch('racetrackId', created.id);
    } catch {
      // silently ignore; error visible from failed request
    }
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
                value={name}
                size="small"
                fullWidth
                onChange={(e) => { setName(e.target.value); debouncedPatchName(e.target.value); }}
              />
            </Grid>

            {/* Session / Weather / Start type */}
            <Grid size={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Session</InputLabel>
                <Select value={raceState.session} label="Session" onChange={(e) => immediatePatch('session', e.target.value)}>
                  {['Practice', 'Qualifying', 'Race', 'Endurance'].map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Weather</InputLabel>
                <Select value={raceState.weather} label="Weather" onChange={(e) => immediatePatch('weather', e.target.value)}>
                  {['Clear', 'Cloudy', 'Rain', 'Storm', 'Fog'].map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Start type</InputLabel>
                <Select value={raceState.startType} label="Start type" onChange={(e) => immediatePatch('startType', e.target.value)}>
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
                  value={trackingMode}
                  label="Tracking"
                  disabled={isStarted}
                  onChange={(e) => immediatePatch('trackingMode', e.target.value)}
                >
                  <MenuItem value="manual">Manual</MenuItem>
                  <MenuItem value="auto">Auto (OCR)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Session mode */}
            <Grid size={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Session mode</InputLabel>
                <Select value={raceState.sessionMode} label="Session mode" onChange={(e) => immediatePatch('sessionMode', e.target.value)}>
                  <MenuItem value="laps">Laps</MenuItem>
                  <MenuItem value="time">Timed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Lap count or duration (conditional) */}
            {raceState.sessionMode === 'laps' ? (
              <Grid size={4}>
                <TextField
                  label="Laps"
                  type="number"
                  value={lapCount}
                  size="small"
                  fullWidth
                  inputProps={{ min: 1 }}
                  onChange={(e) => { setLapCount(e.target.value); debouncedPatch('lapCount', Number(e.target.value)); }}
                />
              </Grid>
            ) : (
              <Grid size={4}>
                <TextField
                  label="Duration (min)"
                  type="number"
                  value={sessionDuration}
                  size="small"
                  fullWidth
                  inputProps={{ min: 1 }}
                  onChange={(e) => {
                    setSessionDuration(e.target.value);
                    debouncedPatch('sessionDurationMs', Number(e.target.value) * 60000);
                  }}
                />
              </Grid>
            )}

            {/* Circuit (auto mode only) */}
            {isAuto && (
              <>
                <Grid size={12}>
                  <Divider />
                </Grid>
                <Grid size={12}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      style={{ display: 'none' }}
                      onChange={(e) => void handleImport(e)}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<UploadFileOutlined />}
                      disabled={isStarted}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      import
                    </Button>
                    {racetrackId && (
                      <IconButton
                        size="small"
                        color="error"
                        disabled={isStarted}
                        onClick={() => setDeleteConfirmOpen(true)}
                      >
                        <DeleteOutlined fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Grid>
              </>
            )}
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Actions */}
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
        </AccordionDetails>
      </Accordion>

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
