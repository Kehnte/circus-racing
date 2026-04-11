// TraceViewer.tsx — Interactive 3D circuit viewer using React Three Fiber.
// Coordinates are recentered to origin before rendering to avoid Float32 precision loss
// with large world coordinates (e.g. Y=33 000 000).
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import type { EditorCircuit, TracePoint, EditorCheckpoint } from '../../types';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';

const CP_COLOR: Record<EditorCheckpoint['type'], string> = {
  'start': '#22c55e',
  'start-finish': '#22c55e',
  'checkpoint': '#e5e5e5',
  'finish': '#ef4444',
};

// ---------------------------------------------------------------------------
// Helpers — subtract offset from world coords to get local (centered) coords
// ---------------------------------------------------------------------------

type V3 = [number, number, number];

// JSON coords: [x, y, z] where x/y are horizontal and z is altitude.
// Three.js uses Y as vertical: world-x → Three-x, world-z(alt) → Three-y, world-y → Three-z.
// offset stores JSON-space center: offset.x=cx, offset.y=cy, offset.z=cz.
function localPos(pos: V3, offset: THREE.Vector3): V3 {
  return [pos[0] - offset.x, pos[2] - offset.z, pos[1] - offset.y];
}

// ---------------------------------------------------------------------------
// Camera preset snap — works in local (centered) space
// ---------------------------------------------------------------------------

type ViewPreset = 'top' | 'front' | 'side' | 'iso';

function snapToPreset(
  preset: ViewPreset,
  extent: number,
  camera: THREE.Camera,
  controls: OrbitControlsType,
) {
  const fovRad = ((camera as THREE.PerspectiveCamera).fov ?? 60) * (Math.PI / 180);
  const d = (extent * 1.5) / Math.tan(fovRad / 2);
  const cfg: Record<ViewPreset, { pos: V3; up: V3 }> = {
    top:   { pos: [0, d, 0],             up: [0, 0, -1] },
    front: { pos: [0, 0, d],             up: [0, 1, 0]  },
    side:  { pos: [d, 0, 0],             up: [0, 1, 0]  },
    iso:   { pos: [d * .6, d * .6, d * .6], up: [0, 1, 0] },
  };
  const { pos, up } = cfg[preset];
  camera.position.set(...pos);
  camera.up.set(...up);
  camera.lookAt(0, 0, 0);
  (controls as unknown as { target: THREE.Vector3; update: () => void }).target.set(0, 0, 0);
  (controls as unknown as { update: () => void }).update();
}

// ---------------------------------------------------------------------------
// CheckpointMarker — HTML overlay, same style as hover indicator
// ---------------------------------------------------------------------------

interface CheckpointMarkerProps {
  checkpoint: EditorCheckpoint;
  offset: THREE.Vector3;
  isSelected: boolean;
  onClick: (id: number) => void;
}

function CheckpointMarker({ checkpoint, offset, isSelected, onClick }: CheckpointMarkerProps) {
  const [lx, ly, lz] = localPos(checkpoint.position, offset);
  const color = CP_COLOR[checkpoint.type] ?? '#e5e5e5';

  return (
    <Html position={[lx, ly, lz]} center style={{ pointerEvents: 'auto' }}>
      <div
        onClick={e => { e.stopPropagation(); onClick(checkpoint.id); }}
        style={{
          width: 14, height: 14,
          border: `2px solid ${color}`,
          borderRadius: '50%',
          background: isSelected ? '#facc15' : color,
          opacity: 0.9,
          cursor: 'pointer',
          boxShadow: isSelected ? '0 0 6px #facc15' : `0 0 4px ${color}`,
        }}
      />
    </Html>
  );
}

// ---------------------------------------------------------------------------
// HoverIndicator
// ---------------------------------------------------------------------------

interface HoverIndicatorProps {
  points: TracePoint[];
  offset: THREE.Vector3;
  extent: number;
  hoveredId: number | null; // controlled from outside
  onHover: (id: number | null) => void;
  onClick: (id: number, shift: boolean) => void;
  onDoubleClick: (id: number) => void;
}

