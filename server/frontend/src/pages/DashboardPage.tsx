// DashboardPage — Live race management dashboard.
// Composes race selector, settings, controls and grid.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { useState } from 'react';
import { useRaceSocket } from '../hooks/useRaceSocket.ts';
import { useRaceStore } from '../store/raceStore.ts';
import PageContainer from '../components/PageContainer.tsx';
import AddPilotDialog from '../components/race/AddPilotDialog.tsx';
import OverlaySettingsPanel from '../components/race/OverlaySettingsPanel.tsx';
import RaceControlBar from '../components/race/RaceControlBar.tsx';
import RaceGrid from '../components/race/RaceGrid.tsx';
import RaceSelector from '../components/race/RaceSelector.tsx';
import RaceSettingsPanel from '../components/race/RaceSettingsPanel.tsx';

export default function DashboardPage() {
  useRaceSocket();

  const { raceState } = useRaceStore();
  const [addPilotOpen, setAddPilotOpen] = useState(false);

  return (
    <PageContainer title="Dashboard">
      <Stack spacing={2}>
        <RaceSelector />
        {raceState && (
          <>
            <RaceSettingsPanel raceState={raceState} />
            <OverlaySettingsPanel raceState={raceState} />
            <RaceControlBar raceState={raceState} />
          </>
        )}
      </Stack>

      {raceState && (
        <>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, mt: 2 }}>
            <RaceGrid raceState={raceState} />
          </Box>

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
