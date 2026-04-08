// CheckpointEditor.tsx — Inline form for editing a single checkpoint's properties.
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import type { EditorCheckpoint } from '../../types';

interface Props {
  checkpoint: EditorCheckpoint;
  onChange: (patch: Partial<EditorCheckpoint>) => void;
}

const CP_TYPES: EditorCheckpoint['type'][] = ['start', 'start-finish', 'checkpoint', 'finish'];

export default function CheckpointEditor({ checkpoint, onChange }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography variant="caption" sx={{ minWidth: 40 }}>Type</Typography>
        <Select
          size="small"
          value={checkpoint.type}
          onChange={e => onChange({ type: e.target.value as EditorCheckpoint['type'] })}
          sx={{ flex: 1 }}
        >
          {CP_TYPES.map(t => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </Select>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography variant="caption" sx={{ minWidth: 40 }}>Radius</Typography>
        <TextField
          size="small"
          type="number"
          value={checkpoint.radius}
          onChange={e => onChange({ radius: parseFloat(e.target.value) || 100 })}
          inputProps={{ min: 10, max: 500, step: 10 }}
          sx={{ flex: 1 }}
        />
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
        pos: [{checkpoint.position.map(v => v.toFixed(1)).join(', ')}]
      </Typography>
    </Box>
  );
}