function HoverIndicator({ points, offset, extent, hoveredId, onHover, onClick, onDoubleClick }: HoverIndicatorProps) {
  const { raycaster } = useThree();

  const realPoints = useMemo(() => points.filter(p => !p.gap), [points]);

  const localPositions = useMemo(
    () => realPoints.map(p => new THREE.Vector3(
      p.position[0] - offset.x,
      p.position[1] - offset.y,
      p.position[2] - offset.z,
    )),
    [realPoints, offset],
  );

  // Derive hoveredLocal from controlled hoveredId
  const hoveredLocal = useMemo(() => {
    if (hoveredId === null) return null;
    const p = realPoints.find(pt => pt.id === hoveredId);
    return p ? localPos(p.position, offset) : null;
  }, [hoveredId, realPoints, offset]);

  const threshSq = (extent * 0.05) ** 2;

  const handlePointerMove = useCallback((_e: import('@react-three/fiber').ThreeEvent<PointerEvent>) => {
    if (localPositions.length === 0) return;
    const ray = raycaster.ray;
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < localPositions.length; i++) {
      const d = ray.distanceSqToPoint(localPositions[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx >= 0 && bestDist < threshSq) {
      onHover(realPoints[bestIdx].id);
    } else {
      onHover(null);
    }
  }, [localPositions, realPoints, onHover, raycaster, threshSq]);

  const handleClick = useCallback((_e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => {
    if (hoveredId !== null) onClick(hoveredId, _e.shiftKey);
  }, [hoveredId, onClick]);

  const handleDoubleClick = useCallback((_e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => {
    if (hoveredId !== null) onDoubleClick(hoveredId);
  }, [hoveredId, onDoubleClick]);

  return (
    <>
      <mesh
        visible={false}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[extent * 20, extent * 20]} />
        <meshBasicMaterial />
      </mesh>
      {hoveredLocal && (
        <Html position={hoveredLocal} center style={{ pointerEvents: 'none' }}>
          <div style={{
            width: 14, height: 14,
            border: '2px solid #facc15',
            borderRadius: '50%',
            boxShadow: '0 0 4px #facc15',
          }} />
        </Html>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// FocusController — move camera to a specific local position
// ---------------------------------------------------------------------------

interface FocusControllerProps {
  target: { pos: V3; radius: number } | null;
  controlsRef: React.RefObject<OrbitControlsType | null>;
  onDone: () => void;
}

function FocusController({ target, controlsRef, onDone }: FocusControllerProps) {
  const { camera } = useThree();

  useEffect(() => {
    if (!target || !controlsRef.current) return;
    const [tx, ty, tz] = target.pos;
    const fovRad = ((camera as THREE.PerspectiveCamera).fov ?? 60) * (Math.PI / 180);
    const dist = (target.radius * 2) / Math.tan(fovRad / 2);
    camera.position.set(tx, ty + dist * 0.6, tz + dist * 0.8);
    camera.up.set(0, 1, 0);
    camera.lookAt(tx, ty, tz);
    (controlsRef.current as unknown as { target: THREE.Vector3; update: () => void }).target.set(tx, ty, tz);
    (controlsRef.current as unknown as { update: () => void }).update();
    onDone();
  }, [target, camera, controlsRef, onDone]);

  return null;
}

// ---------------------------------------------------------------------------
// CameraSetup — fit on load or fitKey change
// ---------------------------------------------------------------------------

interface CameraSetupProps {
  extent: number;
  controlsRef: React.RefObject<OrbitControlsType | null>;
  fitKey: number;
}

function CameraSetup({ extent, controlsRef, fitKey }: CameraSetupProps) {
  const { camera } = useThree();
  const extentRef = useRef(extent);
  extentRef.current = extent;

  useEffect(() => {
    const e = extentRef.current;
    if (e === 0) return;
    const fovRad = ((camera as THREE.PerspectiveCamera).fov ?? 60) * (Math.PI / 180);
    const dist = (e * 1.5) / Math.tan(fovRad / 2);
    camera.position.set(0, dist * 0.6, dist * 0.8);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      (controlsRef.current as unknown as { target: THREE.Vector3 }).target.set(0, 0, 0);
      (controlsRef.current as unknown as { update: () => void }).update();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return null;
}

// ---------------------------------------------------------------------------
// PresetController — snap camera when a preset is requested
// ---------------------------------------------------------------------------

interface PresetControllerProps {
  preset: ViewPreset | null;
  extent: number;
  controlsRef: React.RefObject<OrbitControlsType | null>;
  onDone: () => void;
}

function PresetController({ preset, extent, controlsRef, onDone }: PresetControllerProps) {
  const { camera } = useThree();

  useEffect(() => {
    if (!preset || !controlsRef.current) return;
    snapToPreset(preset, extent, camera, controlsRef.current);
    onDone();
  }, [preset, extent, camera, controlsRef, onDone]);

  return null;
}

// ---------------------------------------------------------------------------
// TraceLines — renders in local (centered) space
// ---------------------------------------------------------------------------

interface TraceLinesProps {
  points: TracePoint[];
  offset: THREE.Vector3;
  color: string;
  opacity: number;
}

function TraceLines({ points, offset, color, opacity }: TraceLinesProps) {
  const segments = useMemo(() => {
    const segs: V3[][] = [];
    let current: V3[] = [];
    for (const p of points) {
      if (p.gap) {
        if (current.length >= 2) segs.push(current);
        current = [];
      } else {
        current.push(localPos(p.position, offset));
      }
    }
    if (current.length >= 2) segs.push(current);
    return segs;
  }, [points, offset]);

  const gapPairs = useMemo(() => {
    const pairs: [V3, V3][] = [];
    let lastReal: V3 | null = null;
    for (const p of points) {
      if (!p.gap) { lastReal = localPos(p.position, offset); }
      else if (lastReal) {
        const nextReal = points.find(q => q.t > p.t && !q.gap);
        if (nextReal) pairs.push([lastReal, localPos(nextReal.position, offset)]);
      }
    }
    return pairs;
  }, [points, offset]);

  return (
    <>
      {segments.map((seg, i) => (
        <Line key={i} points={seg} color={color} lineWidth={2} transparent opacity={opacity} />
      ))}
      {gapPairs.map(([a, b], i) => (
        <Line key={`gap-${i}`} points={[a, b]} color="#666" lineWidth={1} dashed dashSize={8} gapSize={8} transparent opacity={opacity * 0.6} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// PointsPanel — scrollable list of trace points with coords
// ---------------------------------------------------------------------------

interface PointsPanelProps {
  points: TracePoint[];
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  onClick: (id: number, shift: boolean) => void;
}

function PointsPanel({ points, hoveredId, onHover, onClick }: PointsPanelProps) {
  const hoveredRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    hoveredRef.current?.scrollIntoView({ block: 'nearest' });
  }, [hoveredId]);

  return (
    <Box sx={{
      width: 180, flexShrink: 0, height: '100%', overflowY: 'auto',
      borderLeft: '1px solid', borderColor: 'divider',
      fontSize: 11, fontFamily: 'monospace',
    }}>
      {points.map((p, idx) => {
        const isHovered = p.id === hoveredId;
        return (
          <Box
            key={p.id}
            ref={isHovered ? (hoveredRef as React.RefObject<HTMLDivElement>) : null}
            onMouseEnter={() => !p.gap && onHover(p.id)}
            onMouseLeave={() => onHover(null)}
            onClick={e => !p.gap && onClick(p.id, e.shiftKey)}
            sx={{
              px: 0.75, py: '1px',
              background: isHovered ? 'rgba(250,204,21,0.15)' : 'transparent',
              color: p.gap ? 'text.disabled' : 'text.secondary',
              lineHeight: '18px',
              whiteSpace: 'nowrap',
              cursor: p.gap ? 'default' : 'pointer',
              '&:hover': { background: p.gap ? 'transparent' : 'rgba(250,204,21,0.1)' },
            }}
          >
            {p.gap ? (
              <Typography variant="inherit" sx={{ color: 'text.disabled' }}>— gap —</Typography>
            ) : (
              <span>#{idx} {Math.round(p.position[0])} {Math.round(p.position[1])} {Math.round(p.position[2])}</span>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface TraceViewerProps {
  circuit: EditorCircuit | null;
  filteredPoints: TracePoint[] | null;
  selectedIds: Set<number>;
  onPointClick: (id: number, shift: boolean) => void;
  onAddCheckpoint: (at_point_id: number) => void;
  onDeleteSelected: () => void;
  onCheckpointMove: (id: number, position: V3) => void;
  onCheckpointClick: (id: number) => void;
  selectedCheckpointId: number | null;
  fitRequest?: number;
}

const PRESET_LABELS: ViewPreset[] = ['top', 'front', 'side', 'iso'];

export default function TraceViewer({
  circuit,
  filteredPoints,
  selectedIds,
  onPointClick,
  onAddCheckpoint,
  onDeleteSelected,
  onCheckpointMove: _onCheckpointMove,
  onCheckpointClick,
  selectedCheckpointId,
  fitRequest = 0,
}: TraceViewerProps) {
  const [fitKey, setFitKey] = useState(0);
  const [pendingPreset, setPendingPreset] = useState<ViewPreset | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ pos: V3; radius: number } | null>(null);
  const controlsRef = useRef<OrbitControlsType | null>(null);

  // Re-fit on new circuit load
  const prevName = useRef<string | null>(null);
  useEffect(() => {
    if (circuit?.name !== prevName.current) {
      prevName.current = circuit?.name ?? null;
      setFitKey(k => k + 1);
    }
  }, [circuit?.name]);

  // Re-fit when externally requested (e.g. after apply filter)
  useEffect(() => {
    if (fitRequest > 0) setFitKey(k => k + 1);
  }, [fitRequest]);

  // Center/extent computed on filtered points + checkpoints — avoids aberrant points dominating
  const { center, extent } = useMemo(() => {
    const tracePts = (filteredPoints ?? circuit?.points ?? []).filter(p => !p.gap);
    const cpPts = (circuit?.checkpoints ?? []).map(cp => ({ position: cp.position }));
    const source = [...tracePts, ...cpPts];
    if (source.length === 0) return { center: new THREE.Vector3(), extent: 1000 };
    // Use per-axis median for center — robust against aberrant OCR points
    const sorted0 = [...source].sort((a, b) => a.position[0] - b.position[0]);
    const sorted1 = [...source].sort((a, b) => a.position[1] - b.position[1]);
    const sorted2 = [...source].sort((a, b) => a.position[2] - b.position[2]);
    const mid = Math.floor(source.length / 2);
    const c = new THREE.Vector3(sorted0[mid].position[0], sorted1[mid].position[1], sorted2[mid].position[2]);
    const dists = source.map(p => {
      const dx = p.position[0] - c.x, dy = p.position[1] - c.y;
      return Math.sqrt(dx * dx + dy * dy);
    }).sort((a, b) => a - b);
    // Use 80th percentile — tighter than p95 to avoid outliers inflating the extent
    const p80 = dists[Math.floor(dists.length * 0.80)] ?? dists[dists.length - 1];
    return { center: c, extent: Math.max(p80, 100) };
  }, [circuit, filteredPoints]);

  const showRaw = !!filteredPoints;
  const displayPoints = filteredPoints ?? circuit?.points ?? [];

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
      {/* Toolbar */}
      <Box sx={{ position: 'absolute', top: 8, right: 188, zIndex: 10, display: 'flex', gap: 0.5 }}>
        <Tooltip title="Fit view">
          <IconButton size="small" onClick={() => setFitKey(k => k + 1)}>
            <FitScreenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {PRESET_LABELS.map(p => (
          <Tooltip key={p} title={`${p.charAt(0).toUpperCase() + p.slice(1)} view`}>
            <IconButton size="small" onClick={() => setPendingPreset(p)} sx={{ fontSize: 10, fontWeight: 600, width: 28, height: 28 }}>
              {p.slice(0, 3).toUpperCase()}
            </IconButton>
          </Tooltip>
        ))}
        {selectedIds.size > 0 && (
          <Tooltip title={`Delete ${selectedIds.size} selected point(s)`}>
            <IconButton size="small" color="error" onClick={onDeleteSelected}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {circuit ? (
        <>
          <Canvas
            style={{ flex: 1, height: '100%' }}
            camera={{ fov: 60, near: 0.1, far: extent * 200 + 1000 }}
            onCreated={({ scene }) => { scene.background = new THREE.Color('#0a0a0a'); }}
          >
            <ambientLight intensity={0.6} />
            <directionalLight position={[0, extent * 2, 0]} intensity={0.8} />

            <OrbitControls
              ref={controlsRef}
              enablePan
              enableZoom
              enableRotate
              makeDefault
            />

            <CameraSetup extent={extent} controlsRef={controlsRef} fitKey={fitKey} />
            <FocusController target={focusTarget} controlsRef={controlsRef} onDone={() => setFocusTarget(null)} />
            <PresetController
              preset={pendingPreset}
              extent={extent}
              controlsRef={controlsRef}
              onDone={() => setPendingPreset(null)}
            />

            {showRaw && circuit.points && (
              <TraceLines points={circuit.points} offset={center} color="#555" opacity={0.35} />
            )}

            <TraceLines points={displayPoints} offset={center} color="#e5e5e5" opacity={1} />

            {circuit.checkpoints.map(cp => (
              <CheckpointMarker
                key={cp.id}
                checkpoint={cp}
                offset={center}
                isSelected={cp.id === selectedCheckpointId}
                onClick={onCheckpointClick}
              />
            ))}

            {[...selectedIds].map(id => {
              const pt = circuit.points.find(p => p.id === id);
              if (!pt || pt.gap) return null;
              return (
                <Html key={id} position={localPos(pt.position, center)} center style={{ pointerEvents: 'none' }}>
                  <div style={{
                    width: 10, height: 10,
                    background: '#facc15',
                    borderRadius: '50%',
                    opacity: 0.9,
                  }} />
                </Html>
              );
            })}

            <HoverIndicator
              points={displayPoints}
              offset={center}
              extent={extent}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onClick={onPointClick}
              onDoubleClick={onAddCheckpoint}
            />
          </Canvas>

          <PointsPanel
            points={displayPoints}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onClick={(id, shift) => {
              onPointClick(id, shift);
              const pt = displayPoints.find(p => p.id === id);
              if (pt && !pt.gap) {
                setFocusTarget({ pos: localPos(pt.position, center), radius: Math.max(extent * 0.05, 10) });
              }
            }}
          />
        </>
      ) : (
        <Box sx={{
          flex: 1, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: 'text.disabled', fontSize: 14,
        }}>
          Open a circuit file or load the last recording to start editing.
        </Box>
      )}
    </Box>
  );
}
