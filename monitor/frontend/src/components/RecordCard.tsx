// RecordCard.tsx — Circuit recording controls (visible in RECORD mode only).

import { useState, useRef } from 'react';
import Paper from '@mui/material/Paper';
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

interface Props {
  state: MonitorState;
  onOpenEditor: () => void;
}

export default function RecordCard({ state, onOpenEditor }: Props) {
  const [name, setName] = useState('Circuit');
  const [circuitType, setCircuitType] = useState('LOOP');
  const [alert, setAlert] = useState<{ message: string; severity: AlertColor } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recording = state.recording;
  const hasExport = state.has_export;
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showAlert(err.error ?? 'Action failed', 'error');
      }
    } catch {
      showAlert('Action failed', 'error');
    }
  };

  const handleExport = () => {
    window.open('/api/record/last', '_blank');
  };

  return (
    <Paper elevation={0} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="overline" color="text.secondary">Record</Typography>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          label="Circuit name"
          size="small"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={recording}
          fullWidth
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={circuitType}
            label="Type"
            disabled={recording}
            onChange={(e: SelectChangeEvent) => setCircuitType(e.target.value)}
          >
            <MenuItem value="LOOP">Loop</MenuItem>
            <MenuItem value="POINT_TO_POINT">Point to point</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {recording && (
        <Typography variant="caption" color="text.secondary">
          {count} point{count !== 1 ? 's' : ''} captured
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Tooltip title="Ctrl+Num1" placement="bottom">
          <span>
            <Button variant="contained" disabled={recording} onClick={() => handleMark('start')}>
              Start
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Ctrl+Num2" placement="bottom">
          <span>
            <Button variant="outlined" disabled={!recording} onClick={() => handleMark('checkpoint')}>
              Checkpoint
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Ctrl+Num3" placement="bottom">
          <span>
            <Button variant="contained" color="success" disabled={!recording} onClick={() => handleMark('stop')}>
              Stop
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Ctrl+Num4" placement="bottom">
          <span>
            <Button variant="outlined" color="error" disabled={!recording} onClick={() => handleMark('cancel')}>
              Cancel
            </Button>
          </span>
        </Tooltip>
      </Box>

      {hasExport && !recording && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {state.last_export_name && (
            <Typography variant="caption" color="success.main">
              Saved: {state.last_export_name}.json
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={handleExport}>
              Export JSON
            </Button>
            <Button variant="contained" onClick={onOpenEditor}>
              Open in editor
            </Button>
          </Box>
        </Box>
      )}

      <Collapse in={!!alert}>
        {alert && (
          <Alert severity={alert.severity} onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}
      </Collapse>
    </Paper>
  );
}
