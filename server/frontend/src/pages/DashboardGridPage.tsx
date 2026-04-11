// DashboardGridPage — Standalone race grid only, no settings or controls.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { useState } from 'react';
import { useRaceStore } from '../store/raceStore.ts';
import { useAuth } from '../context/AuthContext.tsx';
import PageContainer from '../components/PageContainer.tsx';
import AddPilotDialog from '../components/race/AddPilotDialog.tsx';
import RaceGrid from '../components/race/RaceGrid.tsx';

export default function DashboardGridPage() {
  const { raceState } = useRaceStore();
  const { role } = useAuth();
  const isModo = role === 'ADMIN' || role === 'MODERATOR';
  const [addPilotOpen, setAddPilotOpen] = useState(false);

  if (!raceState) {
    return (
      <PageContainer title="Dashboard">
        <Box sx={{ color: 'text.secondary' }}>No active race.</Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Dashboard">
      <RaceGrid raceState={raceState} />
      {isModo && (
        <>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setAddPilotOpen(true)}
            sx={{ alignSelf: 'flex-start', mt: 1 }}
          >
            add pilot
          </Button>
          <AddPilotDialog
            open={addPilotOpen}
            raceState={raceState}
            onClose={() => setAddPilotOpen(false)}
          />
        </>
      )}
    </PageContainer>
  );
}
