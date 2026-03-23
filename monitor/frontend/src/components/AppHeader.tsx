// AppHeader.tsx — Top bar with server connectivity status chips.

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import type { MonitorState } from '../types';

interface Props {
  state: MonitorState | null;
  pollError: boolean;
}

export default function AppHeader({ state, pollError }: Props) {
  const serverOk = !pollError && !!state?.server_reachable;
  const sendStatus = state?.last_send_status;
  const sendOk = state?.server_ok ?? false;
  const sendDim = sendStatus === null || sendStatus === undefined;

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar variant="dense" sx={{ gap: 1 }}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 700, fontStyle: 'italic' }}>
          Circus Racing Monitor
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            label={serverOk ? 'Connected' : 'Unreachable'}
            color={serverOk ? 'success' : 'error'}
            size="medium"
          />
          <Chip
            label={sendDim ? 'Pending' : sendOk ? 'Sent' : 'Failed'}
            color={sendDim ? 'default' : sendOk ? 'success' : 'error'}
            size="medium"
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
