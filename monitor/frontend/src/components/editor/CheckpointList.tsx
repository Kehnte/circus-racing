// CheckpointList.tsx — Scrollable sidebar list of checkpoints with edit/delete/reorder.
import { useState } from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
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
}

export default function CheckpointList({
  checkpoints,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onReorder,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <Box sx={{ width: 260, overflowY: 'auto', borderLeft: '1px solid', borderColor: 'divider' }}>
      <Typography variant="overline" sx={{ px: 1.5, py: 1, display: 'block' }}>
        Checkpoints ({checkpoints.length})
      </Typography>
      <List dense disablePadding>
        {checkpoints.map((cp, idx) => (
          <Box key={cp.id}>
            <ListItem
              disablePadding
              onClick={() => onSelect(cp.id)}
              sx={{
                cursor: 'pointer', px: 1,
                bgcolor: cp.id === selectedId ? 'action.selected' : 'transparent',
              }}
            >
              <Chip
                label={String(cp.order)}
                size="small"
                color={CP_COLOR[cp.type]}
                sx={{ mr: 1, minWidth: 28, fontSize: 11 }}
              />
              <ListItemText
                primary={cp.type}
                secondary={`r: ${cp.radius}m`}
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
