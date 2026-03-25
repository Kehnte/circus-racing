// ControlCreatePage — create a new controls entry with responsive Grid form and real-time validation.

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
import { validateControlsField, validateControlsForm } from './validateControls.ts';
import type { ControlsForm } from './validateControls.ts';

const EMPTY: ControlsForm = { type: '', img: '' };

export default function ControlCreatePage() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [form, setForm] = useState<ControlsForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof ControlsForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(field: keyof ControlsForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    const err = validateControlsField(field, value);
    setErrors((e) => ({ ...e, [field]: err ?? undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateControlsForm(form);
    if (Object.keys(formErrors).length > 0) { setErrors(formErrors); return; }
    setSubmitting(true);
    try {
      await apiFetch('/api/controls', { method: 'POST', body: JSON.stringify({ ...form, img: form.img || null }) });
      notifications.show('Controls created.', { severity: 'success', autoHideDuration: 3000 });
      navigate('/controls');
    } catch (err) {
      notifications.show(`Create failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer
      title="New controls"
    >
      <Box component="form" onSubmit={(e: React.FormEvent) => void handleSubmit(e)} noValidate sx={{ width: '100%' }}>
        <FormGroup>
          <Grid container spacing={2} sx={{ mb: 2, width: '100%' }}>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField
                label="Type"
                value={form.type}
                onChange={(e) => handleChange('type', e.target.value)}
                error={!!errors.type}
                helperText={errors.type ?? ' '}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField
                label="Image URL"
                value={form.img}
                onChange={(e) => handleChange('img', e.target.value)}
                error={!!errors.img}
                helperText={errors.img ?? ' '}
                fullWidth
              />
            </Grid>
          </Grid>
        </FormGroup>
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/controls')}>back</Button>
          <Button type="submit" variant="contained" size="large" disabled={submitting}>create</Button>
        </Stack>
      </Box>
    </PageContainer>
  );
}
