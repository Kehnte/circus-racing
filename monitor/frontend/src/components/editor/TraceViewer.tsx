// TraceViewer.tsx — Interactive 3D circuit viewer using React Three Fiber.
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import GridOnIcon from '@mui/icons-material/GridOn';
import DeleteIcon from '@mui/icons-material/Delete';
import type { EditorCircuit, TracePoint, EditorCheckpoint } from '../../types';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';

// --- Checkpoint colors matching the app theme ---
const CP_COLOR: Record<EditorCheckpoint['type'], string> = {
  'start': '#22c55e',
  'start-finish': '#22c55e',
  'checkpoint': '#e5e5e5',
  'finish': '#ef4444',
};

// --- Single checkpoint sphere with drag support ---
interface CheckpointMeshProps {
  checkpoint: EditorCheckpoint;
  extent: number;
  onMove: (id: number, position: [number, number, number]) => void;
  isSelected: boolean;
  onClick: (id: number) => void;
}

function CheckpointMesh({ checkpoint, extent, onMove, isSelected, onClick }: CheckpointMeshProps) {
  const sphereR = extent * 0.008;
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { gl, raycaster } = useThree();
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const intersectPoint = useRef(new THREE.Vector3());

  const [px, py, pz] = checkpoint.position;

  const onPointerDown = useCallback((e: import('@react-three/fiber').ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setDragging(true);
    gl.domElement.setPointerCapture(e.pointerId);
    planeRef.current.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(px, py, pz),
    );
  }, [gl, px, py, pz]);

  const onPointerMove = useCallback((e: import('@react-three/fiber').ThreeEvent<PointerEvent>) => {
    if (!dragging) return;
    e.stopPropagation();
    raycaster.ray.intersectPlane(planeRef.current, intersectPoint.current);
    onMove(checkpoint.id, [
      intersectPoint.current.x,
      py,
      intersectPoint.current.z,
    ]);
  }, [dragging, raycaster, onMove, checkpoint.id, py]);

  const onPointerUp = useCallback((e: import('@react-three/fiber').ThreeEvent<PointerEvent>) => {
    setDragging(false);
    gl.domElement.releasePointerCapture(e.pointerId);
  }, [gl]);

  // Draw direction arrow as a simple line, scaled to extent
  const [dx, , dz] = checkpoint.direction;
  const arrowLen = extent * 0.08;
  const arrowEnd: [number, number, number] = [px + dx * arrowLen, py, pz + dz * arrowLen];

  const color = CP_COLOR[checkpoint.type] ?? '#e5e5e5';
  const scale = hovered || isSelected ? 1.4 : 1.0;

  return (
    <group>
      <mesh
        position={[px, py, pz]}
        scale={scale}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={e => { e.stopPropagation(); onClick(checkpoint.id); }}
      >
        <sphereGeometry args={[sphereR, 12, 12]} />
        <meshStandardMaterial color={isSelected ? '#facc15' : color} />
      </mesh>
      <Line
        points={[[px, py, pz], arrowEnd]}
        color={color}
        lineWidth={1.5}
      />
    </group>
  );
}

// --- Hover point indicator that follows mouse ---
interface HoverIndicatorProps {
  points: TracePoint[];
  center: THREE.Vector3;
  extent: number;
  onHover: (id: number | null) => void;
  onClick: (id: number, shift: boolean) => void;
  onDoubleClick: (id: number) => void;
}

