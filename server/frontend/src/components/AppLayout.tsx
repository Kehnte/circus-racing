// AppLayout — Full-width AppBar (toggle + logo + page title) with independent collapsible sidebar.

import { useState, type ReactNode } from 'react';
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
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import CampaignOutlined from '@mui/icons-material/CampaignOutlined';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import LeaderboardOutlined from '@mui/icons-material/LeaderboardOutlined';
import MenuOpenOutlined from '@mui/icons-material/MenuOpenOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import SensorsOutlined from '@mui/icons-material/SensorsOutlined';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import TvOutlined from '@mui/icons-material/TvOutlined';
import useSWR from 'swr';
import { fetcher } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useFeatures } from '../context/FeaturesContext.tsx';
import { useRaceSocket } from '../hooks/useRaceSocket.ts';
import type { Pilot } from '../types.ts';

const DRAWER_WIDTH = 240;
const MINI_WIDTH = 64;

interface NavItem { label: string; path: string; href?: string; icon: ReactNode }
interface NavSection { label: string; items: NavItem[] }

const NAV_SECTIONS_MODO: NavSection[] = [
  {
    label: 'Race',
    items: [
      { label: 'Dashboard', path: '/', icon: <SpaceDashboardOutlined /> },
      { label: 'Telemetry', path: '/telemetry', icon: <SensorsOutlined /> },
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
    ],
  },
];

const NAV_SECTIONS_PILOT: NavSection[] = [
  {
    label: 'Race',
    items: [
      { label: 'Dashboard', path: '/', icon: <SpaceDashboardOutlined /> },
    ],
  },
];


export default function AppLayout() {
  useRaceSocket();
  const { logout, displayName, role } = useAuth();
  const features = useFeatures();
  const { data: me } = useSWR<Pilot>('/api/pilots/me', fetcher);
  const isAdmin = role === 'ADMIN';
  const isPilot = role === 'PILOT';
  const isModo  = role === 'MODERATOR' || isAdmin;

  const streamingItems: NavItem[] = features.streaming && isModo ? [
    { label: 'Régie',  path: '/regie',  icon: <VideocamOutlined /> },
    { label: 'Viewer', path: '/viewer', icon: <TvOutlined /> },
  ] : [];

  const modoRaceSection: NavSection = {
    label: 'Race',
    items: [
      ...NAV_SECTIONS_MODO[0].items,
      ...streamingItems,
    ],
  };

  const adminSection: NavSection = {
    label: 'Admin',
    items: [{ label: 'Admin', path: '/admin', icon: <AdminPanelSettingsOutlined /> }],
  };
  const navSections: NavSection[] = [
    ...(isPilot ? NAV_SECTIONS_PILOT : [modoRaceSection, NAV_SECTIONS_MODO[1]]),
    ...(isAdmin ? [adminSection] : []),
  ];
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);



  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Spacer matching AppBar height */}
      <Toolbar sx={{ minHeight: 64 }} />
      <Box sx={{ overflow: 'hidden', flex: 1 }}>
        {navSections.map((section, sectionIndex) => (
          <Box key={section.label}>
            {open && (
              <Typography
                variant="overline"
                sx={{ px: 2, display: 'block', color: 'text.secondary' }}
              >
                {section.label}
              </Typography>
            )}
            {!open && sectionIndex > 0 && <Box sx={{ height: 8 }} />}
            <List dense disablePadding>
              {section.items.map((item) => {
                const active = !item.href && (pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path + '/')));
                return (
                  <Tooltip title={open ? '' : item.label} placement="right">
                    <ListItemButton
                      key={item.label}
                      selected={active}
                      onClick={() => item.href ? window.open(item.href, '_blank') : navigate(item.path)}
                      sx={{ px: open ? 2 : 0, justifyContent: 'center', ...(open ? {} : { height: MINI_WIDTH }) }}
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
          <Typography variant="h6" fontWeight={800} fontStyle="italic" sx={{ flex: 1 }}>
            Circus Racing
          </Typography>
          <Tooltip title="Account settings">
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" sx={{ ml: 1 }}>
              <Avatar
                src={me?.avatarUrl ?? undefined}
                sx={{ width: 32, height: 32, fontSize: 14 }}
              >
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
        <Box
          component="footer"
          sx={{
            px: 3,
            py: 0.75,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            whiteSpace: 'nowrap',
          }}
        >
          <Tooltip
            title="This is an unofficial Star Citizen tool, not affiliated with the Cloud Imperium group of companies. All game content and materials are copyright Cloud Imperium Rights LLC and Cloud Imperium Rights Ltd. Star Citizen®, Squadron 42®, Roberts Space Industries®, and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC."
            placement="top"
            arrow
          >
            <Typography variant="caption" color="text.disabled" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'default' }}>
              Unofficial Star Citizen fan tool
            </Typography>
          </Tooltip>
          <Typography variant="caption" color="text.disabled">·</Typography>
          <Typography
            variant="caption"
            component="a"
            href="https://robertsspaceindustries.com"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'text.disabled', textDecoration: 'none', '&:hover': { color: 'text.secondary' } }}
          >
            robertsspaceindustries.com
          </Typography>
          <Typography variant="caption" color="text.disabled">·</Typography>
          <Typography
            variant="caption"
            component="a"
            href="https://buymeacoffee.com/kehnte"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'text.disabled', textDecoration: 'none', '&:hover': { color: 'text.secondary' } }}
          >
            Made by @Kehnte
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
