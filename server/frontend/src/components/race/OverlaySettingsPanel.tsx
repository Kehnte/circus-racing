// OverlaySettingsPanel — Collapsible Accordion for overlay display settings.
// Controls team display, chrono mode, event duration and countdown. Settings are applied on save.

import { useState, useEffect, useRef } from 'react';
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
import useSWR from 'swr';
import { apiFetch, fetcher } from '../../api.ts';
import type { RaceStatePayload } from '../../types.ts';

interface Props {
  raceState: RaceStatePayload;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}

export default function OverlaySettingsPanel({ raceState, expanded, onExpandedChange }: Props) {
  const { raceId, status } = raceState;
  const canCountdown = status === 'PENDING' || status === 'SCHEDULED';

  const { data: teams } = useSWR<{ id: string }[]>('/api/teams', fetcher);
  const hasTeams = (teams?.length ?? 0) > 0;
  const teamsLoaded = useRef(false);

  // Buffered local state — only sent on Apply.
  const [teamDisplayMode, setTeamDisplayMode] = useState(raceState.teamDisplayMode);
  const [chronoDisplayMode, setChronoDisplayMode] = useState(raceState.chronoDisplayMode);
  const [eventDuration, setEventDuration] = useState(String(raceState.eventDuration));

  const [countdownSecs, setCountdownSecs] = useState('10');
  const [countdownRunning, setCountdownRunning] = useState(false);

  // Sync when a different race is loaded.
  useEffect(() => {
    setTeamDisplayMode(raceState.teamDisplayMode);
    setChronoDisplayMode(raceState.chronoDisplayMode);
    setEventDuration(String(raceState.eventDuration));
  }, [raceId]);

  // Auto-apply hidden team display when teams are deleted.
  useEffect(() => {
    if (teams === undefined) return; // still loading
    if (!teamsLoaded.current) { teamsLoaded.current = true; return; }
    if (!hasTeams) {
      void apiFetch(`/api/races/${raceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ teamDisplayMode: 'hidden' }),
      });
      setTeamDisplayMode('hidden');
    }
  }, [hasTeams]);

  useEffect(() => {
    if (status === 'STARTED' || status === 'PENDING') setCountdownRunning(false);
  }, [status]);

  async function handleApply() {
    await apiFetch(`/api/races/${raceId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        teamDisplayMode,
        chronoDisplayMode,
        eventDuration: Number(eventDuration),
      }),
    });
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
    <Accordion disableGutters elevation={0} expanded={expanded} onChange={(_, v) => onExpandedChange(v)} sx={{ mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="overline">Overlay</Typography>
      </AccordionSummary>

      <AccordionDetails>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 130 }} disabled={!hasTeams}>
            <InputLabel>Team display</InputLabel>
            <Select
              value={hasTeams ? teamDisplayMode : 'hidden'}
              label="Team display"
              onChange={(e) => setTeamDisplayMode(e.target.value as typeof teamDisplayMode)}
            >
              <MenuItem value="color-bar">Color bar</MenuItem>
              <MenuItem value="acronym">Acronym</MenuItem>
              <MenuItem value="hidden">Hidden</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Chrono</InputLabel>
            <Select
              value={chronoDisplayMode}
              label="Chrono"
              onChange={(e) => setChronoDisplayMode(e.target.value as typeof chronoDisplayMode)}
            >
              <MenuItem value="gap">Gap</MenuItem>
              <MenuItem value="leader">Leader</MenuItem>
              <MenuItem value="best-lap">Best lap</MenuItem>
              <MenuItem value="last-lap">Last lap</MenuItem>
              <MenuItem value="static">Static</MenuItem>
              <MenuItem value="hidden">Hidden</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Event duration (s)"
            type="number"
            value={eventDuration}
            size="small"
            sx={{ width: 140 }}
            inputProps={{ min: 1 }}
            onChange={(e) => setEventDuration(e.target.value)}
          />

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
            variant="outlined"
            size="small"
            color={countdownRunning ? 'error' : 'primary'}
            startIcon={countdownRunning ? <StopOutlined /> : <PlayArrowOutlined />}
            disabled={!canCountdown && !countdownRunning}
            onClick={() => void toggleCountdown()}
          >
            {countdownRunning ? 'stop' : 'start'}
          </Button>
        </Box>
        <Divider sx={{ my: 1 }} />
        <Button
          size="small"
          variant="contained"
          onClick={() => void handleApply()}
        >
          apply
        </Button>
      </AccordionDetails>
    </Accordion>
  );
}
