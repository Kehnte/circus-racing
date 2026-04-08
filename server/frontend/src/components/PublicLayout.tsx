// PublicLayout — App bar for unauthenticated pages with Sign in / Sign up actions.

import { useNavigate, Outlet } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';

export default function PublicLayout() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" elevation={0}>
        <Toolbar>
          <EmojiEventsOutlined sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
            Circus Racing
          </Typography>
          <Button color="inherit" onClick={() => void navigate('/login')}>Sign in</Button>
          <Button color="inherit" onClick={() => void navigate('/register')}>Sign up</Button>
        </Toolbar>
      </AppBar>
      <Toolbar />
      <Outlet />
    </Box>
  );
}
