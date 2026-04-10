// FilterPanel.tsx — Configurable filter stages with live preview toggle.
import { useMemo } from 'react';
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
import { useEffect, useRef } from 'react';
import { dist3 } from '../../hooks/useEditorState';

interface Props {
  rawPoints: TracePoint[];
  filterConfig: FilterConfig;
  onChange: (patch: Partial<FilterConfig>) => void;
  onPreviewReady: (filtered: TracePoint[] | null) => void;
  onApply: (filtered: TracePoint[]) => void;
  previewEnabled: boolean;
  onTogglePreview: (enabled: boolean) => void;
}

export /** Find the threshold that best separates normal jumps from aberrant ones.
 *  Looks for the largest multiplicative gap in the sorted distance distribution. */
function suggestJumpThreshold(points: TracePoint[]): number | null {
  const real = points.filter(p => !p.gap);
  if (real.length < 3) return null;
  const dists: number[] = [];
  for (let i = 1; i < real.length; i++) {
    dists.push(dist3(real[i].position, real[i - 1].position));
  }
  dists.sort((a, b) => a - b);
  // Find the biggest multiplicative jump between consecutive sorted distances
  let bestRatio = 0;
  let bestIdx = -1;
  for (let i = 1; i < dists.length; i++) {
    if (dists[i - 1] < 0.01) continue;
    const ratio = dists[i] / dists[i - 1];
    if (ratio > bestRatio) { bestRatio = ratio; bestIdx = i; }
  }
  if (bestIdx < 0 || bestRatio < 5) return null; // no clear gap
  // Suggest midpoint between the last normal and first aberrant
  return Math.round((dists[bestIdx - 1] + dists[bestIdx]) / 2);
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

  // Jump stats computed from raw points + current threshold
  const jumpStats = useMemo(() => {
    const real = rawPoints.filter(p => !p.gap);
    if (real.length < 2) return null;
    const dists: number[] = [];
    for (let i = 1; i < real.length; i++) {
      dists.push(dist3(real[i].position, real[i - 1].position));
    }
    dists.sort((a, b) => a - b);
    const median = dists[Math.floor(dists.length / 2)];
    const largest = dists[dists.length - 1];
    // Count points that would be removed by jump filter at current threshold
    let removed = 0;
    const threshold = filterConfig.jump_threshold;
    for (let i = 1; i < real.length - 1; i++) {
      const dPrev = dist3(real[i].position, real[i - 1].position);
      const dNext = dist3(real[i].position, real[i + 1].position);
      if (dPrev > threshold && dNext > threshold) removed++;
    }
    return { median, largest, removed };
  }, [rawPoints, filterConfig.jump_threshold]);

  const sliderMax = jumpStats ? Math.max(jumpStats.largest, filterConfig.jump_threshold) : 10000;
  const sliderStep = Math.max(1, Math.round(sliderMax / 200));

  function handleSuggest() {
    const suggested = suggestJumpThreshold(rawPoints);
    if (suggested !== null) onChange({ jump_threshold: suggested });
  }

  function formatDist(m: number): string {
    if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
    return `${Math.round(m)}m`;
  }

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

          {jumpStats && (
            <Box sx={{ mb: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Typography variant="caption" color="text.secondary">
                Largest: {formatDist(jumpStats.largest)} · Median: {formatDist(jumpStats.median)}
              </Typography>
              <Typography variant="caption" color={jumpStats.removed > 0 ? 'warning.main' : 'text.secondary'}>
                Would remove: {jumpStats.removed} point{jumpStats.removed !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <TextField
              size="small"
              type="number"
              label="Threshold (m)"
              value={filterConfig.jump_threshold}
              disabled={!filterConfig.jump_enabled}
              onChange={e => {
                const v = parseFloat(e.target.value);
                if (v > 0) onChange({ jump_threshold: v });
              }}
              inputProps={{ min: 1, step: sliderStep }}
              sx={{ width: 130 }}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={!filterConfig.jump_enabled}
              onClick={handleSuggest}
            >
              suggest
            </Button>
          </Box>

          <Slider
            size="small"
            min={0}
            max={sliderMax}
            step={sliderStep}
            value={Math.min(filterConfig.jump_threshold, sliderMax)}
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
        <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Preview: {filtered.filter(p => !p.gap).length} points (raw: {rawPoints.filter(p => !p.gap).length})
          </Typography>
          <Button
            variant="contained"
            size="small"
            onClick={() => onApply(filtered)}
          >
            apply filter
          </Button>
        </Box>
      )}
    </Box>
  );
}
