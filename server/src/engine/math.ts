// math.ts — 3D geometry helpers for checkpoint detection.
export type Vec3 = [number, number, number];

export function distance3D(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * Returns true if the segment [p1, p2] crosses the circular gate defined by
 * a center point, a normal (direction), and a radius.
 * The gate is a finite disk — the intersection point must be within radius of center.
 */
export function segmentCrossesGate(
  p1: Vec3,
  p2: Vec3,
  center: Vec3,
  normal: Vec3,
  radius: number
): boolean {
  const d1 = dot(sub(p1, center), normal);
  const d2 = dot(sub(p2, center), normal);

  // Both points on the same side — no crossing
  if (d1 * d2 > 0) return false;
  // Segment is parallel to the plane (both on plane counts as crossing)
  if (d1 === d2) return d1 === 0;

  // Interpolate intersection point on the plane
  const t = d1 / (d1 - d2);
  const ix = p1[0] + t * (p2[0] - p1[0]);
  const iy = p1[1] + t * (p2[1] - p1[1]);
  const iz = p1[2] + t * (p2[2] - p1[2]);

  // Check distance from center to intersection point
  const dx = ix - center[0];
  const dy = iy - center[1];
  const dz = iz - center[2];
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}
