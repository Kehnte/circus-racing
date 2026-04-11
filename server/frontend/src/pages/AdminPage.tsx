// AdminPage — Admin-only page for dangerous database reset operations.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined';
import { apiFetch } from '../api.ts';
import PageContainer from '../components/PageContainer.tsx';
import useDialogs from '../hooks/useDialogs/useDialogs.tsx';
import useNotifications from '../hooks/useNotifications/useNotifications.tsx';

export default function AdminPage() {
  const dialogs = useDialogs();
  const notifications = useNotifications();

  async function handleResetRaces() {
    const confirmed = await dialogs.confirm(
      'Delete all races, entries and race states? Pilots, teams, vehicles and racetracks will be preserved. This cannot be undone.',
      { title: 'Reset race data', confirmLabel: 'reset races', confirmColor: 'error' }
    );
    if (!confirmed) return;
    try {
      await apiFetch('/api/admin/reset-races', { method: 'POST' });
      notifications.show('Race data cleared.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show(`Reset failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  async function handleResetRoster() {
    const confirmed = await dialogs.confirm(
      'Delete all pilots (except your account), teams, vehicles and controls? Races will be preserved. This cannot be undone.',
      { title: 'Reset roster', confirmLabel: 'reset roster', confirmColor: 'error' }
    );
    if (!confirmed) return;
    try {
      await apiFetch('/api/admin/reset-roster', { method: 'POST' });
      notifications.show('Roster cleared.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show(`Reset failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  async function handleResetAll() {
    const first = await dialogs.confirm(
      'This will delete everything except your account: all races, pilots, teams, vehicles, controls and racetracks. Are you sure?',
      { title: 'Full reset', confirmLabel: 'yes, delete everything', confirmColor: 'error' }
    );
    if (!first) return;
    const second = await dialogs.confirm(
      'Last chance — this cannot be undone. Proceed with full reset?',
      { title: 'Confirm full reset', confirmLabel: 'proceed', confirmColor: 'error' }
    );
    if (!second) return;
    try {
      await apiFetch('/api/admin/reset-all', { method: 'POST' });
      notifications.show('Full reset complete.', { severity: 'success', autoHideDuration: 3000 });
    } catch (err) {
      notifications.show(`Reset failed: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 5000 });
    }
  }

  return (
    <PageContainer title="Admin">
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="subtitle2" gutterBottom>Database</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          These actions permanently delete data and cannot be undone.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>Reset race data</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Deletes all races, race entries and race states. Pilots, teams, vehicles, controls and racetracks are preserved.
            </Typography>
            <Button variant="outlined" color="error" size="small" startIcon={<DeleteSweepOutlined />} onClick={() => void handleResetRaces()}>
              reset race data
            </Button>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>Reset roster</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Deletes all pilots (except your account), teams, vehicles and controls. Races are preserved.
            </Typography>
            <Button variant="outlined" color="error" size="small" startIcon={<DeleteSweepOutlined />} onClick={() => void handleResetRoster()}>
              reset roster
            </Button>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>Full reset</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Deletes everything except your account — races, pilots, teams, vehicles, controls, racetracks.
            </Typography>
            <Button variant="contained" color="error" size="small" startIcon={<DeleteSweepOutlined />} onClick={() => void handleResetAll()}>
              full reset
            </Button>
          </Box>
        </Box>
      </Paper>
    </PageContainer>
  );
}
