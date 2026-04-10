// useEditorState — reducer-based state for the circuit editor tab.
import { useState, useCallback } from 'react';
import type { EditorCircuit, EditorCheckpoint, RawMark, TracePoint } from '../types';

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
  | { type: 'APPLY_FILTER_PREVIEW'; filtered: TracePoint[] }
  | { type: 'CLOSE_LOOP'; threshold?: number }
  | { type: 'GENERATE_CHECKPOINTS'; spacingM: number }
  | { type: 'CLEAR_AUTO_CHECKPOINTS' };

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function dist3(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function normalize(v: [number, number, number]): [number, number, number] {
  const n = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return n > 0 ? [v[0] / n, v[1] / n, v[2] / n] : v;
}

/** Travel direction at point index i in the trace, skipping stationary neighbours. */
function directionAt(points: TracePoint[], i: number): [number, number, number] {
  const pos = points[i].position;
  const MIN_DIST = 0.5;
  let prev = pos;
  for (let j = i - 1; j >= 0; j--) {
    if (points[j].gap) continue;
    if (dist3(points[j].position, pos) >= MIN_DIST) { prev = points[j].position; break; }
  }
  let nxt = pos;
  for (let j = i + 1; j < points.length; j++) {
    if (points[j].gap) continue;
    if (dist3(points[j].position, pos) >= MIN_DIST) { nxt = points[j].position; break; }
  }
  return normalize([nxt[0] - prev[0], nxt[1] - prev[1], nxt[2] - prev[2]]);
}

/** Cumulative arc lengths along non-gap points (indexed by their position in the points array). */
function arcLengths(points: TracePoint[]): number[] {
  const arc: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    if (points[i].gap || points[i - 1].gap) {
      arc.push(arc[arc.length - 1]);
    } else {
      arc.push(arc[arc.length - 1] + dist3(points[i].position, points[i - 1].position));
    }
  }
  return arc;
}

// ---------------------------------------------------------------------------
// Checkpoint generation from raw marks
// ---------------------------------------------------------------------------

let _nextId = Date.now();
function nextId() { return ++_nextId; }

/** Build EditorCheckpoints from raw record marks + trace points. */
function checkpointsFromMarks(points: TracePoint[], marks: RawMark[], circuitType: 'LOOP' | 'POINT_TO_POINT'): EditorCheckpoint[] {
  const cps: EditorCheckpoint[] = [];
  for (const mark of marks) {
    let idx = Math.min(mark.trace_idx, points.length - 1);
    // If marked point is a gap, find nearest real point (forward first, then backward)
    if (!points[idx] || points[idx].gap) {
      let found = -1;
      for (let d = 1; d < points.length; d++) {
        if (idx + d < points.length && !points[idx + d].gap) { found = idx + d; break; }
        if (idx - d >= 0 && !points[idx - d].gap) { found = idx - d; break; }
      }
      if (found < 0) continue;
      idx = found;
    }
    const point = points[idx];
    let cpType: EditorCheckpoint['type'];
    if (mark.type_hint === 'start') {
      cpType = circuitType === 'LOOP' ? 'start-finish' : 'start';
    } else if (mark.type_hint === 'finish') {
      cpType = circuitType === 'LOOP' ? 'start-finish' : 'finish';
    } else {
      cpType = 'checkpoint';
    }
    cps.push({
      id: nextId(),
      order: cps.length,
      position: point.position,
      direction: directionAt(points, idx),
      radius: mark.type_hint === 'checkpoint' ? 100 : 150,
      type: cpType,
      source: 'manual',
    });
  }
  return cps;
}

// ---------------------------------------------------------------------------
// Auto checkpoint generation
// ---------------------------------------------------------------------------

