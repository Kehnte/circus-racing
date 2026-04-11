// CaptureTestCard.tsx — Last Alt+T capture test result with anchor position management.

import { useState, useEffect, useRef } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import type { CaptureTestResult } from '../types';

interface Props {
  captureTest: CaptureTestResult | null;
  anchorPosition: [number, number, number] | null;
  anchorRadius: number;
}

async function postAnchor(position: [number, number, number] | null, radius: number) {
  await fetch('/api/anchor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position, radius }),
  });
}

function toStr(v: number | undefined) {
  return v !== undefined ? String(v) : '';
}

export default function CaptureTestCard({ captureTest, anchorPosition, anchorRadius }: Props) {
  const pos = captureTest?.position ?? null;

  const [xInput, setXInput] = useState(toStr(pos?.[0]));
  const [yInput, setYInput] = useState(toStr(pos?.[1]));
  const [zInput, setZInput] = useState(toStr(pos?.[2]));
  const [radiusInput, setRadiusInput] = useState(String(anchorRadius / 1000));

  // Prefill X/Y/Z only when a new capture arrives (keyed on captured_at timestamp)
  const prevCapturedAt = useRef<string | undefined>(undefined);
  useEffect(() => {
    const at = captureTest?.captured_at;
    if (at && at !== prevCapturedAt.current) {
      prevCapturedAt.current = at;
      setXInput(pos?.[0] !== undefined ? String(pos[0] / 1000) : '');
      setYInput(pos?.[1] !== undefined ? String(pos[1] / 1000) : '');
      setZInput(pos?.[2] !== undefined ? String(pos[2] / 1000) : '');
    }
  }, [captureTest, pos]);

  // Sync radius from server only when the value actually changes server-side
  const prevRadiusRef = useRef(anchorRadius);
  useEffect(() => {
    if (anchorRadius !== prevRadiusRef.current) {
      prevRadiusRef.current = anchorRadius;
      setRadiusInput(String(anchorRadius / 1000));
    }
  }, [anchorRadius]);

  // Inputs are in km (as displayed in-game) — convert to metres for backend
  const x = parseFloat(xInput) * 1000;
  const y = parseFloat(yInput) * 1000;
  const z = parseFloat(zInput) * 1000;
  const rKm = parseFloat(radiusInput);
  const r = rKm * 1000; // km → m for backend
  const anchorInputValid = !isNaN(x) && !isNaN(y) && !isNaN(z) && !isNaN(rKm) && rKm > 0;

  return (
    <Paper elevation={0} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="overline" color="text.secondary">Capture test</Typography>

      <Typography variant="caption" color="text.secondary">
        Press <strong>Alt+T</strong> in-game to test your capture zone.
      </Typography>

      {captureTest && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={captureTest.ok ? 'Capture OK' : 'Capture failed'}
              color={captureTest.ok ? 'success' : 'error'}
              size="small"
            />
            <Typography variant="caption" color="text.secondary">
              {new Date(captureTest.captured_at).toLocaleTimeString()}
            </Typography>
          </Box>

          {captureTest.image_b64 && (
            <Box
              component="img"
              src={`data:image/png;base64,${captureTest.image_b64}`}
              alt="Captured zone"
              sx={{ width: '100%', imageRendering: 'pixelated', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            />
          )}

          <Box>
            <Typography variant="caption" color="text.secondary" display="block">OCR text</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {captureTest.ocr_text || '—'}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Anchor editor — always visible, prefilled from last capture if available */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block">Set anchor position</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" label="X" value={xInput} onChange={e => setXInput(e.target.value)} sx={{ flex: 1 }} slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }} />
          <TextField size="small" label="Y" value={yInput} onChange={e => setYInput(e.target.value)} sx={{ flex: 1 }} slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }} />
          <TextField size="small" label="Z" value={zInput} onChange={e => setZInput(e.target.value)} sx={{ flex: 1 }} slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            type="number"
            label="Radius (km)"
            value={radiusInput}
            onChange={e => setRadiusInput(e.target.value)}
            slotProps={{ htmlInput: { min: 0.001, step: 10 } }}
            sx={{ width: 140 }}
          />
          <Button
            size="small"
            variant="outlined"
            disabled={!anchorInputValid}
            onClick={() => postAnchor([x, y, z], r)}
          >
            set as anchor
          </Button>
        </Box>
      </Box>

      {/* Current anchor status */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary" display="block">Current anchor</Typography>
        {anchorPosition ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1 }}>
              {anchorPosition.map(v => (v / 1000).toFixed(4)).join(', ')}
            </Typography>
            <Button size="small" color="error" onClick={() => postAnchor(null, r > 0 ? r : anchorRadius)}>
              clear
            </Button>
          </Box>
        ) : (
          <Typography variant="caption" color="text.disabled">No anchor set</Typography>
        )}
      </Box>
    </Paper>
  );
}
