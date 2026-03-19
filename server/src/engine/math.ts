// math.ts — 3D geometry helpers (distance, segment projection) for checkpoint detection.
export type Vec3 = [number, number, number];

export function distance3D(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Shortest distance from point p to line segment a→b.
export function distanceToSegment3D(p: Vec3, a: Vec3, b: Vec3): number {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const apx = p[0] - a[0], apy = p[1] - a[1], apz = p[2] - a[2];
  const ab2 = abx * abx + aby * aby + abz * abz;

  if (ab2 === 0) return distance3D(p, a); // degenerate segment (a === b)

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / ab2));
  const cx = a[0] + t * abx;
  const cy = a[1] + t * aby;
  const cz = a[2] + t * abz;

  return distance3D(p, [cx, cy, cz]);
}
