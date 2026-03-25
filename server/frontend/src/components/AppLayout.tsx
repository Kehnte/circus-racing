// AppLayout — Full-width AppBar (toggle + logo + page title) with independent collapsible sidebar.

import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CampaignOutlined from '@mui/icons-material/CampaignOutlined';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import LeaderboardOutlined from '@mui/icons-material/LeaderboardOutlined';
import MenuOpenOutlined from '@mui/icons-material/MenuOpenOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import RouteOutlined from '@mui/icons-material/RouteOutlined';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import { useAuth } from '../context/AuthContext.tsx';

const DRAWER_WIDTH = 240;
const MINI_WIDTH = 64;

const NAV_SECTIONS = [
  {
    label: 'Race',
    items: [
      { label: 'Dashboard', path: '/', icon: <SpaceDashboardOutlined /> },
      { label: 'Leaderboard', path: '', href: '/overlays/leaderboard/', icon: <LeaderboardOutlined /> },
      { label: 'Race Alert', path: '', href: '/overlays/race-alert/', icon: <CampaignOutlined /> },
    ],
  },
  {
    label: 'Roster',
    items: [
      { label: 'Pilots', path: '/pilots', icon: <PersonOutlined /> },
      { label: 'Teams', path: '/teams', icon: <GroupsOutlined /> },
      { label: 'Vehicles', path: '/vehicles', icon: <RocketLaunchOutlined /> },
      { label: 'Controls', path: '/controls', icon: <TuneOutlined /> },
      { label: 'Circuits', path: '/circuits', icon: <RouteOutlined /> },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/pilots': 'Pilots',
  '/teams': 'Teams',
  '/vehicles': 'Vehicles',
  '/controls': 'Controls',
  '/circuits': 'Circuits',
};

function resolvePageTitle(pathname: string): string {
  const match = Object.keys(PAGE_TITLES)
    .filter((k) => pathname === k || (k !== '/' && pathname.startsWith(k + '/')))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLES[match] : 'Circus Racing';
}

export default function AppLayout() {
  const { logout, displayName } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const pageTitle = resolvePageTitle(pathname);


  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Spacer matching AppBar height */}
      <Toolbar sx={{ minHeight: 64 }} />
      <Box sx={{ overflow: 'hidden', flex: 1 }}>
        {NAV_SECTIONS.map((section) => (
          <Box key={section.label}>
            {open && (
              <Typography
                variant="overline"
                sx={{ px: 2, display: 'block', color: 'text.secondary' }}
              >
                {section.label}
              </Typography>
            )}
            {!open && <Box sx={{ height: 8 }} />}
            <List dense disablePadding>
              {section.items.map((item) => {
                const active = !item.href && (pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path + '/')));
                return (
                  <Tooltip title={open ? '' : item.label} placement="right">
                    <ListItemButton
                      key={item.label}
                      selected={active}
                      onClick={() => item.href ? window.open(item.href, '_blank') : navigate(item.path)}
                      sx={{ px: open ? 2 : 0, justifyContent: 'center' }}
                    >
                      <ListItemIcon
                        sx={{
                          color: active ? 'primary.main' : 'inherit',
                          minWidth: open ? 36 : 'unset',
                          justifyContent: 'center',
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      {open && (
                        <ListItemText
                          primary={item.label}
                          slotProps={{
                            primary: { fontWeight: active ? 700 : 500, fontSize: 14 },
                          }}
                        />
                      )}
                    </ListItemButton>
                  </Tooltip>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <AppBar position="fixed" elevation={0} sx={{ width: '100%', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            onClick={() => setOpen((v) => !v)}
            edge="start"
            sx={{ mr: 1 }}
            title={open ? 'Collapse menu' : 'Expand menu'}
          >
            {open ? <MenuOpenOutlined /> : <MenuOutlined />}
          </IconButton>
          <EmojiEventsOutlined sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
            {pageTitle}
          </Typography>
          <Tooltip title="Account settings">
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" sx={{ ml: 1 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
                {displayName ? displayName[0].toUpperCase() : <PersonOutlined fontSize="small" />}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            slotProps={{ paper: { elevation: 2, sx: { minWidth: 140 } } }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={() => { void navigate('/profile'); setAnchorEl(null); }}>Profile</MenuItem>
            <MenuItem onClick={() => { logout(); setAnchorEl(null); }}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={(theme) => ({
          width: open ? DRAWER_WIDTH : MINI_WIDTH,
          flexShrink: 0,
          transition: theme.transitions.create(['width'], {
            easing: open ? theme.transitions.easing.sharp : theme.transitions.easing.easeOut,
            duration: open ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen,
          }),
          '& .MuiDrawer-paper': {
            width: open ? DRAWER_WIDTH : MINI_WIDTH,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            overflowX: 'hidden',
            transition: theme.transitions.create(['width'], {
              easing: open ? theme.transitions.easing.sharp : theme.transitions.easing.easeOut,
              duration: open ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen,
            }),
          },
        })}
      >
        {drawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <Toolbar /> {/* AppBar spacer */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3, display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
