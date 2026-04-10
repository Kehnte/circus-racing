// CheckpointList.tsx — Checkpoint sidebar: list, edit/delete/reorder, auto-generation.
import { useState } from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import type { EditorCheckpoint } from '../../types';
import CheckpointEditor from './CheckpointEditor';

const CP_COLOR: Record<EditorCheckpoint['type'], 'success' | 'error' | 'default'> = {
  start: 'success',
  'start-finish': 'success',
  checkpoint: 'default',
  finish: 'error',
};

interface Props {
  checkpoints: EditorCheckpoint[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onUpdate: (id: number, patch: Partial<EditorCheckpoint>) => void;
  onDelete: (id: number) => void;
  onReorder: (id: number, direction: 'up' | 'down') => void;
  onGenerateAuto: (spacingM: number) => void;
  onClearAuto: () => void;
}

export default function CheckpointList({
  checkpoints,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onReorder,
  onGenerateAuto,
  onClearAuto,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [spacing, setSpacing] = useState('150');

  const autoCount = checkpoints.filter(cp => cp.source === 'auto').length;

  return (
    <Box sx={{ width: 260, overflowY: 'auto', borderLeft: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="overline" sx={{ px: 1.5, pt: 1, display: 'block' }}>
        Checkpoints ({checkpoints.length})
      </Typography>

      <Box sx={{ px: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <TextField
            size="small"
            label="every ~m"
            value={spacing}
            onChange={e => setSpacing(e.target.value)}
            sx={{ flex: 1 }}
            inputProps={{ inputMode: 'numeric' }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              const n = parseFloat(spacing);
              if (n > 0) onGenerateAuto(n);
            }}
          >
            generate
          </Button>
        </Box>
        {autoCount > 0 && (
          <Button size="small" color="error" variant="text" onClick={onClearAuto} sx={{ alignSelf: 'flex-start', p: 0 }}>
            clear {autoCount} auto
          </Button>
        )}
      </Box>

      <Divider />

      <List dense disablePadding sx={{ flex: 1, overflowY: 'auto' }}>
        {checkpoints.map((cp, idx) => (
          <Box key={cp.id}>
            <ListItem
              disablePadding
              onClick={() => onSelect(cp.id)}
              sx={{
                cursor: 'pointer', px: 1,
                bgcolor: cp.id === selectedId ? 'action.selected' : 'transparent',
                opacity: cp.source === 'auto' ? 0.7 : 1,
              }}
            >
              <Chip
                label={String(cp.order)}
                size="small"
                color={CP_COLOR[cp.type]}
                variant={cp.source === 'auto' ? 'outlined' : 'filled'}
                sx={{ mr: 1, minWidth: 28, fontSize: 11 }}
              />
              <ListItemText
                primary={cp.type}
                secondary={`r: ${cp.radius}m${cp.source === 'auto' ? ' · auto' : ''}`}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              <Box sx={{ display: 'flex', gap: 0 }}>
                <IconButton size="small" disabled={idx === 0} onClick={e => { e.stopPropagation(); onReorder(cp.id, 'up'); }}>
                  <KeyboardArrowUpIcon fontSize="inherit" />
                </IconButton>
                <IconButton size="small" disabled={idx === checkpoints.length - 1} onClick={e => { e.stopPropagation(); onReorder(cp.id, 'down'); }}>
                  <KeyboardArrowDownIcon fontSize="inherit" />
                </IconButton>
                <IconButton size="small" onClick={e => { e.stopPropagation(); setEditingId(editingId === cp.id ? null : cp.id); }}>
                  <EditIcon fontSize="inherit" />
                </IconButton>
                <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); onDelete(cp.id); }}>
                  <DeleteIcon fontSize="inherit" />
                </IconButton>
              </Box>
            </ListItem>
            <Collapse in={editingId === cp.id}>
              <CheckpointEditor
                checkpoint={cp}
                onChange={patch => onUpdate(cp.id, patch)}
              />
            </Collapse>
          </Box>
        ))}
      </List>
    </Box>
  );
}
