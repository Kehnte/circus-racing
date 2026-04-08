// useEditorState — reducer-based state for the circuit editor tab.
import { useState, useCallback } from 'react';
import type { EditorCircuit, EditorCheckpoint, TracePoint } from '../types';

type EditorAction =
  | { type: 'LOAD_CIRCUIT'; payload: EditorCircuit }
  | { type: 'DELETE_POINT'; id: number }
  | { type: 'DELETE_POINTS'; ids: number[] }
  | { type: 'UPDATE_CHECKPOINT'; id: number; patch: Partial<EditorCheckpoint> }
  | { type: 'MOVE_CHECKPOINT'; id: number; position: [number, number, number] }
  | { type: 'DELETE_CHECKPOINT'; id: number }
  | { type: 'ADD_CHECKPOINT'; at_point_id: number }
  | { type: 'REORDER_CHECKPOINT'; id: number; direction: 'up' | 'down' }
  | { type: 'SET_META'; name?: string; circuitType?: 'LOOP' | 'POINT_TO_POINT' }
  | { type: 'APPLY_FILTER_PREVIEW'; filtered: TracePoint[] };

function reducer(state: EditorCircuit | null, action: EditorAction): EditorCircuit | null {
  switch (action.type) {
    case 'LOAD_CIRCUIT':
      return action.payload;

    case 'DELETE_POINT': {
      if (!state) return null;
      const points = state.points.filter(p => p.id !== action.id);
      return { ...state, points };
    }

    case 'DELETE_POINTS': {
      if (!state) return null;
      const idSet = new Set(action.ids);
      const points = state.points.filter(p => !idSet.has(p.id));
      return { ...state, points };
    }

    case 'UPDATE_CHECKPOINT': {
      if (!state) return null;
      return {
        ...state,
        checkpoints: state.checkpoints.map(cp =>
          cp.id === action.id ? { ...cp, ...action.patch } : cp
        ),
      };
    }

    case 'MOVE_CHECKPOINT': {
      if (!state) return null;
      return {
        ...state,
        checkpoints: state.checkpoints.map(cp =>
          cp.id === action.id ? { ...cp, position: action.position } : cp
        ),
      };
    }

    case 'DELETE_CHECKPOINT': {
      if (!state) return null;
      const checkpoints = state.checkpoints
        .filter(cp => cp.id !== action.id)
        .map((cp, i) => ({ ...cp, order: i }));
      return { ...state, checkpoints };
    }

    case 'ADD_CHECKPOINT': {
      if (!state) return null;
      const point = state.points.find(p => p.id === action.at_point_id);
      if (!point || point.gap) return state;
      const newCp: EditorCheckpoint = {
        id: Date.now(),
        order: state.checkpoints.length,
        position: point.position,
        direction: [0, 0, 1],
        radius: 100,
        type: 'checkpoint',
      };
      return { ...state, checkpoints: [...state.checkpoints, newCp] };
    }

    case 'REORDER_CHECKPOINT': {
      if (!state) return null;
      const cps = [...state.checkpoints];
      const idx = cps.findIndex(cp => cp.id === action.id);
      if (idx < 0) return state;
      const target = action.direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= cps.length) return state;
      [cps[idx], cps[target]] = [cps[target], cps[idx]];
      return { ...state, checkpoints: cps.map((cp, i) => ({ ...cp, order: i })) };
    }

    case 'SET_META': {
      if (!state) return null;
      return {
        ...state,
        ...(action.name !== undefined ? { name: action.name } : {}),
        ...(action.circuitType !== undefined ? { type: action.circuitType } : {}),
      };
    }

    case 'APPLY_FILTER_PREVIEW':
      // Replace points with filtered result (keeps checkpoints as-is)
      if (!state) return null;
      return { ...state, points: action.filtered };

    default:
      return state;
  }
}

/** Parse a raw circuit JSON (from file or API) into EditorCircuit with stable ids. */
export function parseCircuit(raw: Record<string, unknown>): EditorCircuit {
  const rawTrace = (raw.rawTrace as { t: number; position: [number, number, number] | null; gap?: boolean }[] | undefined) ?? [];
  const points: TracePoint[] = rawTrace.map((p, i) => ({
    id: i,
    t: p.t,
    position: p.position ?? [0, 0, 0],
    gap: p.gap ?? false,
  }));

  const rawCps = (raw.checkpoints as Omit<EditorCheckpoint, 'id'>[] | undefined) ?? [];
  const checkpoints: EditorCheckpoint[] = rawCps.map((cp, i) => ({
    ...cp,
    id: i,
  }));

  return {
    name: (raw.name as string) ?? 'Circuit',
    type: (raw.type as 'LOOP' | 'POINT_TO_POINT') ?? 'LOOP',
    recordedBy: (raw.recordedBy as string) ?? '',
    recordedAt: (raw.recordedAt as string) ?? '',
    defaultBufferRadius: (raw.defaultBufferRadius as number) ?? 500,
    points,
    checkpoints,
  };
}

/** Serialize an EditorCircuit back to the wire format for export. */
export function serializeCircuit(circuit: EditorCircuit): Record<string, unknown> {
  return {
    name: circuit.name,
    type: circuit.type,
    recordedBy: circuit.recordedBy,
    recordedAt: circuit.recordedAt,
    defaultBufferRadius: circuit.defaultBufferRadius,
    checkpoints: circuit.checkpoints.map(({ id: _id, ...rest }) => rest),
    rawTrace: circuit.points.map(({ id: _id, ...rest }) => rest),
  };
}

// Actions that mutate the circuit and should push to undo history
const HISTORY_ACTIONS = new Set([
  'LOAD_CIRCUIT',
  'DELETE_POINT', 'DELETE_POINTS',
  'UPDATE_CHECKPOINT', 'MOVE_CHECKPOINT', 'DELETE_CHECKPOINT',
  'ADD_CHECKPOINT', 'REORDER_CHECKPOINT',
  'APPLY_FILTER_PREVIEW',
]);

const MAX_HISTORY = 50;

interface HistoryState {
  past: (EditorCircuit | null)[];
  present: EditorCircuit | null;
  future: (EditorCircuit | null)[];
}

export function useEditorState() {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: null,
    future: [],
  });

  const dispatch = useCallback((action: EditorAction) => {
    setHistory((prev: HistoryState) => {
      const next = reducer(prev.present, action);
      if (!HISTORY_ACTIONS.has(action.type)) return { ...prev, present: next };
      return {
        past: [...prev.past.slice(-MAX_HISTORY + 1), prev.present],
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((prev: HistoryState) => {
      if (prev.past.length === 0) return prev;
      const past = [...prev.past];
      const present = past.pop()!;
      return { past, present, future: [prev.present, ...prev.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prev: HistoryState) => {
      if (prev.future.length === 0) return prev;
      const [present, ...future] = prev.future;
      return { past: [...prev.past, prev.present], present, future };
    });
  }, []);

  return {
    circuit: history.present,
    dispatch,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
