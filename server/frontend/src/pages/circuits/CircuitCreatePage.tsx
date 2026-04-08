// CircuitCreatePage — create a new circuit with JSON checkpoint import and real-time validation.

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import FormGroup from '@mui/material/FormGroup';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { apiFetch } from '../../api.ts';
import PageContainer from '../../components/PageContainer.tsx';
import useNotifications from '../../hooks/useNotifications/useNotifications.tsx';
import type { Checkpoint } from '../../types.ts';
import { validateCircuitField, validateCircuitForm } from './validateCircuit.ts';
import type { CircuitForm } from './validateCircuit.ts';

// Normalize various JSON checkpoint formats into the canonical {order, position} shape.
function parseCheckpoints(raw: unknown): Checkpoint[] {
  if (!Array.isArray(raw)) throw new Error('Expected a JSON array');
  return raw.map((item: unknown, i: number) => {
    if (Array.isArray(item) && item.length >= 3) {
      return { order: i, position: [Number(item[0]), Number(item[1]), Number(item[2])] as [number, number, number] };
    }
    if (item !== null && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      if ('position' in obj && Array.isArray(obj.position)) {
        const p = obj.position as unknown[];
        return { order: i, position: [Number(p[0]), Number(p[1]), Number(p[2])] as [number, number, number] };
      }
      if ('x' in obj) {
        return { order: i, position: [Number(obj.x), Number(obj.y), Number(obj.z)] as [number, number, number] };
      }
    }
    throw new Error(`Unrecognized checkpoint format at index ${i}`);
  });
}

export default function CircuitCreatePage() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<CircuitForm>({ name: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof CircuitForm, string>>>({});
  const [checkpoints, setCheckpoints] = useState<Checkpoint[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(field: keyof CircuitForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    const err = validateCircuitField(field, value);
    setErrors((e) => ({ ...e, [field]: err ?? undefined }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as unknown;
        setCheckpoints(parseCheckpoints(parsed));
        setParseError('');
      } catch (err) {
        setCheckpoints(null);
        setParseError(err instanceof Error ? err.message : 'Invalid JSON');
      }
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formErrors = validateCircuitForm(form);
    if (Object.keys(formErrors).length > 0) { setErrors(formErrors); return; }
    setSubmitting(true);
    try {
      await apiFetch('/api/racetracks', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, checkpoints: checkpoints ?? [] }),
      });
      notifications.show('Circuit created.', { severity: 'success', autoHideDuration: 3000 });
      navigate('/circuits');
    } catch (err) {
      notifications.show(`Create failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer
      title="New circuit"
    >
      <Box component="form" onSubmit={(e: React.FormEvent) => void handleSubmit(e)} noValidate sx={{ width: '100%' }}>
        <FormGroup>
          <Grid container spacing={2} sx={{ mb: 2, width: '100%' }}>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex' }}>
              <TextField
                label="Name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={!!errors.name}
                helperText={errors.name ?? ' '}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Button component="label" variant="outlined" size="medium" fullWidth>
                {checkpoints ? `${checkpoints.length} checkpoints loaded` : 'upload checkpoints JSON'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  hidden
                  onChange={handleFileChange}
                />
              </Button>
              <Collapse in={!!parseError}>
                <Alert severity="error" sx={{ mt: 1 }}>{parseError}</Alert>
              </Collapse>
            </Grid>
          </Grid>
        </FormGroup>
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/circuits')}>back</Button>
          <Button type="submit" variant="contained" size="large" disabled={submitting}>create</Button>
        </Stack>
      </Box>
    </PageContainer>
  );
}
