// RaceSettingsPanel — Collapsible Accordion with race settings and registration controls.
// Debounces text field patches; selects patch immediately.

import { useState, useEffect, useRef } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { mutate } from 'swr';
import { apiFetch } from '../../api.ts';
import type { RaceStatePayload } from '../../types.ts';
import AddPilotDialog from './AddPilotDialog.tsx';

interface Props {
  raceState: RaceStatePayload;
}

export default function RaceSettingsPanel({ raceState }: Props) {
  const { raceId, status } = raceState;
  const isStarted = status === 'STARTED';

  // Local controlled state for debounced text fields.
  const [name, setName] = useState(raceState.raceName);
  const [lapCount, setLapCount] = useState(String(raceState.lapCount));
  const [sessionDuration, setSessionDuration] = useState(
    raceState.sessionDurationMs ? String(Math.round(raceState.sessionDurationMs / 60000)) : ''
  );

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

  function immediatePatch(field: string, value: string | number | boolean) {
    void apiFetch(`/api/races/${raceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value }),
    });
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
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Actions */}
          <Stack direction="row" spacing={1} flexWrap="wrap">
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
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="outlined" onClick={() => setAddPilotOpen(true)}>
              + add pilot
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <AddPilotDialog open={addPilotOpen} raceState={raceState} onClose={() => setAddPilotOpen(false)} />
    </>
  );
}
