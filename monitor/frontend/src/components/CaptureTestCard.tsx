// CaptureTestCard.tsx — Last Alt+T capture test result.

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import type { CaptureTestResult } from '../types';

interface Props {
  captureTest: CaptureTestResult | null;
}

export default function CaptureTestCard({ captureTest }: Props) {
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

          <Box>
            <Typography variant="caption" color="text.secondary" display="block">Parsed position</Typography>
            {captureTest.position ? (
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {captureTest.position.map(v => v.toFixed(3)).join(', ')}
              </Typography>
            ) : (
              <Typography variant="body2" color="error.main">Failed to parse</Typography>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
