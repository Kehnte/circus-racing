// TeamEditPage — edit an existing team with responsive Grid form and real-time validation.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormGroup from '@mui/material/FormGroup';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { apiFetch, fetcher } from '../../api.ts';
import PageContainer from '../../components/PageContainer.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import type { Team } from '../../types.ts';
import { validateTeamField, validateTeamForm } from './validateTeam.ts';
import type { TeamForm } from './validateTeam.ts';

export default function TeamEditPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [form, setForm] = useState<TeamForm>({ name: '', acronym: '', color: '#FFD54F' });
  const [errors, setErrors] = useState<Partial<Record<keyof TeamForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: team, error } = useSWR<Team>(teamId ? `/api/teams/${teamId}` : null, fetcher);

  useEffect(() => {
    if (team) setForm({ name: team.name, acronym: team.acronym, color: team.color });
  }, [team]);

  function handleChange(field: keyof TeamForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    const err = validateTeamField(field, value);
    setErrors((e) => ({ ...e, [field]: err ?? undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateTeamForm(form);
    if (Object.keys(formErrors).length > 0) { setErrors(formErrors); return; }
    setSubmitting(true);
    try {
      await apiFetch(`/api/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(form) });
      notifications.show('Team updated.', { severity: 'success', autoHideDuration: 3000 });
      navigate('/teams');
    } catch (err) {
      notifications.show(`Update failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <Alert severity="error">Failed to load team.</Alert>;
  if (!team) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;

  return (
    <PageContainer
      title="Edit team"
    >
      <Box component="form" onSubmit={(e: React.FormEvent) => void handleSubmit(e)} noValidate sx={{ width: '100%' }}>
        <FormGroup>
          <Grid container spacing={2} sx={{ mb: 2, width: '100%' }}>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField label="Name" value={form.name} onChange={(e) => handleChange('name', e.target.value)} error={!!errors.name} helperText={errors.name ?? ' '} fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField
                label="Acronym"
                value={form.acronym}
                onChange={(e) => handleChange('acronym', e.target.value)}
                error={!!errors.acronym}
                helperText={errors.acronym ?? ' '}
                inputProps={{ maxLength: 4 }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField
                label="Color"
                value={form.color}
                onChange={(e) => handleChange('color', e.target.value)}
                error={!!errors.color}
                helperText={errors.color ?? ' '}
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Box
                          component="input"
                          type="color"
                          value={form.color}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('color', e.target.value)}
                          sx={{ width: 28, height: 28, border: 'none', p: 0, cursor: 'pointer', bgcolor: 'transparent' }}
                        />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Grid>
          </Grid>
        </FormGroup>
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/teams')}>back</Button>
          <Button type="submit" variant="contained" size="large" disabled={submitting}>save</Button>
        </Stack>
      </Box>
    </PageContainer>
  );
}
