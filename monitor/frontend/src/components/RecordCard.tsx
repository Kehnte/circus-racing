// RecordCard.tsx — Circuit recording controls (visible in RECORD mode only).

import { useState, useRef } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import type { AlertColor } from '@mui/material/Alert';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { MonitorState } from '../types';

const MARK_LABELS: Record<string, string> = {
  start: 'Recording started',
  checkpoint: 'Checkpoint added',
  finish: 'Recording finished',
  cancel: 'Recording cancelled',
};

interface Props {
  state: MonitorState;
}

export default function RecordCard({ state }: Props) {
  const [name, setName] = useState('Circuit');
  const [circuitType, setCircuitType] = useState('LOOP');
  const [alert, setAlert] = useState<{ message: string; severity: AlertColor } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const started = state.recording;
  const count = state.trace_count;

  const showAlert = (message: string, severity: AlertColor) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAlert({ message, severity });
    timerRef.current = setTimeout(() => setAlert(null), 3000);
  };

  const handleMark = async (action: string) => {
    try {
      const res = await fetch('/api/record/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, name, circuit_type: circuitType }),
      });
      if (res.ok) {
        showAlert(MARK_LABELS[action], action === 'cancel' ? 'warning' : 'success');
      } else {
        showAlert('Action failed', 'error');
      }
    } catch {
      showAlert('Action failed', 'error');
    }
  };

  return (
    <Card>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="overline" color="text.secondary">Record</Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            label="Circuit name"
            size="small"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Type</InputLabel>
            <Select value={circuitType} label="Type" onChange={(e: SelectChangeEvent) => setCircuitType(e.target.value)}>
              <MenuItem value="LOOP">Loop</MenuItem>
              <MenuItem value="POINT_TO_POINT">Point to point</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Ctrl+Num1" placement="bottom">
            <span>
              <Button variant="contained" disabled={started} onClick={() => handleMark('start')}>
                Start
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Ctrl+Num2" placement="bottom">
            <span>
              <Button variant="outlined" disabled={!started} onClick={() => handleMark('checkpoint')}>
                Checkpoint
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Ctrl+Num3" placement="bottom">
            <span>
              <Button variant="contained" color="success" disabled={!started} onClick={() => handleMark('finish')}>
                Finish
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Ctrl+Num4" placement="bottom">
            <Button variant="outlined" color="error" onClick={() => handleMark('cancel')}>
              Cancel
            </Button>
          </Tooltip>
        </Box>

        <Typography variant="caption" color="text.secondary">
          {count} point{count !== 1 ? 's' : ''} recorded
        </Typography>

        <Collapse in={!!alert}>
          {alert && (
            <Alert
              severity={alert.severity}
              onClose={() => setAlert(null)}
            >
              {alert.message}
            </Alert>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
}
