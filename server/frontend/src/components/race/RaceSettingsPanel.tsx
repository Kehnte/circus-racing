// RaceSettingsPanel — Collapsible Accordion with race settings and registration controls.
// Debounces text field patches; selects patch immediately.

import { useState, useEffect, useRef } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { mutate } from 'swr';
import { apiFetch } from '../../api.ts';
import type { RaceStatePayload } from '../../types.ts';
import ConfirmDialog from '../ConfirmDialog.tsx';
import AddPilotDialog from './AddPilotDialog.tsx';

interface Props {
  raceState: RaceStatePayload;
  onDeleted: () => void;
}

export default function RaceSettingsPanel({ raceState, onDeleted }: Props) {
  const { raceId, status } = raceState;
  const isStarted = status === 'STARTED';
  const canDelete = status !== 'STARTED' && status !== 'PAUSED';

  // Local controlled state for debounced text fields.
  const [name, setName] = useState(raceState.raceName);
  const [lapCount, setLapCount] = useState(String(raceState.lapCount));
  const [sessionDuration, setSessionDuration] = useState(
    raceState.sessionDurationMs ? String(Math.round(raceState.sessionDurationMs / 60000)) : ''
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addPilotOpen, setAddPilotOpen] = useState(false);

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

  function immediatePatch(field: string, value: string | number | boolean) {
    void apiFetch(`/api/races/${raceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value }),
    });
  }

  async function handleDelete() {
    await apiFetch(`/api/races/${raceId}`, { method: 'DELETE' });
    await mutate('/api/races');
    onDeleted();
  }

  return (
    <>
      <Accordion disableGutters defaultExpanded={false} sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="overline">{raceState.raceName}</Typography>
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
                onChange={(e) => { setName(e.target.value); debouncedPatch('name', e.target.value); }}
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
                  value={raceState.trackingMode}
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

            {/* Display settings */}
            <Grid size={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Team display</InputLabel>
                <Select value={raceState.teamDisplayMode} label="Team display" onChange={(e) => immediatePatch('teamDisplayMode', e.target.value)}>
                  <MenuItem value="color-bar">Color bar</MenuItem>
                  <MenuItem value="acronym">Acronym</MenuItem>
                  <MenuItem value="hidden">Hidden</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={4}>
              <FormControl size="small" fullWidth>
                <InputLabel>Chrono mode</InputLabel>
                <Select value={raceState.chronoDisplayMode} label="Chrono mode" onChange={(e) => immediatePatch('chronoDisplayMode', e.target.value)}>
                  <MenuItem value="leader">Leader</MenuItem>
                  <MenuItem value="gap">Gap</MenuItem>
                  <MenuItem value="best-lap">Best lap</MenuItem>
                  <MenuItem value="last-lap">Last lap</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={raceState.timingEnabled}
                    onChange={(e) => immediatePatch('timingEnabled', e.target.checked)}
                  />
                }
                label={<Typography variant="body2">Timing</Typography>}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Actions */}
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button size="small" variant="outlined" onClick={() => void apiFetch(`/api/races/${raceId}/open-registrations`, { method: 'POST' })}>
              open registrations
            </Button>
            <Button size="small" variant="outlined" onClick={() => void apiFetch(`/api/races/${raceId}/close-registrations`, { method: 'POST' })}>
              close registrations
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="outlined" onClick={() => setAddPilotOpen(true)}>
              + add pilot
            </Button>
            <Button size="small" color="error" variant="outlined" disabled={!canDelete} onClick={() => setConfirmOpen(true)}>
              delete race
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <AddPilotDialog open={addPilotOpen} raceState={raceState} onClose={() => setAddPilotOpen(false)} />

      <ConfirmDialog
        open={confirmOpen}
        title="Delete race"
        description={`Delete "${raceState.raceName}"? This cannot be undone.`}
        onConfirm={() => { setConfirmOpen(false); void handleDelete(); }}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
