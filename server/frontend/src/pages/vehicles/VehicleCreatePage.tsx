// VehicleCreatePage — create a new vehicle with responsive Grid form and real-time validation.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormGroup from '@mui/material/FormGroup';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { apiFetch } from '../../api.ts';
import PageContainer from '../../components/PageContainer.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import { validateVehicleField, validateVehicleForm } from './validateVehicle.ts';
import type { VehicleForm } from './validateVehicle.ts';

const TYPES = ['ship', 'rover', 'bike'];
const EMPTY: VehicleForm = { model: '', type: 'ship', manufacturer: '', img: '' };

export default function VehicleCreatePage() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [form, setForm] = useState<VehicleForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(field: keyof VehicleForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    const err = validateVehicleField(field, value);
    setErrors((e) => ({ ...e, [field]: err ?? undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateVehicleForm(form);
    if (Object.keys(formErrors).length > 0) { setErrors(formErrors); return; }
    setSubmitting(true);
    try {
      await apiFetch('/api/vehicles', { method: 'POST', body: JSON.stringify({ ...form, manufacturer: form.manufacturer || null, img: form.img || null }) });
      notifications.show('Vehicle created.', { severity: 'success', autoHideDuration: 3000 });
      navigate('/vehicles');
    } catch (err) {
      notifications.show(`Create failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer
      title="New vehicle"
    >
      <Box component="form" onSubmit={(e: React.FormEvent) => void handleSubmit(e)} noValidate sx={{ width: '100%' }}>
        <FormGroup>
          <Grid container spacing={2} sx={{ mb: 2, width: '100%' }}>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField
                label="Manufacturer"
                value={form.manufacturer}
                onChange={(e) => handleChange('manufacturer', e.target.value)}
                error={!!errors.manufacturer}
                helperText={errors.manufacturer ?? ' '}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField
                label="Model"
                value={form.model}
                onChange={(e) => handleChange('model', e.target.value)}
                error={!!errors.model}
                helperText={errors.model ?? ' '}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField
                select
                label="Type"
                value={form.type}
                onChange={(e) => handleChange('type', e.target.value)}
                error={!!errors.type}
                helperText={errors.type ?? ' '}
                fullWidth
              >
                {TYPES.map((t) => <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>)}
              </TextField>
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
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/vehicles')}>back</Button>
          <Button type="submit" variant="contained" size="large" disabled={submitting}>create</Button>
        </Stack>
      </Box>
    </PageContainer>
  );
}
