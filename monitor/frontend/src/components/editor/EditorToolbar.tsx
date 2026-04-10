// EditorToolbar.tsx — File open, load last recording, circuit meta, close loop, export controls.
import { useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import type { EditorCircuit, TracePoint } from '../../types';
import { parseCircuit, serializeCircuit, DEFAULT_CLOSE_LOOP_THRESHOLD, dist3 } from '../../hooks/useEditorState';

interface Props {
  circuit: EditorCircuit | null;
  filteredPoints: TracePoint[] | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onLoad: (circuit: EditorCircuit) => void;
  onNameChange: (name: string) => void;
  onTypeChange: (type: 'LOOP' | 'POINT_TO_POINT') => void;
  onCloseLoop: () => void;
}

export default function EditorToolbar({ circuit, filteredPoints, canUndo, canRedo, onUndo, onRedo, onLoad, onNameChange, onTypeChange, onCloseLoop }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const raw = JSON.parse(ev.target?.result as string) as Record<string, unknown>;
        onLoad(parseCircuit(raw));
      } catch {
        // Invalid JSON — ignore silently
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleLoadLast() {
    const res = await fetch('/api/record/last-json');
    if (!res.ok) return;
    const raw = await res.json() as Record<string, unknown>;
    onLoad(parseCircuit(raw));
  }

  async function handleExport() {
    if (!circuit) return;
    // Use filtered trace if preview is active, otherwise export raw as-is
    const exportCircuit = filteredPoints
      ? { ...circuit, points: filteredPoints }
      : circuit;
    const body = serializeCircuit(exportCircuit);
    const res = await fetch('/api/editor/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const { filename } = await res.json() as { filename: string };
      // Trigger browser download
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // Show close loop button when last point is within threshold of first (loop circuits only)
  const canCloseLoop = (() => {
    if (!circuit || circuit.type !== 'LOOP') return false;
    const real = circuit.points.filter(p => !p.gap);
    if (real.length < 2) return false;
    return dist3(real[0].position, real[real.length - 1].position) <= DEFAULT_CLOSE_LOOP_THRESHOLD;
  })();

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <Button
        size="small"
        startIcon={<FolderOpenIcon />}
        variant="outlined"
        onClick={() => fileInputRef.current?.click()}
      >
        open file
      </Button>
      <Button
        size="small"
        startIcon={<DownloadIcon />}
        variant="outlined"
        onClick={handleLoadLast}
      >
        load last recording
      </Button>
      <Tooltip title="Undo (Ctrl+Z)">
        <span>
          <IconButton size="small" onClick={onUndo} disabled={!canUndo}>
            <UndoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Redo (Ctrl+Y)">
        <span>
          <IconButton size="small" onClick={onRedo} disabled={!canRedo}>
            <RedoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <TextField
        size="small"
        label="Name"
        value={circuit?.name ?? ''}
        onChange={e => onNameChange(e.target.value)}
        sx={{ width: 160 }}
        disabled={!circuit}
      />
      <Select
        size="small"
        value={circuit?.type ?? 'LOOP'}
        onChange={e => onTypeChange(e.target.value as 'LOOP' | 'POINT_TO_POINT')}
        disabled={!circuit}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="LOOP">Loop</MenuItem>
        <MenuItem value="POINT_TO_POINT">Point to point</MenuItem>
      </Select>
      {canCloseLoop && (
        <Tooltip title="Snap last point to start and trim trailing points">
          <Button size="small" variant="outlined" color="warning" onClick={onCloseLoop}>
            close loop
          </Button>
        </Tooltip>
      )}
      <Box sx={{ flex: 1 }} />
      <Button
        size="small"
        startIcon={<UploadIcon />}
        variant="contained"
        onClick={handleExport}
        disabled={!circuit}
        title={filteredPoints ? 'Export filtered trace' : 'Export raw trace'}
      >
        {filteredPoints ? 'export (filtered)' : 'export'}
      </Button>
    </Box>
  );
}