/** Generate evenly-spaced intermediate checkpoints between manual ones. */
function generateAutoCheckpoints(circuit: EditorCircuit, spacingM: number): EditorCircuit {
  const points = circuit.points.filter(p => !p.gap);
  if (points.length < 2) return circuit;

  const arc = arcLengths(circuit.points);
  const totalLen = arc[arc.length - 1];
  if (totalLen < spacingM) return circuit;

  // Keep only manual checkpoints
  const manuals = circuit.checkpoints.filter(cp => cp.source !== 'auto');

  // Anchor positions along the arc: start at 0, each manual cp, end at totalLen
  // For each gap between anchors, fill with ~spacingM intervals
  const anchorArcPositions: number[] = [0];
  for (const cp of manuals) {
    // Find the nearest point index to this checkpoint position
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < circuit.points.length; i++) {
      if (circuit.points[i].gap) continue;
      const d = dist3(circuit.points[i].position, cp.position);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    }
    anchorArcPositions.push(arc[nearest]);
  }
  anchorArcPositions.push(totalLen);

  const generated: EditorCheckpoint[] = [];

  for (let seg = 0; seg < anchorArcPositions.length - 1; seg++) {
    const segStart = anchorArcPositions[seg];
    const segEnd = anchorArcPositions[seg + 1];
    const segLen = segEnd - segStart;
    if (segLen <= 0) continue;

    // Number of intervals: round to nearest, but don't create a tiny last segment
    let n = Math.round(segLen / spacingM);
    if (n < 1) n = 1;
    if (n > 2000) return circuit; // segment too long — likely aberrant OCR points, abort
    // If the last segment would be < spacingM/3, reduce by 1
    if (n > 1 && (segLen / n) < spacingM / 3) n--;

    for (let k = 1; k < n; k++) {
      const targetArc = segStart + k * (segLen / n);
      // Binary search for closest point index
      let lo = 0, hi = arc.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        arc[mid] < targetArc ? (lo = mid + 1) : (hi = mid);
      }
      const point = circuit.points[lo];
      if (!point || point.gap) continue;
      generated.push({
        id: nextId(),
        order: 0,
        position: point.position,
        direction: directionAt(circuit.points, lo),
        radius: 100,
        type: 'checkpoint',
        source: 'auto',
      });
    }
  }

  // Merge: manual checkpoints + generated, sorted by arc position, re-ordered
  const allCps = [...manuals, ...generated];
  allCps.sort((a, b) => {
    const arcPos = (cp: EditorCheckpoint) => {
      let nearest = 0, nearestDist = Infinity;
      for (let i = 0; i < circuit.points.length; i++) {
        if (circuit.points[i].gap) continue;
        const d = dist3(circuit.points[i].position, cp.position);
        if (d < nearestDist) { nearestDist = d; nearest = i; }
      }
      return arc[nearest];
    };
    return arcPos(a) - arcPos(b);
  });

  return { ...circuit, checkpoints: allCps.map((cp, i) => ({ ...cp, order: i })) };
}

// ---------------------------------------------------------------------------
// Close loop
// ---------------------------------------------------------------------------

const DEFAULT_CLOSE_LOOP_THRESHOLD = 200; // meters

