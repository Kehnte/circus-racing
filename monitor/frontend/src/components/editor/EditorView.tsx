// EditorView.tsx — Root layout for the circuit editor tab.
import { useState, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import type { EditorCircuit, EditorCheckpoint, FilterConfig, TracePoint } from '../../types';
import { useEditorState } from '../../hooks/useEditorState';
import EditorToolbar from './EditorToolbar';
import TraceViewer from './TraceViewer';
import FilterPanel from './FilterPanel';
import CheckpointList from './CheckpointList';

const DEFAULT_FILTER: FilterConfig = {
  jump_enabled: true,
  jump_threshold: 500,
  iqr_enabled: true,
  iqr_multiplier: 1.5,
  angular_enabled: true,
  angular_max_angle: 120,
  rolling_enabled: true,
  rolling_window: 5,
};

export default function EditorView() {
  const { circuit, dispatch, undo, redo, canUndo, canRedo } = useEditorState();
  const [selectedPointIds, setSelectedPointIds] = useState<Set<number>>(new Set());
  const [selectedCpId, setSelectedCpId] = useState<number | null>(null);
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER);
  const [filteredPoints, setFilteredPoints] = useState<TracePoint[] | null>(null);
  const [previewEnabled, setPreviewEnabled] = useState(false);

  const handleLoad = useCallback((c: EditorCircuit) => {
    dispatch({ type: 'LOAD_CIRCUIT', payload: c });
    setSelectedPointIds(new Set());
    setSelectedCpId(null);
    setFilteredPoints(null);
  }, [dispatch]);

  const handlePointClick = useCallback((id: number, shift: boolean) => {
    setSelectedCpId(null); // clicking a trace point deselects any checkpoint
    setSelectedPointIds(prev => {
      const next = new Set(prev);
      if (shift) {
        next.has(id) ? next.delete(id) : next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedPointIds.size === 0) return;
    dispatch({ type: 'DELETE_POINTS', ids: [...selectedPointIds] });
    setSelectedPointIds(new Set());
  }, [dispatch, selectedPointIds]);

  const handleFilterChange = useCallback((patch: Partial<FilterConfig>) => {
    setFilterConfig(prev => ({ ...prev, ...patch }));
  }, []);

  const handlePreviewReady = useCallback((pts: TracePoint[] | null) => {
    setFilteredPoints(pts);
  }, []);

  const handleTogglePreview = useCallback((enabled: boolean) => {
    setPreviewEnabled(enabled);
    if (!enabled) setFilteredPoints(null);
  }, []);

  // Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) for undo/redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.ctrlKey) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 88px)' }}>
      <EditorToolbar
        circuit={circuit}
        filteredPoints={previewEnabled ? filteredPoints : null}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onLoad={handleLoad}
        onNameChange={name => dispatch({ type: 'SET_META', name })}
        onTypeChange={circuitType => dispatch({ type: 'SET_META', circuitType })}
      />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <FilterPanel
          rawPoints={circuit?.points ?? []}
          filterConfig={filterConfig}
          onChange={handleFilterChange}
          onPreviewReady={handlePreviewReady}
          previewEnabled={previewEnabled}
          onTogglePreview={handleTogglePreview}
        />
        <TraceViewer
          circuit={circuit}
          filteredPoints={previewEnabled ? filteredPoints : null}
          selectedIds={selectedPointIds}
          onPointClick={handlePointClick}
          onAddCheckpoint={id => dispatch({ type: 'ADD_CHECKPOINT', at_point_id: id })}
          onDeleteSelected={handleDeleteSelected}
          onCheckpointMove={(id, pos) => dispatch({ type: 'MOVE_CHECKPOINT', id, position: pos })}
          onCheckpointClick={id => setSelectedCpId(prev => prev === id ? null : id)}
          selectedCheckpointId={selectedCpId}
        />
        {circuit && (
          <CheckpointList
            checkpoints={circuit.checkpoints}
            selectedId={selectedCpId}
            onSelect={id => { setSelectedPointIds(new Set()); setSelectedCpId(prev => prev === id ? null : id); }}
            onUpdate={(id, patch) => dispatch({ type: 'UPDATE_CHECKPOINT', id, patch: patch as Partial<EditorCheckpoint> })}
            onDelete={id => dispatch({ type: 'DELETE_CHECKPOINT', id })}
            onReorder={(id, direction) => dispatch({ type: 'REORDER_CHECKPOINT', id, direction })}
          />
        )}
      </Box>
    </Box>
  );
}
