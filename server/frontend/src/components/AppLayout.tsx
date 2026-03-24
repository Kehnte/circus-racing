// AppLayout — Collapsible sidebar (mini/full) with navigation groups, AppBar with toggle and logo.

import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import MenuOpenOutlined from '@mui/icons-material/MenuOpenOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import RouteOutlined from '@mui/icons-material/RouteOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import { useAuth } from '../context/AuthContext.tsx';

const DRAWER_WIDTH = 240;
const MINI_WIDTH = 64;

const NAV_SECTIONS = [
  {
    label: 'Race',
    items: [{ label: 'Dashboard', path: '/', icon: <SpaceDashboardOutlined /> }],
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
  {
    label: 'App',
    items: [{ label: 'Settings', path: '/settings', icon: <SettingsOutlined /> }],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/pilots': 'Pilots',
  '/teams': 'Teams',
  '/vehicles': 'Vehicles',
  '/controls': 'Controls',
  '/circuits': 'Circuits',
  '/settings': 'Settings',
};

export default function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(true);

  const pageTitle = PAGE_TITLES[pathname] ?? 'Circus Racing';


  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo area — keeps same height as AppBar Toolbar */}
      <Toolbar sx={{ px: 2, minHeight: 64 }} />
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
                const active = pathname === item.path;
                const button = (
                  <ListItemButton
                    key={item.path}
                    selected={active}
                    onClick={() => navigate(item.path)}
                    sx={{ pl: open ? 2 : 0, justifyContent: open ? 'flex-start' : 'center' }}
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
                );
                return open ? button : (
                  <Tooltip key={item.path} title={item.label} placement="right">
                    {button}
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
      <AppBar
        position="fixed"
        elevation={0}
        sx={(theme) => ({
          width: `calc(100% - ${open ? DRAWER_WIDTH : MINI_WIDTH}px)`,
          ml: `${open ? DRAWER_WIDTH : MINI_WIDTH}px`,
          transition: theme.transitions.create(['width', 'margin-left'], {
            easing: open ? theme.transitions.easing.sharp : theme.transitions.easing.easeOut,
            duration: open ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen,
          }),
        })}
      >
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
          <IconButton color="inherit" onClick={logout} title="Sign out">
            <LogoutOutlined />
          </IconButton>
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
            borderRight: 'none',
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
