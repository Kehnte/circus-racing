// ProfilePage — pilot profile: identity, race config, OCR token, open races enrollment.

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import useSWR from 'swr';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import type { GridActionsColDef, GridColDef, GridFilterModel, GridPaginationModel, GridRenderCellParams, GridRowParams, GridSortModel } from '@mui/x-data-grid';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import HowToRegOutlined from '@mui/icons-material/HowToRegOutlined';
import KeyOutlined from '@mui/icons-material/KeyOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';

import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import { apiFetch, fetcher } from '../api.ts';
import CountrySelect from '../components/CountrySelect.tsx';
import PageContainer from '../components/PageContainer.tsx';
import { NoRowsOverlay } from '../components/DataGridOverlays.tsx';
import CrudToolbar from '../components/CrudToolbar.tsx';
import useNotifications from '../hooks/useNotifications/useNotifications.tsx';
import type { Controls, Pilot, Team, Vehicle } from '../types.ts';

const TOKEN_KEY = 'circus_token';

interface OpenRace { id: string; name: string; lapCount: number; trackingMode: string; sessionMode: string; session: string; startType: string; status: string; }
interface RaceEntry { id: string; status: 'PENDING' | 'VALIDATED'; }

function roleChipColor(role: string): 'primary' | 'warning' | 'default' {
  if (role === 'ADMIN') return 'primary';
  if (role === 'MODERATOR') return 'warning';
  return 'default';
}