function closeLoop(circuit: EditorCircuit, threshold = DEFAULT_CLOSE_LOOP_THRESHOLD): EditorCircuit {
  const realPoints = circuit.points.filter(p => !p.gap);
  if (realPoints.length < 2) return circuit;

  // Start position: first non-gap point
  const startPos = realPoints[0].position;

  // Find the last non-gap point within threshold of the start
  // Search from the end backwards, skipping the very beginning (first 20% of trace)
  const skipUntil = Math.floor(realPoints.length * 0.2);
  let closeIdx = -1;
  let closeDist = Infinity;

  for (let i = realPoints.length - 1; i >= skipUntil; i--) {
    const d = dist3(realPoints[i].position, startPos);
    if (d <= threshold && d < closeDist) {
      closeDist = d;
      closeIdx = i;
    }
  }

  if (closeIdx < 0) return circuit; // nothing close enough

  // Map back to original points array index
  let realCount = 0;
  let cutAt = circuit.points.length - 1;
  for (let i = 0; i < circuit.points.length; i++) {
    if (!circuit.points[i].gap) {
      if (realCount === closeIdx) { cutAt = i; break; }
      realCount++;
    }
  }

  // Truncate points at cutAt, snap last point to exact start position
  const newPoints = circuit.points.slice(0, cutAt + 1).map((p, i) =>
    i === cutAt ? { ...p, position: startPos } : p
  );

  return { ...circuit, points: newPoints };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: EditorCircuit | null, action: EditorAction): EditorCircuit | null {
  switch (action.type) {
    case 'LOAD_CIRCUIT':
      return action.payload;

    case 'DELETE_POINT': {
      if (!state) return null;
      return { ...state, points: state.points.filter(p => p.id !== action.id) };
    }

    case 'DELETE_POINTS': {
      if (!state) return null;
      const idSet = new Set(action.ids);
      return { ...state, points: state.points.filter(p => !idSet.has(p.id)) };
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
      return {
        ...state,
        checkpoints: state.checkpoints
          .filter(cp => cp.id !== action.id)
          .map((cp, i) => ({ ...cp, order: i })),
      };
    }

    case 'ADD_CHECKPOINT': {
      if (!state) return null;
      const point = state.points.find(p => p.id === action.at_point_id);
      if (!point || point.gap) return state;
      const newCp: EditorCheckpoint = {
        id: nextId(),
        order: state.checkpoints.length,
        position: point.position,
        direction: directionAt(state.points, state.points.indexOf(point)),
        radius: 100,
        type: 'checkpoint',
        source: 'manual',
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
      if (!state) return null;
      return { ...state, points: action.filtered };

    case 'CLOSE_LOOP':
      if (!state) return null;
      return closeLoop(state, action.threshold);

    case 'GENERATE_CHECKPOINTS':
      if (!state) return null;
      return generateAutoCheckpoints(state, action.spacingM);

    case 'CLEAR_AUTO_CHECKPOINTS':
      if (!state) return null;
      return {
        ...state,
        checkpoints: state.checkpoints
          .filter(cp => cp.source !== 'auto')
          .map((cp, i) => ({ ...cp, order: i })),
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Parse / Serialize
// ---------------------------------------------------------------------------

/** Parse a raw circuit JSON (from file or API) into EditorCircuit with stable ids.
 *  Handles both old format (checkpoints array) and new format (marks array). */
export function parseCircuit(raw: Record<string, unknown>): EditorCircuit {
  const rawTrace = (raw.rawTrace as { t: number; position: [number, number, number] | null; gap?: boolean }[] | undefined) ?? [];
  const points: TracePoint[] = rawTrace.map((p, i) => ({
    id: i,
    t: p.t,
    position: p.position ?? [0, 0, 0],
    gap: p.gap ?? false,
  }));

  const circuitType = ((raw.type as string) === 'POINT_TO_POINT' ? 'POINT_TO_POINT' : 'LOOP') as 'LOOP' | 'POINT_TO_POINT';

  let checkpoints: EditorCheckpoint[];

  if (Array.isArray(raw.marks) && raw.marks.length > 0) {
    // New format: build checkpoints from raw marks
    checkpoints = checkpointsFromMarks(points, raw.marks as RawMark[], circuitType);
  } else {
    // Legacy format: checkpoints already computed
    const rawCps = (raw.checkpoints as Omit<EditorCheckpoint, 'id'>[] | undefined) ?? [];
    checkpoints = rawCps.map((cp, i) => ({ ...cp, id: i, source: 'manual' as const }));
  }

  return {
    name: (raw.name as string) ?? 'Circuit',
    type: circuitType,
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
    checkpoints: circuit.checkpoints.map(({ id: _id, source: _source, ...rest }) => rest),
    rawTrace: circuit.points.map(({ id: _id, ...rest }) => rest),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const HISTORY_ACTIONS = new Set([
  'LOAD_CIRCUIT',
  'DELETE_POINT', 'DELETE_POINTS',
  'UPDATE_CHECKPOINT', 'MOVE_CHECKPOINT', 'DELETE_CHECKPOINT',
  'ADD_CHECKPOINT', 'REORDER_CHECKPOINT',
  'APPLY_FILTER_PREVIEW',
  'CLOSE_LOOP', 'GENERATE_CHECKPOINTS', 'CLEAR_AUTO_CHECKPOINTS',
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

export { DEFAULT_CLOSE_LOOP_THRESHOLD, dist3 };
