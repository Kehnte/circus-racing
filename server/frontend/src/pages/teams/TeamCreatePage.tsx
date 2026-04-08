// TeamCreatePage — create a new team with responsive Grid form and real-time validation.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormGroup from '@mui/material/FormGroup';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { apiFetch } from '../../api.ts';
import PageContainer from '../../components/PageContainer.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import { validateTeamField, validateTeamForm } from './validateTeam.ts';
import TeamColorPicker from './TeamColorPicker.tsx';
import type { TeamForm } from './validateTeam.ts';

const EMPTY: TeamForm = { name: '', acronym: '', color: '#FFD54F' };

export default function TeamCreatePage() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [form, setForm] = useState<TeamForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof TeamForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);

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
      await apiFetch('/api/teams', { method: 'POST', body: JSON.stringify(form) });
      notifications.show('Team created.', { severity: 'success', autoHideDuration: 3000 });
      navigate('/teams');
    } catch (err) {
      notifications.show(`Create failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer
      title="New team"
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
            <Grid size={{ xs: 12 }} sx={{ display: 'flex' }}>
              <TeamColorPicker value={form.color} onChange={(c) => handleChange('color', c)} error={!!errors.color} helperText={errors.color} />
            </Grid>
          </Grid>
        </FormGroup>
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/teams')}>back</Button>
          <Button type="submit" variant="contained" size="large" disabled={submitting}>create</Button>
        </Stack>
      </Box>
    </PageContainer>
  );
}
