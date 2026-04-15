// PilotEditPage — edit an existing pilot with responsive Grid form and real-time validation.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormGroup from '@mui/material/FormGroup';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import LockResetOutlined from '@mui/icons-material/LockResetOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import { apiFetch, fetcher } from '../../api.ts';
import CountrySelect from '../../components/CountrySelect.tsx';
import PageContainer from '../../components/PageContainer.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import type { Controls, Pilot, Team, Vehicle } from '../../types.ts';
import { validatePilotField, validatePilotForm } from './validatePilot.ts';
import type { PilotForm } from './validatePilot.ts';

const ROLES = ['ADMIN', 'MODERATOR', 'PILOT'];

export default function PilotEditPage() {
  const { pilotId } = useParams<{ pilotId: string }>();
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [form, setForm] = useState<PilotForm>({ displayName: '', country: 'un', role: 'PILOT', teamId: '', vehicleId: '', controlsId: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof PilotForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [generatedPassphrase, setGeneratedPassphrase] = useState<string | null>(null);
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  const { data: pilot, error } = useSWR<Pilot>(pilotId ? `/api/pilots/${pilotId}` : null, fetcher);
  const { data: teams } = useSWR<Team[]>('/api/teams', fetcher);
  const { data: vehicles } = useSWR<Vehicle[]>('/api/vehicles', fetcher);
  const { data: controls } = useSWR<Controls[]>('/api/controls', fetcher);

  useEffect(() => {
    if (pilot) {
      setForm({
        displayName: pilot.displayName,
        country: pilot.country ?? 'un',
        role: pilot.role,
        teamId: pilot.teamId ?? '',
        vehicleId: pilot.vehicleId ?? '',
        controlsId: pilot.controlsId ?? '',
      });
    }
  }, [pilot]);

  function handleChange(field: keyof PilotForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    const err = validatePilotField(field, value);
    setErrors((e) => ({ ...e, [field]: err ?? undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validatePilotForm(form);
    if (Object.keys(formErrors).length > 0) { setErrors(formErrors); return; }
    setSubmitting(true);
    try {
      await apiFetch(`/api/pilots/${pilotId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: form.displayName,
          country: form.country || 'un',
          role: form.role,
          teamId: form.teamId || null,
          vehicleId: form.vehicleId || null,
          controlsId: form.controlsId || null,
        }),
      });
      notifications.show('Pilot updated.', { severity: 'success', autoHideDuration: 3000 });
      navigate('/pilots');
    } catch (err) {
      notifications.show(`Update failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    setResetLoading(true);
    try {
      const data = await apiFetch(`/api/pilots/${pilotId}/reset-password`, { method: 'POST' }) as { passphrase: string };
      setGeneratedPassphrase(data.passphrase);
    } catch (err) {
      notifications.show(`Reset failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
      setResetDialogOpen(false);
    } finally {
      setResetLoading(false);
    }
  }

  async function copyPassphrase() {
    if (!generatedPassphrase) return;
    try {
      await navigator.clipboard.writeText(generatedPassphrase);
    } catch {
      const el = document.createElement('textarea');
      el.value = generatedPassphrase;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    notifications.show('Passphrase copied.', { severity: 'success', autoHideDuration: 2000 });
  }

  async function handleOpenBroadcastPortal() {
    setBroadcastLoading(true);
    try {
      const data = await apiFetch(`/api/pilots/${pilotId}/broadcast-sso`) as { redirectUrl: string };
      window.open(data.redirectUrl, '_blank', 'noopener');
    } catch (err) {
      notifications.show((err as Error).message, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setBroadcastLoading(false);
    }
  }

  function handleCloseResetDialog() {
    setResetDialogOpen(false);
    setGeneratedPassphrase(null);
  }

  if (error) return <Alert severity="error">Failed to load pilot.</Alert>;
  if (!pilot) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;

  return (
    <PageContainer title="Edit pilot">
      <Box component="form" onSubmit={(e: React.FormEvent) => void handleSubmit(e)} noValidate sx={{ width: '100%' }}>
        <FormGroup>
          <Grid container spacing={2} sx={{ mb: 2, width: '100%' }}>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField
                label="Display name"
                value={form.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                error={!!errors.displayName}
                helperText={errors.displayName ?? ' '}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <CountrySelect
                value={form.country}
                onChange={(code) => handleChange('country', code)}
                error={!!errors.country}
                helperText={errors.country ?? ' '}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField select label="Role" value={form.role} onChange={(e) => handleChange('role', e.target.value)} error={!!errors.role} helperText={errors.role ?? ' '} fullWidth>
                {ROLES.map((r) => <MenuItem key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField select label="Team" value={form.teamId} onChange={(e) => handleChange('teamId', e.target.value)} fullWidth>
                <MenuItem value="">none</MenuItem>
                {(teams ?? []).map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField select label="Vehicle" value={form.vehicleId} onChange={(e) => handleChange('vehicleId', e.target.value)} fullWidth>
                <MenuItem value="">none</MenuItem>
                {(vehicles ?? []).map((v) => (
                  <MenuItem key={v.id} value={v.id}>{v.type.charAt(0).toUpperCase() + v.type.slice(1)} {v.model}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField select label="Controls" value={form.controlsId} onChange={(e) => handleChange('controlsId', e.target.value)} fullWidth>
                <MenuItem value="">none</MenuItem>
                {(controls ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.type}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </FormGroup>
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/pilots')}>back</Button>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" color="warning" startIcon={<LockResetOutlined />} onClick={() => setResetDialogOpen(true)}>
              reset password
            </Button>
            <Button
              variant="outlined"
              startIcon={broadcastLoading ? <CircularProgress size={14} color="inherit" /> : <OpenInNewOutlined />}
              onClick={() => void handleOpenBroadcastPortal()}
              disabled={broadcastLoading}
            >
              broadcast portal
            </Button>
            <Button type="submit" variant="contained" size="large" disabled={submitting}>save</Button>
          </Stack>
        </Stack>
      </Box>

      <Dialog open={resetDialogOpen} onClose={handleCloseResetDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent>
          {generatedPassphrase ? (
            <Stack spacing={2}>
              <DialogContentText>
                New temporary password for <strong>{pilot.displayName}</strong>. Share it with the pilot — it won't be shown again.
              </DialogContentText>
              <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ flex: 1, fontFamily: 'monospace', fontSize: 14, wordBreak: 'break-all' }}>
                  {generatedPassphrase}
                </Typography>
                <IconButton size="small" onClick={() => void copyPassphrase()}>
                  <ContentCopyOutlined fontSize="small" />
                </IconButton>
              </Paper>
            </Stack>
          ) : (
            <DialogContentText>
              Generate a temporary password for <strong>{pilot.displayName}</strong>? Their current password will be replaced immediately.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResetDialog}>{generatedPassphrase ? 'close' : 'cancel'}</Button>
          {!generatedPassphrase && (
            <Button variant="contained" color="warning" onClick={() => void handleResetPassword()} disabled={resetLoading}>
              {resetLoading ? 'generating…' : 'generate'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
