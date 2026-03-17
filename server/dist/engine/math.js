"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distance3D = distance3D;
exports.distanceToSegment3D = distanceToSegment3D;
function distance3D(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
// Shortest distance from point p to line segment a→b.
function distanceToSegment3D(p, a, b) {
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
    const apx = p[0] - a[0], apy = p[1] - a[1], apz = p[2] - a[2];
    const ab2 = abx * abx + aby * aby + abz * abz;
    if (ab2 === 0)
        return distance3D(p, a); // degenerate segment (a === b)
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / ab2));
    const cx = a[0] + t * abx;
    const cy = a[1] + t * aby;
    const cz = a[2] + t * abz;
    return distance3D(p, [cx, cy, cz]);
}
//# sourceMappingURL=math.js.map