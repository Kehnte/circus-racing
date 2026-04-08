// FilterPanel.tsx — Configurable filter stages with live preview toggle.
import Box from '@mui/material/Box';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { FilterConfig, TracePoint } from '../../types';
import { useFilterPreview } from '../../hooks/useFilterPreview';
import { useEffect, useRef } from 'react';

interface Props {
  rawPoints: TracePoint[];
  filterConfig: FilterConfig;
  onChange: (patch: Partial<FilterConfig>) => void;
  onPreviewReady: (filtered: TracePoint[] | null) => void;
  previewEnabled: boolean;
  onTogglePreview: (enabled: boolean) => void;
}

export default function FilterPanel({
  rawPoints,
  filterConfig,
  onChange,
  onPreviewReady,
  previewEnabled,
  onTogglePreview,
}: Props) {
  const { filtered, loading } = useFilterPreview(rawPoints, filterConfig, previewEnabled);

  const onPreviewReadyRef = useRef(onPreviewReady);
  onPreviewReadyRef.current = onPreviewReady;
  useEffect(() => {
    onPreviewReadyRef.current(previewEnabled ? filtered : null);
  }, [filtered, previewEnabled]);

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

      {/* Jump filter */}
      <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={filterConfig.jump_enabled}
                onChange={e => onChange({ jump_enabled: e.target.checked })}
                onClick={e => e.stopPropagation()}
              />
            }
            label={<Typography variant="body2">Jump filter</Typography>}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Removes isolated points jumping more than threshold from both neighbours.
          </Typography>
          <Typography variant="caption">Threshold: {filterConfig.jump_threshold}m</Typography>
          <Slider
            size="small"
            min={50}
            max={2000}
            step={50}
            value={filterConfig.jump_threshold}
            disabled={!filterConfig.jump_enabled}
            onChange={(_e, v) => onChange({ jump_threshold: v as number })}
          />
        </AccordionDetails>
      </Accordion>

      {/* IQR filter */}
      <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
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
            Removes points outside multiplier × IQR per axis.
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

      {/* Angular filter */}
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
            Removes points creating a direction reversal above the angle threshold.
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

      {/* Rolling median */}
      <Accordion disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={filterConfig.rolling_enabled}
                onChange={e => onChange({ rolling_enabled: e.target.checked })}
                onClick={e => e.stopPropagation()}
              />
            }
            label={<Typography variant="body2">Rolling median</Typography>}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Smooths each axis using a rolling median window.
          </Typography>
          <Typography variant="caption">Window: {filterConfig.rolling_window} points</Typography>
          <Slider
            size="small"
            min={3}
            max={21}
            step={2}
            value={filterConfig.rolling_window}
            disabled={!filterConfig.rolling_enabled}
            onChange={(_e, v) => onChange({ rolling_window: v as number })}
          />
        </AccordionDetails>
      </Accordion>

      {previewEnabled && filtered && (
        <Box sx={{ px: 1.5, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Preview: {filtered.filter(p => !p.gap).length} points (raw: {rawPoints.filter(p => !p.gap).length})
          </Typography>
        </Box>
      )}
    </Box>
  );
}
