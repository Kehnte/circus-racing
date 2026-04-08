// ConfigCard.tsx — Collapsible configuration panel using MUI Accordion.

import { useState, useRef } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import type { AlertColor } from '@mui/material/Alert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { MonitorConfig, MonitorInfo } from '../types';

// OCR tokens are 64-char lowercase hex strings (crypto.randomBytes(32).toString('hex')).
const TOKEN_REGEX = /^[0-9a-f]{64}$/;

interface Props {
  recordMode: boolean;
}

export default function ConfigCard({ recordMode }: Props) {
  const [tokenVisible, setTokenVisible] = useState(false);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [alert, setAlert] = useState<{ message: string; severity: AlertColor } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAlert = (message: string, severity: AlertColor) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAlert({ message, severity });
    timerRef.current = setTimeout(() => setAlert(null), 3000);
  };
  const [cfg, setCfg] = useState<MonitorConfig>({
    token: '',
    url: '',
    monitor_index: 1,
    delta_time_s: 1,
    record_delta_time_s: 0.5,
    checkpoint_save: false,
    checkpoint_save_distance: 150,
    auto_checkpoint_spacing: 150,
    hotkey_test_capture: 'alt+t',
    hotkey_record_start: 'alt+num 1',
    hotkey_record_checkpoint: 'alt+num 2',
    hotkey_record_finish: 'alt+num 3',
    hotkey_record_cancel: 'alt+num 4',
    filter_jump_enabled: true,
    filter_jump_threshold: 500,
    filter_iqr_enabled: true,
    filter_iqr_multiplier: 1.5,
    filter_angular_enabled: true,
    filter_angular_max_angle: 120,
    filter_rolling_enabled: true,
    filter_rolling_window: 5,
  });

  const tokenError = cfg.token.length > 0 && !TOKEN_REGEX.test(cfg.token);

  const handleExpand = async (_: React.SyntheticEvent, expanded: boolean) => {
    if (!expanded || loaded) return;
    const [cfgRes, monRes] = await Promise.all([fetch('/api/config'), fetch('/api/monitors')]);
    if (cfgRes.ok) setCfg(await cfgRes.json());
    if (monRes.ok) setMonitors(await monRes.json());
    setLoaded(true);
  };

  const handleSave = async () => {
    if (tokenError || !cfg.token || !cfg.url) return;
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      showAlert(res.ok ? 'Configuration saved' : 'Failed to save configuration', res.ok ? 'success' : 'error');
    } catch {
      showAlert('Failed to save configuration', 'error');
    }
  };

  const set = <K extends keyof MonitorConfig>(key: K, value: MonitorConfig[K]) =>
    setCfg(prev => ({ ...prev, [key]: value }));

  return (
    <Accordion onChange={handleExpand}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="overline">Configuration</Typography>
      </AccordionSummary>

      <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

        <TextField
          label="Token"
          required
          size="small"
          type={tokenVisible ? 'text' : 'password'}
          value={cfg.token}
          onChange={e => set('token', e.target.value)}
          error={tokenError}
          helperText={tokenError ? 'Expected 64-character hex token (from your pilot profile)' : ' '}
          slotProps={{ input: { endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" edge="end" onClick={() => setTokenVisible(v => !v)}>
                {tokenVisible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </IconButton>
            </InputAdornment>
          )}}}
        />

        <TextField
          label="Server URL"
          required
          size="small"
          type="url"
          value={cfg.url}
          onChange={e => set('url', e.target.value)}
          helperText=" "
        />

        {monitors.length > 0 && (
          <FormControl size="small" fullWidth>
            <InputLabel>Monitor</InputLabel>
            <Select
              label="Monitor"
              value={String(cfg.monitor_index)}
              onChange={(e: SelectChangeEvent) => set('monitor_index', parseInt(e.target.value))}
            >
              {monitors.map(m => (
                <MenuItem key={m.index} value={String(m.index)}>
                  Monitor {m.index} — {m.width}×{m.height}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {recordMode && (
          <TextField
            label="Auto checkpoint spacing (m)"
            size="small"
            type="number"
            slotProps={{ htmlInput: { min: 50, step: 10 } }}
            value={cfg.auto_checkpoint_spacing}
            onChange={e => set('auto_checkpoint_spacing', parseFloat(e.target.value) || 150)}
          />
        )}

        <Typography variant="overline" color="text.secondary">Hotkeys</Typography>

        {([
          { key: 'hotkey_test_capture',      label: 'Test capture' },
          { key: 'hotkey_record_start',      label: 'Record start' },
          { key: 'hotkey_record_checkpoint', label: 'Record checkpoint' },
          { key: 'hotkey_record_finish',     label: 'Record finish' },
          { key: 'hotkey_record_cancel',     label: 'Record cancel' },
        ] as { key: keyof MonitorConfig; label: string }[]).map(({ key, label }) => {
          const val = String(cfg[key]);
          const valid = /^[a-z0-9]/.test(val) && val.includes('+') && val.split('+').every(p => p.trim().length > 0);
          return (
            <TextField
              key={key}
              label={label}
              size="small"
              value={val}
              onChange={e => set(key, e.target.value)}
              placeholder="e.g. alt+num 1"
              error={val.length > 0 && !valid}
              helperText={val.length > 0 && !valid ? 'Format: modifier+key — e.g. alt+t, alt+num 1, ctrl+f5' : ' '}
            />
          );
        })}

        <Typography variant="overline" color="text.secondary">Filters</Typography>

        {([
          { key: 'filter_jump_enabled' as const, label: 'Jump filter', threshKey: 'filter_jump_threshold' as const, threshLabel: 'Threshold (m)', min: 50, max: 2000, step: 50 },
          { key: 'filter_iqr_enabled' as const,  label: 'IQR filter',  threshKey: 'filter_iqr_multiplier' as const,  threshLabel: 'Multiplier',    min: 0.5, max: 5, step: 0.1 },
          { key: 'filter_angular_enabled' as const, label: 'Angular filter', threshKey: 'filter_angular_max_angle' as const, threshLabel: 'Max angle (°)', min: 30, max: 175, step: 5 },
        ] as { key: keyof MonitorConfig; label: string; threshKey: keyof MonitorConfig; threshLabel: string; min: number; max: number; step: number }[]).map(({ key, label, threshKey, threshLabel, min, max, step }) => (
          <Box key={String(key)} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={!!cfg[key]}
                  onChange={e => set(key, e.target.checked)}
                />
              }
              label={<Typography variant="body2">{label}</Typography>}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
              <Typography variant="caption" sx={{ minWidth: 100 }}>{threshLabel}: {Number(cfg[threshKey]).toFixed(step < 1 ? 1 : 0)}</Typography>
              <Slider
                size="small"
                min={min}
                max={max}
                step={step}
                value={Number(cfg[threshKey])}
                disabled={!cfg[key]}
                onChange={(_e, v) => set(threshKey, v as number)}
                sx={{ flex: 1 }}
              />
            </Box>
          </Box>
        ))}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={!!cfg.filter_rolling_enabled}
                onChange={e => set('filter_rolling_enabled', e.target.checked)}
              />
            }
            label={<Typography variant="body2">Rolling median</Typography>}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
            <Typography variant="caption" sx={{ minWidth: 100 }}>Window: {cfg.filter_rolling_window} pts</Typography>
            <Slider
              size="small"
              min={3}
              max={21}
              step={2}
              value={cfg.filter_rolling_window}
              disabled={!cfg.filter_rolling_enabled}
              onChange={(_e, v) => set('filter_rolling_window', v as number)}
              sx={{ flex: 1 }}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton
            color="primary"
            onClick={handleSave}
            disabled={tokenError || !cfg.token || !cfg.url}
          >
            <SaveIcon />
          </IconButton>
        </Box>

        <Collapse in={!!alert}>
          {alert && (
            <Alert severity={alert.severity} onClose={() => setAlert(null)}>
              {alert.message}
            </Alert>
          )}
        </Collapse>

      </AccordionDetails>
    </Accordion>
  );
}
