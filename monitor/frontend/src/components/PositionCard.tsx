// PositionCard.tsx — Live X/Y/Z coordinates from OCR and detection status chip.

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import type { MonitorState } from '../types';

interface Props {
  state: MonitorState | null;
}

const AXES = ['X', 'Y', 'Z'] as const;

function CoordColumn({ axis, value }: { axis: string; value: string }) {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">{axis}</Typography>
      <Typography sx={{ fontFamily: 'Roboto Mono, monospace', fontSize: '1rem' }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function PositionCard({ state }: Props) {
  const pos = state?.position;

  const ocrLabel = state?.last_ocr_at
    ? new Date(state.last_ocr_at).toLocaleTimeString()
    : 'Not detected';
  const ocrColor = state?.last_ocr_at ? 'success' : 'warning';

  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="text.secondary">Position</Typography>
        <Box sx={{ display: 'flex', my: 1.5 }}>
          {AXES.map((axis, i) => (
            <CoordColumn key={axis} axis={axis} value={pos ? pos[i].toFixed(3) : '—'} />
          ))}
        </Box>
        <Chip label={ocrLabel} color={ocrColor} size="medium" />
      </CardContent>
    </Card>
  );
}
