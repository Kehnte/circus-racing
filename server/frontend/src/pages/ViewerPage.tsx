// ViewerPage — Public full-screen viewer mirroring the director's programme output.
// Designed for use as an OBS browser source at /dashboard/viewer.

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Box from '@mui/material/Box';
import ProgramView, { type LayoutMode, type SlotSource } from '../components/streaming/ProgramView.tsx';

interface DirectorLayout { mode: string; slots: (SlotSource | null)[]; }

export default function ViewerPage() {
  const [layout, setLayout] = useState<DirectorLayout>({ mode: 'single', slots: [] });

  useEffect(() => {
    fetch('/api/streaming/director')
      .then((r) => r.ok ? r.json() : null)
      .then((data: DirectorLayout | null) => { if (data) setLayout(data); })
      .catch(() => { /* ignore */ });

    const socket = io(window.location.origin, { path: '/socket.io' });
    socket.on('director-layout', (data: DirectorLayout) => setLayout(data));
    return () => { socket.disconnect(); };
  }, []);

  return (
    <Box sx={{ width: '100vw', height: '100vh', bgcolor: '#000', overflow: 'hidden' }}>
      <ProgramView mode={layout.mode as LayoutMode} slots={layout.slots} fullscreen />
    </Box>
  );
}
