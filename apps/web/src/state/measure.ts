import { distance, getAtom } from "@molecular-cad/molecule-model";
import type { Molecule, Vec3 } from "@molecular-cad/molecule-model";

/** Angle A-B-C in degrees (B is the vertex). */
export function angleDeg(a: Vec3, b: Vec3, c: Vec3): number {
  const u = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = u.x * v.x + u.y * v.y + u.z * v.z;
  const lu = Math.hypot(u.x, u.y, u.z);
  const lv = Math.hypot(v.x, v.y, v.z);
  if (lu === 0 || lv === 0) return NaN;
  return (Math.acos(Math.min(1, Math.max(-1, dot / (lu * lv)))) * 180) / Math.PI;
}

export interface Measurement {
  label: string;
  value: string;
}

/** COMPUTED geometric measurements from the ordered atom selection. */
export function measureSelection(mol: Molecule, atomIds: string[]): Measurement | undefined {
  const atoms = atomIds.map((id) => getAtom(mol, id)).filter((a): a is NonNullable<typeof a> => a !== undefined);
  if (atoms.length === 2) {
    const [a, b] = atoms as [NonNullable<(typeof atoms)[0]>, NonNullable<(typeof atoms)[0]>];
    return { label: `Distance ${a.element}${a.id} - ${b.element}${b.id}`, value: `${distance(a.position, b.position).toFixed(3)} Å` };
  }
  if (atoms.length === 3) {
    const [a, b, c] = atoms as [NonNullable<(typeof atoms)[0]>, NonNullable<(typeof atoms)[0]>, NonNullable<(typeof atoms)[0]>];
    return { label: `Angle ${a.id} - ${b.id} - ${c.id}`, value: `${angleDeg(a.position, b.position, c.position).toFixed(1)}°` };
  }
  return undefined;
}
