/**
 * Rigid-body transforms used by the editor for stereochemistry and conformation:
 * mirroring (enantiomer), rotation of one side of a bond (torsion / E-Z flip) and inversion
 * of a tetrahedral centre by swapping two substituent branches.
 * All functions are pure and never change the graph, only coordinates.
 */
import { bondInRing } from "./perception";
import { getAtom, getBond, neighborsOf } from "./molecule";
import type { AtomId, BondId, Molecule, Vec3 } from "./types";
import { v3 } from "./vec3";

/** Reflect every atom through the yz plane: the mirror image (enantiomer) of the structure. */
export function mirrorMolecule(mol: Molecule): Molecule {
  return { ...mol, atoms: mol.atoms.map((a) => ({ ...a, position: { ...a.position, x: -a.position.x + 0 } })) };
}

/** Atoms reachable from `start` without passing through `blocked` (the branch "behind" start). */
export function branchFrom(mol: Molecule, start: AtomId, blocked: AtomId): Set<AtomId> {
  const seen = new Set<AtomId>([start]);
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    for (const n of neighborsOf(mol, id)) {
      if (n === blocked || seen.has(n)) continue;
      seen.add(n);
      stack.push(n);
    }
  }
  return seen;
}

function rotateAtoms(mol: Molecule, ids: Set<AtomId>, origin: Vec3, axis: Vec3, angle: number): Molecule {
  return {
    ...mol,
    atoms: mol.atoms.map((a) => {
      if (!ids.has(a.id)) return a;
      const rel = v3.sub(a.position, origin);
      const rot = v3.rotate(rel, axis, angle);
      const p = v3.add(origin, rot);
      return { ...a, position: { x: round(p.x), y: round(p.y), z: round(p.z) } };
    }),
  };
}

/**
 * Rotate everything on the `atomB` side of an acyclic bond around the bond axis by `angle`
 * radians (positive = right-hand rule from A to B). Throws for ring bonds, where one side is not
 * a separate branch.
 */
export function rotateAroundBond(mol: Molecule, bondId: BondId, angle: number, movingSide: "A" | "B" = "B"): Molecule {
  const bond = getBond(mol, bondId);
  if (!bond) throw new Error(`Unknown bond: ${bondId}`);
  if (bondInRing(mol, bondId)) throw new Error("Cannot rotate around a ring bond.");
  const fixedId = movingSide === "B" ? bond.atomA : bond.atomB;
  const movingId = movingSide === "B" ? bond.atomB : bond.atomA;
  const a = getAtom(mol, fixedId)!;
  const b = getAtom(mol, movingId)!;
  const branch = branchFrom(mol, movingId, fixedId);
  branch.delete(movingId); // the moving end atom lies on the axis
  if (branch.size === 0) return mol;
  return rotateAtoms(mol, branch, b.position, v3.sub(b.position, a.position), angle);
}

/** Dihedral angle (radians) for atoms a-b-c-d. */
export function dihedralAngle(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  const b1 = v3.sub(b, a);
  const b2 = v3.sub(c, b);
  const b3 = v3.sub(d, c);
  const n1 = v3.cross(b1, b2);
  const n2 = v3.cross(b2, b3);
  const m1 = v3.cross(n1, v3.normalize(b2));
  return Math.atan2(v3.dot(m1, n2), v3.dot(n1, n2));
}

/**
 * Invert a tetrahedral centre by swapping two of its substituent branches. Prefers the two
 * smallest acyclic branches (often hydrogens). Returns null when no two independent branches
 * exist (e.g. the centre sits in a ring with only ring neighbours), so the caller can fall back to
 * mirroring the whole structure.
 */
export function invertCentre(mol: Molecule, atomId: AtomId): Molecule | null {
  const centre = getAtom(mol, atomId);
  if (!centre) throw new Error(`Unknown atom: ${atomId}`);
  const nbs = neighborsOf(mol, atomId);
  if (nbs.length < 3) return null;
  const branches = nbs
    .map((n) => ({ n, atoms: branchFrom(mol, n, atomId) }))
    .filter((b) => !b.atoms.has(atomId));
  // Branches must be independent (not connected to each other around a ring).
  const independent = branches.filter((b) => branches.every((o) => o === b || ![...b.atoms].some((x) => o.atoms.has(x))));
  if (independent.length < 2) return null;
  independent.sort((p, q) => p.atoms.size - q.atoms.size || p.n.localeCompare(q.n));
  const [p, q] = independent as [(typeof independent)[0], (typeof independent)[0]];
  const pPos = getAtom(mol, p.n)!.position;
  const qPos = getAtom(mol, q.n)!.position;
  const dp = v3.sub(qPos, pPos);
  const dq = v3.sub(pPos, qPos);
  return {
    ...mol,
    atoms: mol.atoms.map((a) => {
      if (p.atoms.has(a.id)) return { ...a, position: v3.add(a.position, dp) };
      if (q.atoms.has(a.id)) return { ...a, position: v3.add(a.position, dq) };
      return a;
    }),
  };
}

function round(v: number): number {
  return Math.round(v * 10000) / 10000 + 0;
}
