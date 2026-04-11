// CreateRaceDialog — Form to create a new race with conditional fields.

import { useState } from 'react';
import { mutate } from 'swr';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import { apiFetch } from '../../api.ts';
import type { RaceMeta } from '../../types.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (raceId: string) => void;
}

export default function CreateRaceDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [trackingMode, setTrackingMode] = useState<'manual' | 'auto'>('manual');
  const [session, setSession] = useState('Race');
  const [weather, setWeather] = useState('Clear');
  const [startType, setStartType] = useState('Grid Start');
  const [sessionMode, setSessionMode] = useState<'laps' | 'timed'>('laps');
  const [lapCount, setLapCount] = useState('3');
  const [durationMin, setDurationMin] = useState('30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setName(''); setTrackingMode('manual');
    setSession('Race'); setWeather('Clear'); setStartType('Grid Start');
    setSessionMode('laps'); setLapCount('3'); setDurationMin('30');
    setError('');
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Name is required'); return; }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(), trackingMode, session, weather, startType, sessionMode,
        ...(sessionMode === 'laps' ? { lapCount: Number(lapCount) } : { sessionDurationMs: Number(durationMin) * 60000 }),
      };
      const race = await apiFetch<RaceMeta>('/api/races', { method: 'POST', body: JSON.stringify(body) });
      await apiFetch(`/api/races/${race.id}/load`, { method: 'POST' });
      await mutate('/api/races');
      reset();
      onCreated(race.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle>New race</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={12}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} size="small" fullWidth required error={!!error && !name.trim()} />
          </Grid>

          <Grid size={6}>
            <FormControl size="small" fullWidth>
              <InputLabel>Tracking</InputLabel>
              <Select value={trackingMode} label="Tracking" onChange={(e) => setTrackingMode(e.target.value as 'manual' | 'auto')}>
                <MenuItem value="manual">Manual</MenuItem>
                <MenuItem value="auto">Auto (OCR)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={4}>
            <FormControl size="small" fullWidth>
              <InputLabel>Session</InputLabel>
              <Select value={session} label="Session" onChange={(e) => setSession(e.target.value)}>
                {['Practice', 'Qualifying', 'Race', 'Endurance'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={4}>
            <FormControl size="small" fullWidth>
              <InputLabel>Weather</InputLabel>
              <Select value={weather} label="Weather" onChange={(e) => setWeather(e.target.value)}>
                {['Clear', 'Cloudy', 'Rain', 'Storm', 'Fog'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={4}>
            <FormControl size="small" fullWidth>
              <InputLabel>Start type</InputLabel>
              <Select value={startType} label="Start type" onChange={(e) => setStartType(e.target.value)}>
                {['Grid Start', 'Rolling Start'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={6}>
            <FormControl size="small" fullWidth>
              <InputLabel>Session mode</InputLabel>
              <Select value={sessionMode} label="Session mode" onChange={(e) => setSessionMode(e.target.value as 'laps' | 'timed')}>
                <MenuItem value="laps">Laps</MenuItem>
                <MenuItem value="time">Timed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={6}>
            {sessionMode === 'laps' ? (
              <TextField label="Laps" type="number" value={lapCount} onChange={(e) => setLapCount(e.target.value)} size="small" fullWidth inputProps={{ min: 1 }} />
            ) : (
              <TextField label="Duration (min)" type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} size="small" fullWidth inputProps={{ min: 1 }} />
            )}
          </Grid>

          {error && (
            <Grid size={12}>
              <Alert severity="error">{error}</Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }}>cancel</Button>
        <Button variant="contained" disabled={loading} onClick={() => void handleCreate()}>create</Button>
      </DialogActions>
    </Dialog>
  );
}
