/**
 * Heuristic 3D placement for interactively added atoms.
 *
 * This is deliberately simple and deterministic: ideal bond length from covalent radii and an
 * idealised VSEPR-like direction (tetrahedral / trigonal / linear) chosen from the anchor's
 * existing bonds. It produces sensible sketches, not optimised geometry; geometry optimisation
 * is the chemistry engine's job (RDKit MMFF/UFF) and is a separate, explicit user action.
 */
import { covalentRadius } from "./elements";
import { bondsOfAtom, getAtom } from "./molecule";
import type { AtomId, BondOrder, Molecule, Vec3 } from "./types";
import { v3 } from "./vec3";

export type LocalGeometry = "linear" | "trigonal" | "tetrahedral";

const TETRAHEDRAL = (109.47 * Math.PI) / 180;
const TRIGONAL = (120 * Math.PI) / 180;
/** Half of the tetrahedral angle: tilt of the third substituent out of the plane of the first two. */
const TETRA_TILT = Math.acos(-1 / 3) / 2;

/** Ideal length of a bond between two elements (Å), from single-bond covalent radii. */
export function idealBondLength(elementA: string, elementB: string, order: BondOrder = "single"): number {
  const base = covalentRadius(elementA) + covalentRadius(elementB);
  // Rough shortening for multiple bonds (Pauling-style factors), enough for a sketch.
  switch (order) {
    case "double":
      return base * 0.87;
    case "triple":
      return base * 0.78;
    case "aromatic":
      return base * 0.91;
    default:
      return base;
  }
}

/** Guess the local geometry of an atom from the orders of its bonds plus the bond about to be added. */
export function guessGeometry(mol: Molecule, atomId: AtomId, newOrder: BondOrder = "single"): LocalGeometry {
  const orders = [...bondsOfAtom(mol, atomId).map((b) => b.order), newOrder];
  if (orders.includes("triple") || orders.filter((o) => o === "double").length >= 2) return "linear";
  if (orders.includes("double") || orders.includes("aromatic")) return "trigonal";
  return "tetrahedral";
}

/**
 * Direction (unit vector) for a new substituent on `atomId`, given its current neighbours.
 * Returns a deterministic direction even for isolated atoms.
 */
export function freeDirection(mol: Molecule, atomId: AtomId, geometry: LocalGeometry): Vec3 {
  const atom = getAtom(mol, atomId);
  if (!atom) throw new Error(`Unknown atom: ${atomId}`);
  const units = bondsOfAtom(mol, atomId)
    .map((b) => (b.atomA === atomId ? b.atomB : b.atomA))
    .map((n) => getAtom(mol, n))
    .filter((n): n is NonNullable<typeof n> => n !== undefined)
    .map((n) => v3.normalize(v3.sub(n.position, atom.position)))
    .filter((u) => v3.length(u) > 0);

  if (units.length === 0) return { x: 1, y: 0, z: 0 };

  if (units.length === 1) {
    const u = units[0]!;
    const angle = geometry === "linear" ? Math.PI : geometry === "trigonal" ? TRIGONAL : TETRAHEDRAL;
    // Rotate the (negated) neighbour direction so the new bond forms the ideal angle with it.
    return v3.normalize(v3.rotate(v3.scale(u, -1), v3.perpendicular(u), Math.PI - angle));
  }

  const sum = units.reduce((acc, u) => v3.add(acc, u), { x: 0, y: 0, z: 0 });
  const bisector = v3.scale(sum, -1);

  if (units.length === 2 && geometry === "tetrahedral") {
    const normal = v3.cross(units[0]!, units[1]!);
    if (v3.length(bisector) < 1e-6 || v3.length(normal) < 1e-6) {
      return v3.perpendicular(units[0]!);
    }
    // Tilt out of the plane of the two existing bonds so a 4th substituent can go the other way.
    const b = v3.normalize(bisector);
    const n = v3.normalize(normal);
    return v3.normalize(v3.add(v3.scale(b, Math.cos(TETRA_TILT)), v3.scale(n, Math.sin(TETRA_TILT))));
  }

  if (v3.length(bisector) < 1e-6) {
    // Symmetric arrangement (e.g. linear pair): any perpendicular direction is free.
    return v3.perpendicular(units[0]!);
  }
  return v3.normalize(bisector);
}

/** Position for a new atom of `element` bonded to `anchorId`. */
export function placeBondedAtom(mol: Molecule, anchorId: AtomId, element: string, order: BondOrder = "single"): Vec3 {
  const anchor = getAtom(mol, anchorId);
  if (!anchor) throw new Error(`Unknown atom: ${anchorId}`);
  const dir = freeDirection(mol, anchorId, guessGeometry(mol, anchorId, order));
  return v3.add(anchor.position, v3.scale(dir, idealBondLength(anchor.element, element, order)));
}
