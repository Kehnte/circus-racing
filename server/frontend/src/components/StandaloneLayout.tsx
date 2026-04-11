// StandaloneLayout — Bare layout for DataGrid pages opened in a new window (no AppBar, no sidebar).

import { Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useRaceSocket } from '../hooks/useRaceSocket.ts';
import { StandaloneContext } from '../context/StandaloneContext.tsx';

export default function StandaloneLayout() {
  useRaceSocket();
  return (
    <StandaloneContext.Provider value={true}>
      <Box sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </StandaloneContext.Provider>
  );
}
