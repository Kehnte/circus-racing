// OverlaySettingsPanel — Collapsible Accordion for overlay display settings.
// Controls team display, chrono mode, timing, event duration and countdown.

import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import StopOutlined from '@mui/icons-material/StopOutlined';
import { apiFetch } from '../../api.ts';
import type { RaceStatePayload } from '../../types.ts';

interface Props {
  raceState: RaceStatePayload;
}

export default function OverlaySettingsPanel({ raceState }: Props) {
  const { raceId, status } = raceState;
  const canCountdown = status === 'PENDING' || status === 'SCHEDULED';

  const [eventDuration, setEventDuration] = useState(String(raceState.eventDuration));
  const [countdownSecs, setCountdownSecs] = useState('10');
  const [countdownRunning, setCountdownRunning] = useState(false);

  useEffect(() => {
    setEventDuration(String(raceState.eventDuration));
  }, [raceId]);

  useEffect(() => {
    if (status === 'STARTED' || status === 'PENDING') setCountdownRunning(false);
  }, [status]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function immediatePatch(field: string, value: string | number | boolean) {
    void apiFetch(`/api/races/${raceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value }),
    });
  }

  function debouncedPatch(field: string, value: number) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void apiFetch(`/api/races/${raceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value }),
      });
    }, 600);
  }

  async function toggleCountdown() {
    if (countdownRunning) {
      await apiFetch(`/api/race-events/races/${raceId}/countdown-stop`, { method: 'POST' });
      setCountdownRunning(false);
    } else {
      await apiFetch(`/api/race-events/races/${raceId}/countdown`, {
        method: 'POST',
        body: JSON.stringify({ seconds: Number(countdownSecs) }),
      });
      setCountdownRunning(true);
    }
  }

  return (
    <Accordion disableGutters elevation={0} sx={{ mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="overline">Overlay</Typography>
      </AccordionSummary>

      <AccordionDetails>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Team display</InputLabel>
            <Select
              value={raceState.teamDisplayMode}
              label="Team display"
              onChange={(e) => immediatePatch('teamDisplayMode', e.target.value)}
            >
              <MenuItem value="color-bar">Color bar</MenuItem>
              <MenuItem value="acronym">Acronym</MenuItem>
              <MenuItem value="hidden">Hidden</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Chrono</InputLabel>
            <Select
              value={raceState.chronoDisplayMode}
              label="Chrono"
              onChange={(e) => immediatePatch('chronoDisplayMode', e.target.value)}
            >
              <MenuItem value="gap">Gap</MenuItem>
              <MenuItem value="leader">Leader</MenuItem>
              <MenuItem value="best-lap">Best lap</MenuItem>
              <MenuItem value="last-lap">Last lap</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Event duration (s)"
            type="number"
            value={eventDuration}
            size="small"
            sx={{ width: 140 }}
            inputProps={{ min: 1 }}
            onChange={(e) => {
              setEventDuration(e.target.value);
              debouncedPatch('eventDuration', Number(e.target.value));
            }}
          />

          <Button
            variant="outlined"
            size="small"
            color={raceState.timingEnabled ? 'primary' : 'error'}
            onClick={() => immediatePatch('timingEnabled', !raceState.timingEnabled)}
          >
            timing {raceState.timingEnabled ? 'on' : 'off'}
          </Button>

          <Divider orientation="vertical" flexItem />

          <TextField
            type="number"
            label="Countdown (s)"
            value={countdownSecs}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCountdownSecs(e.target.value)}
            size="small"
            sx={{ width: 110 }}
            inputProps={{ min: 1, max: 999 }}
          />

          <Button
            variant={countdownRunning ? 'outlined' : 'contained'}
            size="small"
            color={countdownRunning ? 'error' : 'primary'}
            startIcon={countdownRunning ? <StopOutlined /> : <PlayArrowOutlined />}
            disabled={!canCountdown && !countdownRunning}
            onClick={() => void toggleCountdown()}
          >
            {countdownRunning ? 'stop' : 'start'}
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
