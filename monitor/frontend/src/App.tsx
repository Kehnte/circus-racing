// App.tsx — Root component composing the monitor UI cards.

import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import { useMonitorState } from './hooks/useMonitorState';
import AppHeader from './components/AppHeader';
import ModeCard from './components/ModeCard';
import PositionCard from './components/PositionCard';
import RecordCard from './components/RecordCard';
import ConfigCard from './components/ConfigCard';

async function setMode(mode: 'RACE' | 'RECORD') {
  await fetch('/api/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
}

export default function App() {
  const { state, error } = useMonitorState();
  const isRecord = state?.mode === 'RECORD';

  return (
    <>
      <AppHeader state={state} pollError={error} />
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 2 }}>
          <ModeCard mode={state?.mode} onSetMode={setMode} />
          <PositionCard state={state} />
          {isRecord && state && <RecordCard state={state} />}
          <ConfigCard recordMode={isRecord} />
        </Box>
      </Container>
    </>
  );
}
