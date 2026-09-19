import type { Vec3 } from "./types";

/** Minimal immutable vector helpers (no rendering dependency). */
export const v3 = {
  of(x: number, y: number, z: number): Vec3 {
    return { x, y, z };
  },
  add(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  },
  sub(a: Vec3, b: Vec3): Vec3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  },
  scale(a: Vec3, s: number): Vec3 {
    return { x: a.x * s, y: a.y * s, z: a.z * s };
  },
  dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  },
  cross(a: Vec3, b: Vec3): Vec3 {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
  },
  length(a: Vec3): number {
    return Math.hypot(a.x, a.y, a.z);
  },
  normalize(a: Vec3): Vec3 {
    const l = Math.hypot(a.x, a.y, a.z);
    return l === 0 ? { x: 0, y: 0, z: 0 } : { x: a.x / l, y: a.y / l, z: a.z / l };
  },
  /** Any unit vector perpendicular to `a` (deterministic). */
  perpendicular(a: Vec3): Vec3 {
    const n = v3.normalize(a);
    const helper = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    return v3.normalize(v3.cross(n, helper));
  },
  /** Rodrigues rotation of `v` around unit `axis` by `angle` radians. */
  rotate(v: Vec3, axis: Vec3, angle: number): Vec3 {
    const k = v3.normalize(axis);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const term1 = v3.scale(v, c);
    const term2 = v3.scale(v3.cross(k, v), s);
    const term3 = v3.scale(k, v3.dot(k, v) * (1 - c));
    return v3.add(v3.add(term1, term2), term3);
  },
  angle(a: Vec3, b: Vec3): number {
    const d = v3.dot(a, b) / (v3.length(a) * v3.length(b));
    return Math.acos(Math.min(1, Math.max(-1, d)));
  },
};