function HoverIndicator({ points, center, extent, onHover, onClick, onDoubleClick }: HoverIndicatorProps) {
  const { raycaster } = useThree();
  const [hoveredPos, setHoveredPos] = useState<[number, number, number] | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const realPoints = useMemo(() => points.filter(p => !p.gap), [points]);
  const positions = useMemo(
    () => realPoints.map(p => new THREE.Vector3(p.position[0], p.position[1], p.position[2])),
    [realPoints],
  );

  // Threshold scales with circuit extent so it works at any world scale
  const threshSq = (extent * 0.05) ** 2;

  const handlePointerMove = useCallback((_e: import('@react-three/fiber').ThreeEvent<PointerEvent>) => {
    if (positions.length === 0) return;
    const ray = raycaster.ray;
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < positions.length; i++) {
      const d = ray.distanceSqToPoint(positions[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx >= 0 && bestDist < threshSq) {
      const p = realPoints[bestIdx];
      setHoveredPos(p.position);
      setHoveredId(p.id);
      onHover(p.id);
    } else {
      setHoveredPos(null);
      setHoveredId(null);
      onHover(null);
    }
  }, [positions, realPoints, onHover, raycaster, threshSq]);

  const handleClick = useCallback((_e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => {
    if (hoveredId !== null) {
      onClick(hoveredId, _e.shiftKey);
    }
  }, [hoveredId, onClick]);

  const handleDoubleClick = useCallback((_e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => {
    if (hoveredId !== null) {
      onDoubleClick(hoveredId);
    }
  }, [hoveredId, onDoubleClick]);

  // Invisible large plane at circuit Y level to capture pointer events
  return (
    <>
      <mesh
        visible={false}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        position={[center.x, center.y, center.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[extent * 20, extent * 20]} />
        <meshBasicMaterial />
      </mesh>
      {hoveredPos && (
        <Html position={hoveredPos} center style={{ pointerEvents: 'none' }}>
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

// --- Camera helpers ---

/** Fits the camera to the circuit whenever center/extent changes (new circuit loaded). */
interface CameraSetupProps {
  center: THREE.Vector3;
  extent: number;
  controlsRef: React.RefObject<OrbitControlsType | null>;
  fitKey: number; // increment to force re-fit
}

function CameraSetup({ center, extent, controlsRef, fitKey }: CameraSetupProps) {
  const { camera } = useThree();

  useEffect(() => {
    if (extent === 0) return;
    const fovRad = ((camera as THREE.PerspectiveCamera).fov ?? 60) * (Math.PI / 180);
    // Distance needed so the circuit fills ~80% of the vertical FOV
    const dist = (extent * 1.3) / Math.tan(fovRad / 2);
    // Offset camera at 45° above the circuit plane
    camera.position.set(
      center.x,
      center.y + dist * 0.6,
      center.z + dist * 0.8,
    );
    camera.lookAt(center);
    if (controlsRef.current) {
      (controlsRef.current as unknown as { target: THREE.Vector3 }).target.copy(center);
      (controlsRef.current as unknown as { update: () => void }).update();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return null;
}

interface TopDownControllerProps {
  topDown: boolean;
  center: THREE.Vector3;
  extent: number;
  controlsRef: React.RefObject<OrbitControlsType | null>;
}

function TopDownController({ topDown, center, extent, controlsRef }: TopDownControllerProps) {
  const { camera } = useThree();

  useEffect(() => {
    if (!topDown) return;
    const fovRad = ((camera as THREE.PerspectiveCamera).fov ?? 60) * (Math.PI / 180);
    const dist = (extent * 1.3) / Math.tan(fovRad / 2);
    camera.position.set(center.x, center.y + dist, center.z);
    camera.up.set(0, 0, -1);
    camera.lookAt(center);
    if (controlsRef.current) {
      (controlsRef.current as unknown as { target: THREE.Vector3 }).target.copy(center);
      (controlsRef.current as unknown as { update: () => void }).update();
    }
  }, [topDown, center, extent, camera, controlsRef]);

  return null;
}

// --- Trace lines with gap support ---
interface TraceLinesProps {
  points: TracePoint[];
  color: string;
  opacity: number;
}

function TraceLines({ points, color, opacity }: TraceLinesProps) {
  // Split points into segments separated by gaps
  const segments = useMemo(() => {
    const segs: [number, number, number][][] = [];
    let current: [number, number, number][] = [];
    for (const p of points) {
      if (p.gap) {
        if (current.length >= 2) segs.push(current);
        current = [];
      } else {
        current.push(p.position);
      }
    }
    if (current.length >= 2) segs.push(current);
    return segs;
  }, [points]);

  const gapPairs = useMemo(() => {
    const pairs: [[number, number, number], [number, number, number]][] = [];
    let lastReal: [number, number, number] | null = null;
    for (const p of points) {
      if (!p.gap) { lastReal = p.position; }
      else if (lastReal) {
        // Find next real point
        const nextReal = points.find(q => q.t > p.t && !q.gap);
        if (nextReal) pairs.push([lastReal, nextReal.position]);
      }
    }
    return pairs;
  }, [points]);

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

// --- Main component ---
export interface TraceViewerProps {
  circuit: EditorCircuit | null;
  filteredPoints: TracePoint[] | null;
  selectedIds: Set<number>;
  onPointClick: (id: number, shift: boolean) => void;
  onAddCheckpoint: (at_point_id: number) => void;
  onDeleteSelected: () => void;
  onCheckpointMove: (id: number, position: [number, number, number]) => void;
  onCheckpointClick: (id: number) => void;
  selectedCheckpointId: number | null;
}

export default function TraceViewer({
  circuit,
  filteredPoints,
  selectedIds,
  onPointClick,
  onAddCheckpoint,
  onDeleteSelected,
  onCheckpointMove,
  onCheckpointClick,
  selectedCheckpointId,
}: TraceViewerProps) {
  const [topDown, setTopDown] = useState(false);
  const controlsRef = useRef<OrbitControlsType | null>(null);
  // Increments each time a new circuit is loaded, triggering a camera re-fit
  const fitKey = useRef(0);
  const prevCircuitName = useRef<string | null>(null);
  if (circuit?.name !== prevCircuitName.current) {
    prevCircuitName.current = circuit?.name ?? null;
    fitKey.current += 1;
  }

  const { center, extent } = useMemo(() => {
    if (!circuit) return { center: new THREE.Vector3(), extent: 1000 };
    const real = circuit.points.filter(p => !p.gap);
    if (real.length === 0) return { center: new THREE.Vector3(), extent: 1000 };
    const sum = real.reduce((acc, p) => [acc[0] + p.position[0], acc[1] + p.position[1], acc[2] + p.position[2]], [0, 0, 0]);
    const c = new THREE.Vector3(sum[0] / real.length, sum[1] / real.length, sum[2] / real.length);
    // Extent = max distance from center in XZ, used to set camera distance
    const maxDist = real.reduce((m, p) => {
      const dx = p.position[0] - c.x, dz = p.position[2] - c.z;
      return Math.max(m, Math.sqrt(dx * dx + dz * dz));
    }, 0);
    return { center: c, extent: Math.max(maxDist, 100) };
  }, [circuit]);

  const showRaw = !!filteredPoints;
  const displayPoints = filteredPoints ?? circuit?.points ?? [];

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
      {/* Overlay controls */}
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', gap: 0.5 }}>
        <Tooltip title={topDown ? 'Perspective view' : 'Top-down view'}>
          <IconButton size="small" onClick={() => setTopDown(v => !v)} color={topDown ? 'primary' : 'default'}>
            {topDown ? <ViewInArIcon fontSize="small" /> : <GridOnIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        {selectedIds.size > 0 && (
          <Tooltip title={`Delete ${selectedIds.size} selected point(s)`}>
            <IconButton size="small" color="error" onClick={onDeleteSelected}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {circuit ? (
        <Canvas
          style={{ width: '100%', height: '100%' }}
          camera={{ fov: 60, near: 1, far: 10_000_000 }}
          onCreated={({ scene }) => { scene.background = new THREE.Color('#0a0a0a'); }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[center.x, center.y + extent * 2, center.z]} intensity={0.8} />

          <OrbitControls
            ref={controlsRef}
            enablePan
            enableZoom
            enableRotate={!topDown}
            makeDefault
          />

          <CameraSetup center={center} extent={extent} controlsRef={controlsRef} fitKey={fitKey.current} />
          <TopDownController topDown={topDown} center={center} extent={extent} controlsRef={controlsRef} />

          {/* Raw trace (dimmed) when filter preview is active */}
          {showRaw && circuit.points && (
            <TraceLines points={circuit.points} color="#555" opacity={0.35} />
          )}

          {/* Main / filtered trace */}
          <TraceLines points={displayPoints} color="#e5e5e5" opacity={1} />

          {/* Checkpoints */}
          {circuit.checkpoints.map(cp => (
            <CheckpointMesh
              key={cp.id}
              checkpoint={cp}
              extent={extent}
              onMove={onCheckpointMove}
              isSelected={cp.id === selectedCheckpointId}
              onClick={onCheckpointClick}
            />
          ))}

          {/* Selected point highlights */}
          {[...selectedIds].map(id => {
            const pt = circuit.points.find(p => p.id === id);
            if (!pt || pt.gap) return null;
            return (
              <Html key={id} position={pt.position} center style={{ pointerEvents: 'none' }}>
                <div style={{
                  width: 10, height: 10,
                  background: '#facc15',
                  borderRadius: '50%',
                  opacity: 0.9,
                }} />
              </Html>
            );
          })}

          {/* Hover + click catcher — double-click adds a checkpoint */}
          <HoverIndicator
            points={circuit.points}
            center={center}
            extent={extent}
            onHover={() => {}}
            onClick={onPointClick}
            onDoubleClick={onAddCheckpoint}
          />
        </Canvas>
      ) : (
        <Box sx={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: 'text.disabled', fontSize: 14,
        }}>
          Open a circuit file or load the last recording to start editing.
        </Box>
      )}
    </Box>
  );
}
