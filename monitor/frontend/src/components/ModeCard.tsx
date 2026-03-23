// ModeCard.tsx — Race / Record mode toggle.

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

interface Props {
  mode: 'RACE' | 'RECORD' | undefined;
  onSetMode: (mode: 'RACE' | 'RECORD') => void;
}

export default function ModeCard({ mode, onSetMode }: Props) {
  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="text.secondary">Mode</Typography>
        <ToggleButtonGroup
          exclusive
          value={mode ?? null}
          onChange={(_, val) => { if (val) onSetMode(val); }}
          fullWidth
          size="small"
          sx={{ mt: 1 }}
        >
          <ToggleButton value="RACE">Race</ToggleButton>
          <ToggleButton value="RECORD">Record</ToggleButton>
        </ToggleButtonGroup>
      </CardContent>
    </Card>
  );
}
