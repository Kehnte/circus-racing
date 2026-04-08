// AppHeader.tsx — Top bar with status chips and Monitor/Editor tab navigation.
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';
import type { MonitorState } from '../types';

export type AppTab = 'monitor' | 'editor';

interface Props {
  state: MonitorState | null;
  pollError: boolean;
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export default function AppHeader({ state, pollError, tab, onTabChange }: Props) {
  const serverOk = !pollError && !!state?.server_reachable;
  const sendStatus = state?.last_send_status;
  const sendOk = state?.server_ok ?? false;
  const sendDim = sendStatus === null || sendStatus === undefined;

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar sx={{ gap: 1 }}>
        <EmojiEventsOutlined sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" fontWeight={800} fontStyle="italic" sx={{ flexGrow: 1 }}>
          Circus Racing
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            label={serverOk ? 'Connected' : 'Unreachable'}
            color={serverOk ? 'success' : 'error'}
            size="small"
          />
          <Chip
            label={sendDim ? 'Pending' : sendOk ? 'Sent' : 'Failed'}
            color={sendDim ? 'default' : sendOk ? 'success' : 'error'}
            size="small"
          />
        </Box>
      </Toolbar>
      <Tabs
        value={tab}
        onChange={(_e, v: AppTab) => onTabChange(v)}
        variant="fullWidth"
        sx={{ minHeight: 36, borderTop: '1px solid', borderColor: 'divider' }}
        TabIndicatorProps={{ style: { height: 2 } }}
      >
        <Tab label="Monitor" value="monitor" sx={{ minHeight: 36, py: 0 }} />
        <Tab label="Editor" value="editor" sx={{ minHeight: 36, py: 0 }} />
      </Tabs>
    </AppBar>
  );
}
