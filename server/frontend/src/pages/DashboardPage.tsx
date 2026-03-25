// DashboardPage — Live race management dashboard.
// Composes race selector, settings, controls, grid and DNF panel.

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { useState } from 'react';
import { useRaceSocket } from '../hooks/useRaceSocket.ts';
import { useRaceStore } from '../store/raceStore.ts';
import AddPilotDialog from '../components/race/AddPilotDialog.tsx';
import DnfWarningPanel from '../components/race/DnfWarningPanel.tsx';
import LeaderboardDisplayPanel from '../components/race/LeaderboardDisplayPanel.tsx';
import RaceControlBar from '../components/race/RaceControlBar.tsx';
import RaceGrid from '../components/race/RaceGrid.tsx';
import RaceSelector from '../components/race/RaceSelector.tsx';
import RaceSettingsPanel from '../components/race/RaceSettingsPanel.tsx';

export default function DashboardPage() {
  useRaceSocket();

  const { raceState } = useRaceStore();
  const [addPilotOpen, setAddPilotOpen] = useState(false);

  return (
    <Box>
      <Typography variant="overline" display="block" mb={1}>
        Dashboard
      </Typography>

      <RaceSelector />

      {raceState && (
        <>
          <RaceSettingsPanel raceState={raceState} />

          <Box sx={{ mt: 2 }}>
            <RaceControlBar raceState={raceState} />
          </Box>

          <LeaderboardDisplayPanel raceState={raceState} />

          <DnfWarningPanel raceState={raceState} />

          <RaceGrid raceState={raceState} />

          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddOutlined />}
              onClick={() => setAddPilotOpen(true)}
            >
              add pilot
            </Button>
          </Box>

          <AddPilotDialog
            open={addPilotOpen}
            raceState={raceState}
            onClose={() => setAddPilotOpen(false)}
          />
        </>
      )}
    </Box>
  );
}