export default function ProfilePage() {
  const notifications = useNotifications();

  const { data: me, mutate: mutateMe, error: meError } = useSWR<Pilot>('/api/pilots/me', fetcher);
  const { data: teams }     = useSWR<Team[]>('/api/teams', fetcher);
  const { data: vehicles }  = useSWR<Vehicle[]>('/api/vehicles', fetcher);
  const { data: controls }  = useSWR<Controls[]>('/api/controls', fetcher);
  const { data: openRaces } = useSWR<OpenRace[]>('/api/races?status=PENDING,SCHEDULED', fetcher);

  const [entries, setEntries] = useState<Record<string, RaceEntry | null>>({});
  const [acting, setActing] = useState<Record<string, boolean>>({});
  const [racesPagination, setRacesPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [racesSortModel, setRacesSortModel] = useState<GridSortModel>([]);
  const [racesFilterModel, setRacesFilterModel] = useState<GridFilterModel>({ items: [] });

  useEffect(() => {
    if (!openRaces) return;
    openRaces.forEach((race) => {
      fetcher<RaceEntry>(`/api/races/${race.id}/entries/me`)
        .catch(() => null)
        .then((entry) => setEntries((prev) => ({ ...prev, [race.id]: entry })));
    });
  }, [openRaces]);

  const handleRegister = useCallback(async (race: OpenRace) => {
    setActing((prev) => ({ ...prev, [race.id]: true }));
    try {
      const entry = await apiFetch<RaceEntry>(`/api/races/${race.id}/entries`, { method: 'POST' });
      setEntries((prev) => ({ ...prev, [race.id]: entry }));
      notifications.show('Registered! Awaiting admin validation.', { severity: 'success' });
    } catch (err) {
      notifications.show((err as Error).message, { severity: 'error' });
    } finally {
      setActing((prev) => ({ ...prev, [race.id]: false }));
    }
  }, [notifications]);

  const handleCancel = useCallback(async (race: OpenRace) => {
    const entry = entries[race.id];
    if (!entry) return;
    setActing((prev) => ({ ...prev, [race.id]: true }));
    try {
      await apiFetch(`/api/races/${race.id}/entries/${entry.id}`, { method: 'DELETE' });
      setEntries((prev) => ({ ...prev, [race.id]: null }));
      notifications.show('Registration cancelled.', { severity: 'success' });
    } catch (err) {
      notifications.show((err as Error).message, { severity: 'error' });
    } finally {
      setActing((prev) => ({ ...prev, [race.id]: false }));
    }
  }, [entries, notifications]);

  const openRaceColumns: (GridColDef<OpenRace> | GridActionsColDef<OpenRace>)[] = [
    { field: 'name', headerName: 'Race', flex: 1, minWidth: 120 },
    { field: 'session', headerName: 'Session', minWidth: 90 },
    { field: 'startType', headerName: 'Start type', minWidth: 120 },
    {
      field: 'sessionMode',
      headerName: 'Session mode',
      minWidth: 120,
      renderCell: (params: GridRenderCellParams<OpenRace, string>) => params.value === 'laps' ? 'Laps' : 'Timed',
    },
    {
      field: 'trackingMode',
      headerName: 'Tracking',
      minWidth: 90,
      renderCell: (params: GridRenderCellParams<OpenRace, string>) => params.value === 'auto' ? 'Auto' : 'Manual',
    },
    {
      field: 'lapCount',
      headerName: 'Laps',
      minWidth: 90,
      renderCell: (params: GridRenderCellParams<OpenRace, number>) => `${params.value} laps`,
    },
    {
      field: 'entryStatus',
      headerName: 'Registration',
      minWidth: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams<OpenRace>) => {
        const entry = entries[params.row.id];
        if (entry?.status === 'PENDING') return <Chip label="Pending" size="small" />;
        if (entry?.status === 'VALIDATED') return <Chip label="Validated" color="success" size="small" />;
        if (!entry && params.row.status === 'PENDING') return <Chip label="Closed" size="small" color="error" />;
        if (!entry && params.row.status === 'SCHEDULED') return <Chip label="Open" size="small" color="primary" />;
        return null;
      },
    },
    {
      field: 'actions',
      type: 'actions',
      headerAlign: 'left',
      align: 'left',
      headerName: 'Actions',
      minWidth: 90,
      getActions: (params: GridRowParams<OpenRace>) => {
        const entry = entries[params.row.id];
        const busy = acting[params.row.id] ?? false;
        if (entry === undefined) return [];
        if (!entry) {
          return [
            <GridActionsCellItem icon={<HowToRegOutlined />} label="Register" disabled={busy || params.row.status !== 'SCHEDULED'} onClick={() => void handleRegister(params.row)} showInMenu={false} />,
          ];
        }
        if (entry.status === 'VALIDATED') {
          return [
            <GridActionsCellItem icon={<LogoutOutlined />} label="Leave" disabled={busy} onClick={() => void handleCancel(params.row)} showInMenu={false} />,
          ];
        }
        return [
          <GridActionsCellItem icon={<CancelOutlined />} label="Cancel" disabled={busy} onClick={() => void handleCancel(params.row)} showInMenu={false} />,
        ];
      },
    },
  ];

  const [displayName, setDisplayName]       = useState('');
  const [country, setCountry]               = useState('un');
  const [identitySaving, setIdentitySaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview]   = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [teamId, setTeamId]         = useState('');
  const [vehicleId, setVehicleId]   = useState('');
  const [controlsId, setControlsId] = useState('');
  const [locked, setLocked]         = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving]   = useState(false);
  const [showNewPassword, setShowNewPassword]         = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName);
      setCountry(me.country ?? 'un');
      setTeamId(me.teamId ?? '');
      setVehicleId(me.vehicleId ?? '');
      setControlsId(me.controlsId ?? '');
    }
  }, [me]);

  async function handleSaveIdentity() {
    setIdentitySaving(true);
    try {
      await apiFetch('/api/pilots/me', {
        method: 'PATCH',
        body: JSON.stringify({ displayName, country }),
      });
      void mutateMe();
      notifications.show('Profile saved.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show((err as Error).message, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setIdentitySaving(false);
    }
  }

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Upload
    setAvatarUploading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const form = new FormData();
      form.append('avatar', file);
      const res = await fetch('/api/pilots/me/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = 'Upload failed';
        try { msg = (JSON.parse(text) as { error?: string }).error ?? msg; } catch { /* non-JSON body */ }
        throw new Error(msg);
      }
      void mutateMe();
      notifications.show('Avatar updated.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      setAvatarPreview(null);
      notifications.show((err as Error).message, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  async function handleRemoveAvatar() {
    try {
      await apiFetch('/api/pilots/me/avatar', { method: 'DELETE' });
      setAvatarPreview(null);
      void mutateMe();
      notifications.show('Avatar removed.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show((err as Error).message, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  async function handleSaveRaceConfig() {
    setConfigSaving(true);
    try {
      await apiFetch('/api/pilots/me', {
        method: 'PATCH',
        body: JSON.stringify({
          teamId: teamId || null,
          vehicleId: vehicleId || null,
          controlsId: controlsId || null,
        }),
      });
      notifications.show('Race configuration saved.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('locked')) setLocked(true);
      notifications.show(msg, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      notifications.show('New passwords do not match.', { severity: 'error', autoHideDuration: 4000 });
      return;
    }
    setPasswordSaving(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notifications.show('Password changed.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show((err as Error).message, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleRegenerateToken() {
    try {
      await apiFetch('/api/auth/regenerate-token', { method: 'POST' });
      void mutateMe();
      notifications.show('Token regenerated. Update your OCR client.', { severity: 'success', autoHideDuration: 4000 });
    } catch (err) {
      notifications.show((err as Error).message, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  async function handleCopyToken() {
    if (!me?.token) return;
    try {
      await navigator.clipboard.writeText(me.token);
      notifications.show('Token copied to clipboard.', { severity: 'success', autoHideDuration: 2000 });
    } catch {
      notifications.show('Could not copy — select and copy manually.', { severity: 'error' });
    }
  }

  async function handleDownloadConfig() {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch('/api/pilots/me/config', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'config.cfg'; a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadMonitor() {
    window.open('https://github.com/Kehnte/circus-racing/releases/latest', '_blank');
  }

  if (meError) return <Alert severity="error">Failed to load profile.</Alert>;
  if (!me) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;

  return (
    <PageContainer title="Profile">
      <Grid container spacing={3}>

        {/* ── Left column ── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>

            {/* Avatar card */}
            <Paper elevation={0} sx={{ p: 2, textAlign: 'center' }}>
              <Box
                sx={{ position: 'relative', width: 80, mx: 'auto', mb: 1, cursor: 'pointer' }}
                onClick={() => avatarInputRef.current?.click()}
                title="Click to change avatar"
              >
                <Avatar
                  src={avatarPreview ?? me.avatarUrl ?? undefined}
                  sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: 32, border: 3, borderColor: 'primary.main' }}
                >
                  {me.displayName[0].toUpperCase()}
                </Avatar>
                {avatarUploading && (
                  <CircularProgress size={24} sx={{ position: 'absolute', top: '50%', left: '50%', mt: '-12px', ml: '-12px' }} />
                )}
              </Box>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => void handleAvatarChange(e)}
              />
              <Typography variant="subtitle1" fontWeight={700}>{me.displayName}</Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip label={me.role.charAt(0) + me.role.slice(1).toLowerCase()} color={roleChipColor(me.role)} size="small" />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                JPEG, PNG or WebP · max 2 MB
              </Typography>
              {(avatarPreview ?? me.avatarUrl) && (
                <Button variant="outlined" size="small" color="error" onClick={() => void handleRemoveAvatar()} sx={{ mt: 1 }}>
                  remove
                </Button>
              )}
            </Paper>

            {/* OCR Token card */}
            <Paper elevation={0} sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>OCR Token</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Configure this token in your OCR client to push positions in AUTO mode.
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                <KeyOutlined fontSize="small" sx={{ flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>{me.token ?? '—'}</Box>
                <IconButton size="small" onClick={() => void handleCopyToken()} title="Copy token">
                  <ContentCopyOutlined fontSize="small" />
                </IconButton>
              </Paper>
              <Button
                variant="outlined" size="small" startIcon={<RefreshOutlined />}
                onClick={() => void handleRegenerateToken()} sx={{ mt: 1.5 }}
              >
                Regenerate
              </Button>
            </Paper>

            {/* Monitor download card */}
            <Paper elevation={0} sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>OCR Monitor</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Download the Monitor to push your position in AUTO mode.
              </Typography>
              <Stack spacing={1}>
                <Button variant="outlined" size="small" startIcon={<DownloadOutlined />} onClick={handleDownloadMonitor} fullWidth>
                  Download Monitor (.exe)
                </Button>
                <Button variant="outlined" size="small" startIcon={<SettingsOutlined />} onClick={() => void handleDownloadConfig()} fullWidth>
                  Download my config.cfg
                </Button>
              </Stack>
            </Paper>

          </Stack>
        </Grid>

        {/* ── Right column ── */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2}>

            {/* Identity form */}
            <Paper elevation={0} sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>Identity</Typography>
              <Stack spacing={2}>
                <TextField
                  label="Name"
                  value={displayName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                  fullWidth
                />
                <CountrySelect value={country} onChange={setCountry} />
                <Box>
                  <Button variant="contained" onClick={() => void handleSaveIdentity()} disabled={identitySaving}>
                    save
                  </Button>
                </Box>
              </Stack>
            </Paper>

            {/* Race configuration form */}
            <Accordion disableGutters elevation={0} sx={{ borderRadius: 1, bgcolor: 'transparent' }}>
              <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                <Typography variant="subtitle2">Race configuration</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {locked && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Locked after validation. Contact an admin to change these fields.
                  </Alert>
                )}
                <Stack spacing={2}>
                  <TextField select label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={locked} fullWidth>
                    <MenuItem value="">none</MenuItem>
                    {(teams ?? []).map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </TextField>
                  <TextField select label="Vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} disabled={locked} fullWidth>
                    <MenuItem value="">none</MenuItem>
                    {(vehicles ?? []).map((v) => (
                      <MenuItem key={v.id} value={v.id}>
                        {v.type.charAt(0).toUpperCase() + v.type.slice(1)} — {v.model}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField select label="Controls" value={controlsId} onChange={(e) => setControlsId(e.target.value)} disabled={locked} fullWidth>
                    <MenuItem value="">none</MenuItem>
                    {(controls ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.type}</MenuItem>)}
                  </TextField>
                  <Box>
                    <Button variant="contained" onClick={() => void handleSaveRaceConfig()} disabled={locked || configSaving}>
                      save
                    </Button>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Security form */}
            <Accordion disableGutters elevation={0} sx={{ borderRadius: 1, bgcolor: 'transparent' }}>
              <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                <Typography variant="subtitle2">Security</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    label="Current password"
                    type="password"
                    value={currentPassword}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="New password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                    fullWidth
                    slotProps={{ input: { endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowNewPassword((v) => !v)} edge="end">
                          {showNewPassword ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )}}}
                  />
                  <TextField
                    label="Confirm new password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                    fullWidth
                    error={confirmPassword.length > 0 && confirmPassword !== newPassword}
                    helperText={confirmPassword.length > 0 && confirmPassword !== newPassword ? 'Passwords do not match' : undefined}
                    slotProps={{ input: { endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowConfirmPassword((v) => !v)} edge="end">
                          {showConfirmPassword ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )}}}
                  />
                  <Box>
                    <Button variant="contained" onClick={() => void handleChangePassword()} disabled={passwordSaving}>
                      save
                    </Button>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>

          </Stack>
        </Grid>

        {/* ── Open races ── */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Open races</Typography>
          <DataGrid
            rows={openRaces ?? []}
            columns={openRaceColumns}
            loading={!openRaces}
            pageSizeOptions={[25, 50]}
            paginationModel={racesPagination}
            onPaginationModelChange={setRacesPagination}
            sortModel={racesSortModel}
            onSortModelChange={setRacesSortModel}
            filterModel={racesFilterModel}
            onFilterModelChange={setRacesFilterModel}
            density="compact"
            disableColumnResize
            disableRowSelectionOnClick
            slots={{ toolbar: CrudToolbar, noRowsOverlay: NoRowsOverlay }}
            sx={{ flex: 1 }}
          />
        </Grid>

      </Grid>
    </PageContainer>
  );
}
