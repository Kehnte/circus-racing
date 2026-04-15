// PilotCreatePage — create a new pilot with responsive Grid form and real-time validation.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormGroup from '@mui/material/FormGroup';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { apiFetch, fetcher } from '../../api.ts';
import CountrySelect from '../../components/CountrySelect.tsx';
import PageContainer from '../../components/PageContainer.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import type { Controls, Team, Vehicle } from '../../types.ts';
import { validatePilotField, validatePilotForm } from './validatePilot.ts';
import type { PilotForm } from './validatePilot.ts';

const ROLES = ['ADMIN', 'MODERATOR', 'PILOT'];
const EMPTY: PilotForm = { displayName: '', country: 'un', role: 'PILOT', teamId: '', vehicleId: '', controlsId: '' };

export default function PilotCreatePage() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [form, setForm] = useState<PilotForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof PilotForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: teams } = useSWR<Team[]>('/api/teams', fetcher);
  const { data: vehicles } = useSWR<Vehicle[]>('/api/vehicles', fetcher);
  const { data: controls } = useSWR<Controls[]>('/api/controls', fetcher);

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
      await apiFetch('/api/pilots', {
        method: 'POST',
        body: JSON.stringify({
          displayName: form.displayName,
          country: form.country || 'un',
          role: form.role,
          teamId: form.teamId || undefined,
          vehicleId: form.vehicleId || undefined,
          controlsId: form.controlsId || undefined,
        }),
      });
      notifications.show('Pilot created.', { severity: 'success', autoHideDuration: 3000 });
      navigate('/pilots');
    } catch (err) {
      notifications.show(`Create failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer
      title="New pilot"
    >
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
              <TextField
                select
                label="Role"
                value={form.role}
                onChange={(e) => handleChange('role', e.target.value)}
                error={!!errors.role}
                helperText={errors.role ?? ' '}
                fullWidth
              >
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
          <Button type="submit" variant="contained" size="large" disabled={submitting}>create</Button>
        </Stack>
      </Box>
    </PageContainer>
  );
}
