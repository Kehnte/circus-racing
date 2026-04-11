// FilterPanel.tsx — Configurable filter stages with live preview toggle.
import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { FilterConfig, TracePoint } from '../../types';
import { useFilterPreview } from '../../hooks/useFilterPreview';

interface Props {
  rawPoints: TracePoint[];
  filterConfig: FilterConfig;
  onChange: (patch: Partial<FilterConfig>) => void;
  onPreviewReady: (filtered: TracePoint[] | null) => void;
  onApply: (filtered: TracePoint[]) => void;
  previewEnabled: boolean;
  onTogglePreview: (enabled: boolean) => void;
}

export default function FilterPanel({
  rawPoints,
  filterConfig,
  onChange,
  onPreviewReady,
  onApply,
  previewEnabled,
  onTogglePreview,
}: Props) {
  const { filtered, loading } = useFilterPreview(rawPoints, filterConfig, previewEnabled);

  const onPreviewReadyRef = useRef(onPreviewReady);
  onPreviewReadyRef.current = onPreviewReady;
  useEffect(() => {
    onPreviewReadyRef.current(previewEnabled ? filtered : null);
  }, [filtered, previewEnabled]);

  const rawCount = rawPoints.filter(p => !p.gap).length;
  const filteredCount = filtered ? filtered.filter(p => !p.gap).length : null;

  return (
    <Box sx={{ width: 280, overflowY: 'auto', borderRight: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="overline" sx={{ flex: 1 }}>Filters</Typography>
        {loading && <CircularProgress size={14} />}
        <FormControlLabel
          control={<Switch size="small" checked={previewEnabled} onChange={e => onTogglePreview(e.target.checked)} />}
          label={<Typography variant="caption">Preview</Typography>}
          labelPlacement="start"
          sx={{ mr: 0 }}
        />
      </Box>

      {/* Step 1 — IQR filter */}
      <Accordion disableGutters elevation={0} defaultExpanded sx={{ '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={filterConfig.iqr_enabled}
                onChange={e => onChange({ iqr_enabled: e.target.checked })}
                onClick={e => e.stopPropagation()}
              />
            }
            label={<Typography variant="body2">IQR filter</Typography>}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Removes points outside multiplier × IQR per axis. Runs two passes to catch subtler outliers.
          </Typography>
          <Typography variant="caption">Multiplier: {filterConfig.iqr_multiplier.toFixed(1)}×</Typography>
          <Slider
            size="small"
            min={0.5}
            max={5.0}
            step={0.1}
            value={filterConfig.iqr_multiplier}
            disabled={!filterConfig.iqr_enabled}
            onChange={(_e, v) => onChange({ iqr_multiplier: v as number })}
          />
        </AccordionDetails>
      </Accordion>

      {/* Step 2 — Speed filter */}
      <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={filterConfig.speed_enabled}
                onChange={e => onChange({ speed_enabled: e.target.checked })}
                onClick={e => e.stopPropagation()}
              />
            }
            label={<Typography variant="body2">Speed filter</Typography>}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Removes points where speed to both neighbours exceeds the threshold. Iterates until stable.
          </Typography>
          <TextField
            size="small"
            type="number"
            label="Max speed (m/s)"
            value={filterConfig.speed_max_ms}
            disabled={!filterConfig.speed_enabled}
            onChange={e => {
              const v = parseFloat(e.target.value);
              if (v > 0) onChange({ speed_max_ms: v });
            }}
            inputProps={{ min: 1, step: 100 }}
            sx={{ width: 160 }}
          />
        </AccordionDetails>
      </Accordion>

      {/* Step 3 — Angular filter */}
      <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={filterConfig.angular_enabled}
                onChange={e => onChange({ angular_enabled: e.target.checked })}
                onClick={e => e.stopPropagation()}
              />
            }
            label={<Typography variant="body2">Angular filter</Typography>}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Removes points creating a direction reversal above the angle threshold. Iterates until stable.
          </Typography>
          <Typography variant="caption">Max angle: {filterConfig.angular_max_angle}°</Typography>
          <Slider
            size="small"
            min={30}
            max={175}
            step={5}
            value={filterConfig.angular_max_angle}
            disabled={!filterConfig.angular_enabled}
            onChange={(_e, v) => onChange({ angular_max_angle: v as number })}
          />
        </AccordionDetails>
      </Accordion>

      {/* Step 4 — RDP simplification */}
      <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={filterConfig.rdp_enabled}
                onChange={e => onChange({ rdp_enabled: e.target.checked })}
                onClick={e => e.stopPropagation()}
              />
            }
            label={<Typography variant="body2">Simplify (RDP)</Typography>}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Reduces point count using Ramer-Douglas-Peucker. Straight lines become 2 points, curves keep their shape within the tolerance.
          </Typography>
          <TextField
            size="small"
            type="number"
            label="Tolerance (m)"
            value={filterConfig.rdp_tolerance}
            disabled={!filterConfig.rdp_enabled}
            onChange={e => {
              const v = parseFloat(e.target.value);
              if (v > 0) onChange({ rdp_tolerance: v });
            }}
            inputProps={{ min: 0.1, step: 0.5 }}
            sx={{ width: 160 }}
          />
        </AccordionDetails>
      </Accordion>

      {previewEnabled && filtered && (
        <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Preview: {filteredCount} points (raw: {rawCount})
          </Typography>
          <Button variant="contained" size="small" onClick={() => onApply(filtered)}>
            apply filter
          </Button>
        </Box>
      )}
    </Box>
  );
}
