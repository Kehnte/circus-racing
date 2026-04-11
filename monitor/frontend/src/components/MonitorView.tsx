// MonitorView.tsx — The main monitor card stack (extracted from App).
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import type { MonitorState } from '../types';
import ModeCard from './ModeCard';
import PositionCard from './PositionCard';
import RecordCard from './RecordCard';
import ConfigCard from './ConfigCard';
import CaptureTestCard from './CaptureTestCard';

async function setMode(mode: 'RACE' | 'RECORD') {
  await fetch('/api/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
}

interface Props {
  state: MonitorState | null;
  onOpenEditor: () => void;
}

export default function MonitorView({ state, onOpenEditor }: Props) {
  const isRecord = state?.mode === 'RECORD';
  return (
    <Container maxWidth="sm">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2 }}>
        <ModeCard mode={state?.mode} onSetMode={setMode} />
        <PositionCard state={state} />
        {isRecord && state && <RecordCard state={state} onOpenEditor={onOpenEditor} />}
        <CaptureTestCard
          captureTest={state?.last_capture_test ?? null}
          anchorPosition={state?.anchor_position ?? null}
          anchorRadius={state?.anchor_radius ?? 500000}
        />
        <ConfigCard recordMode={isRecord} />
      </Box>
    </Container>
  );
}
