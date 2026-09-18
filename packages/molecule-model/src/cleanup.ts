/**
 * Sketch geometry clean-up: a small, deterministic force field that pulls an interactively
 * built structure towards idealised geometry (bond lengths from covalent radii, VSEPR-style
 * angles from hybridisation, planar sp2 centres, staggered/planar torsions, soft non-bonded
 * repulsion) and minimises it with damped steepest descent.
 *
 * This is a *drawing aid*, not a validated force field: energies are in arbitrary units and must
 * never be presented as physical quantities. Real optimisation (MMFF94/UFF, ETKDG) lives in the
 * chemistry engine. Chirality is preserved in practice because atoms move continuously, but a
 * badly tangled sketch can still invert a centre; the validator/engine will report the result.
 */
import { allowedValences, covalentRadius } from "./elements";
import { implicitHydrogenCount } from "./formula";
import { bondsOfAtom } from "./molecule";
import { idealBondLength } from "./placement";
import type { AtomId, BondOrder, Molecule } from "./types";

export interface CleanupOptions {
  maxIterations?: number;
  /** Stop when the largest gradient component (arbitrary units) drops below this. */
  tolerance?: number;
  /** Atoms that must not move (e.g. the one being dragged). */
  fixedAtomIds?: Iterable<AtomId>;
  /**
   * Deterministic pseudo-random displacement (Å) applied to movable atoms first. A tiny amount
   * (default 0.02) is always needed: perfectly planar or symmetric input sits on a saddle point
   * where steepest descent would stall. Use ~0.5 to lift genuinely 2D input into 3D.
   */
  jitter?: number;
}

export interface CleanupResult {
  molecule: Molecule;
  iterations: number;
  converged: boolean;
  /** Final sketch energy, arbitrary units (not kcal/mol). */
  energy: number;
  maxForce: number;
}

const K_BOND = 300;
const K_ANGLE = 60;
const K_OOP = 40;
const K_TORSION_DOUBLE = 15;
const K_TORSION_SP3 = 1.0;
const K_REPULSION = 30;
const REPULSION_SCALE = 1.7;
const DEFAULT_JITTER = 0.02;
const DEG = Math.PI / 180;

type Hybrid = "sp" | "sp2" | "sp3" | "other";

interface Topology {
  n: number;
  bonds: Array<[number, number, number]>; // i, j, r0
  angles: Array<[number, number, number, number]>; // i, centre, j, theta0 (rad)
  impropers: Array<[number, number, number, number]>; // centre, i, j, k
  torsions: Array<[number, number, number, number, 2 | 3]>; // a, b, c, d, periodicity
  repulsions: Array<[number, number, number]>; // i, j, rMin
}

function hybridisation(mol: Molecule, atomId: AtomId): Hybrid {
  const bonds = bondsOfAtom(mol, atomId);
  const orders = bonds.map((b) => b.order);
  if (orders.includes("triple") || orders.filter((o) => o === "double").length >= 2) return "sp";
  if (orders.includes("double") || orders.includes("aromatic")) return "sp2";
  const atom = mol.atoms.find((a) => a.id === atomId)!;
  if (!allowedValences(atom.element, atom.formalCharge)) return "other";
  return "sp3";
}

function idealAngle(h: Hybrid, sigmaCount: number): number {
  if (h === "sp") return 180 * DEG;
  if (h === "sp2") return 120 * DEG;
  if (h === "sp3") return sigmaCount >= 5 ? 90 * DEG : 109.47 * DEG;
  // metals / unchecked elements: purely by coordination number
  if (sigmaCount <= 2) return 180 * DEG;
  if (sigmaCount === 3) return 120 * DEG;
  if (sigmaCount === 4) return 109.47 * DEG;
  return 90 * DEG;
}

function buildTopology(mol: Molecule): Topology {
  const index = new Map<AtomId, number>();
  mol.atoms.forEach((a, i) => index.set(a.id, i));
  const n = mol.atoms.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  const bondOrder = new Map<string, BondOrder>();
  const bonds: Topology["bonds"] = [];
  for (const b of mol.bonds) {
    const i = index.get(b.atomA);
    const j = index.get(b.atomB);
    if (i === undefined || j === undefined || i === j) continue;
    adj[i]!.push(j);
    adj[j]!.push(i);
    bondOrder.set(`${Math.min(i, j)}:${Math.max(i, j)}`, b.order);
    bonds.push([i, j, idealBondLength(mol.atoms[i]!.element, mol.atoms[j]!.element, b.order)]);
  }

  const hybrids: Hybrid[] = mol.atoms.map((a) => hybridisation(mol, a.id));
  const sigma: number[] = mol.atoms.map((a, i) => adj[i]!.length + implicitHydrogenCount(mol, a.id));

  const angles: Topology["angles"] = [];
  const impropers: Topology["impropers"] = [];
  for (let c = 0; c < n; c++) {
    const nb = adj[c]!;
    const theta0 = idealAngle(hybrids[c]!, sigma[c]!);
    for (let x = 0; x < nb.length; x++) for (let y = x + 1; y < nb.length; y++) angles.push([nb[x]!, c, nb[y]!, theta0]);
    if (hybrids[c] === "sp2" && nb.length === 3) impropers.push([c, nb[0]!, nb[1]!, nb[2]!]);
  }

  const torsions: Topology["torsions"] = [];
  for (const [b, c] of bonds) {
    const order = bondOrder.get(`${Math.min(b, c)}:${Math.max(b, c)}`)!;
    let periodicity: 2 | 3 | 0 = 0;
    if (order === "double") periodicity = 2;
    else if (order === "single" && hybrids[b] === "sp3" && hybrids[c] === "sp3") periodicity = 3;
    if (periodicity === 0) continue;
    for (const a of adj[b]!) {
      if (a === c) continue;
      for (const d of adj[c]!) {
        if (d === b || d === a) continue;
        torsions.push([a, b, c, d, periodicity]);
      }
    }
  }

  // Graph distance up to 2 (bonded and 1-3 pairs are excluded from repulsion).
  const close = new Set<string>();
  for (let i = 0; i < n; i++) {
    for (const j of adj[i]!) {
      close.add(`${Math.min(i, j)}:${Math.max(i, j)}`);
      for (const k of adj[j]!) if (k !== i) close.add(`${Math.min(i, k)}:${Math.max(i, k)}`);
    }
  }
  const repulsions: Topology["repulsions"] = [];
  const radii = mol.atoms.map((a) => covalentRadius(a.element));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (close.has(`${i}:${j}`)) continue;
      repulsions.push([i, j, REPULSION_SCALE * (radii[i]! + radii[j]!)]);
    }
  }
  return { n, bonds, angles, impropers, torsions, repulsions };
}

// ---------------------------------------------------------------------------
// Energy terms on a flat coordinate array
// ---------------------------------------------------------------------------

const sub = (x: Float64Array, i: number, j: number): [number, number, number] => [x[3 * i]! - x[3 * j]!, x[3 * i + 1]! - x[3 * j + 1]!, x[3 * i + 2]! - x[3 * j + 2]!];
const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
const norm = (a: number[]) => Math.hypot(a[0]!, a[1]!, a[2]!);

function angleEnergy(x: Float64Array, t: [number, number, number, number]): number {
  const u = sub(x, t[0], t[1]);
  const v = sub(x, t[2], t[1]);
  const lu = norm(u);
  const lv = norm(v);
  if (lu < 1e-9 || lv < 1e-9) return 0;
  const c = Math.min(1, Math.max(-1, dot(u, v) / (lu * lv)));
  const d = Math.acos(c) - t[3];
  return K_ANGLE * d * d;
}

function improperEnergy(x: Float64Array, t: [number, number, number, number]): number {
  const [c, i, j, k] = t;
  const a = sub(x, j, i);
  const b = sub(x, k, i);
  const nrm = cross(a, b);
  const l = norm(nrm);
  if (l < 1e-9) return 0;
  const d = dot(sub(x, c, i), nrm) / l;
  return K_OOP * d * d;
}

function dihedral(x: Float64Array, a: number, b: number, c: number, d: number): number {
  const b1 = sub(x, b, a);
  const b2 = sub(x, c, b);
  const b3 = sub(x, d, c);
  const n1 = cross(b1, b2);
  const n2 = cross(b2, b3);
  const l2 = norm(b2);
  if (l2 < 1e-9 || norm(n1) < 1e-9 || norm(n2) < 1e-9) return 0;
  const m1 = cross(n1, [b2[0]! / l2, b2[1]! / l2, b2[2]! / l2]);
  return Math.atan2(dot(m1, n2), dot(n1, n2));
}

function torsionEnergy(x: Float64Array, t: [number, number, number, number, 2 | 3]): number {
  const phi = dihedral(x, t[0], t[1], t[2], t[3]);
  return t[4] === 2 ? (K_TORSION_DOUBLE * (1 - Math.cos(2 * phi))) / 2 : (K_TORSION_SP3 * (1 + Math.cos(3 * phi))) / 2;
}

function totalEnergy(x: Float64Array, topo: Topology): number {
  let e = 0;
  for (const [i, j, r0] of topo.bonds) {
    const d = norm(sub(x, i, j)) - r0;
    e += K_BOND * d * d;
  }
  for (const t of topo.angles) e += angleEnergy(x, t);
  for (const t of topo.impropers) e += improperEnergy(x, t);
  for (const t of topo.torsions) e += torsionEnergy(x, t);
  for (const [i, j, rMin] of topo.repulsions) {
    const r = norm(sub(x, i, j));
    if (r < rMin) e += K_REPULSION * (rMin - r) * (rMin - r);
  }
  return e;
}

/** Gradient: analytic for pair terms, central differences for the few-atom angular terms. */
function gradient(x: Float64Array, topo: Topology, g: Float64Array): void {
  g.fill(0);
  for (const [i, j, r0] of topo.bonds) {
    const v = sub(x, i, j);
    const r = norm(v);
    if (r < 1e-9) continue;
    const f = (2 * K_BOND * (r - r0)) / r;
    for (let k = 0; k < 3; k++) {
      g[3 * i + k]! += f * v[k]!;
      g[3 * j + k]! -= f * v[k]!;
    }
  }
  for (const [i, j, rMin] of topo.repulsions) {
    const v = sub(x, i, j);
    const r = norm(v);
    if (r >= rMin || r < 1e-9) continue;
    const f = (-2 * K_REPULSION * (rMin - r)) / r;
    for (let k = 0; k < 3; k++) {
      g[3 * i + k]! += f * v[k]!;
      g[3 * j + k]! -= f * v[k]!;
    }
  }
  const h = 1e-5;
  const numeric = (atoms: number[], fn: () => number) => {
    for (const a of atoms) {
      for (let k = 0; k < 3; k++) {
        const idx = 3 * a + k;
        const orig = x[idx]!;
        x[idx] = orig + h;
        const ep = fn();
        x[idx] = orig - h;
        const em = fn();
        x[idx] = orig;
        g[idx]! += (ep - em) / (2 * h);
      }
    }
  };
  for (const t of topo.angles) numeric([t[0], t[1], t[2]], () => angleEnergy(x, t));
  for (const t of topo.impropers) numeric([t[0], t[1], t[2], t[3]], () => improperEnergy(x, t));
  for (const t of topo.torsions) numeric([t[0], t[1], t[2], t[3]], () => torsionEnergy(x, t));
}

/** Deterministic pseudo-random in [-1, 1) from an integer seed. */
function noise(i: number): number {
  let h = (i + 1) * 2654435761;
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) % 10000) / 5000 - 1;
}

export function cleanupGeometry(mol: Molecule, opts: CleanupOptions = {}): CleanupResult {
  const maxIterations = opts.maxIterations ?? 300;
  const tolerance = opts.tolerance ?? 0.05;
  const n = mol.atoms.length;
  if (n === 0) return { molecule: mol, iterations: 0, converged: true, energy: 0, maxForce: 0 };

  const topo = buildTopology(mol);
  const x = new Float64Array(3 * n);
  mol.atoms.forEach((a, i) => {
    x[3 * i] = a.position.x;
    x[3 * i + 1] = a.position.y;
    x[3 * i + 2] = a.position.z;
  });
  const fixed = new Set<number>();
  const index = new Map(mol.atoms.map((a, i) => [a.id, i]));
  for (const id of opts.fixedAtomIds ?? []) {
    const i = index.get(id);
    if (i !== undefined) fixed.add(i);
  }
  const jitter = opts.jitter ?? DEFAULT_JITTER;
  if (jitter > 0 && n > 1) {
    for (let i = 0; i < n; i++) {
      if (fixed.has(i)) continue;
      x[3 * i]! += jitter * 0.3 * noise(3 * i);
      x[3 * i + 1]! += jitter * 0.3 * noise(3 * i + 1);
      x[3 * i + 2]! += jitter * noise(3 * i + 2);
    }
  }

  const g = new Float64Array(3 * n);
  const trial = new Float64Array(3 * n);
  let energy = totalEnergy(x, topo);
  let step = 0.05;
  let iterations = 0;
  let maxForce = 0;
  let converged = false;

  for (; iterations < maxIterations; iterations++) {
    gradient(x, topo, g);
    for (const i of fixed) g[3 * i] = g[3 * i + 1] = g[3 * i + 2] = 0;
    maxForce = 0;
    for (let k = 0; k < g.length; k++) maxForce = Math.max(maxForce, Math.abs(g[k]!));
    if (maxForce < tolerance) {
      converged = true;
      break;
    }
    // Move so that the largest displacement equals `step`; backtrack when energy rises.
    let accepted = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const scale = step / maxForce;
      for (let k = 0; k < x.length; k++) trial[k] = x[k]! - scale * g[k]!;
      const eNew = totalEnergy(trial, topo);
      if (eNew < energy) {
        x.set(trial);
        energy = eNew;
        step = Math.min(step * 1.2, 0.15);
        accepted = true;
        break;
      }
      step *= 0.5;
    }
    if (!accepted) break; // stuck: cannot lower the energy any further
  }

  const atoms = mol.atoms.map((a, i) => ({ ...a, position: { x: round(x[3 * i]!), y: round(x[3 * i + 1]!), z: round(x[3 * i + 2]!) } }));
  return { molecule: { ...mol, atoms }, iterations, converged, energy, maxForce };
}

function round(v: number): number {
  return Math.round(v * 10000) / 10000 + 0; // +0 normalises -0
}

/** Convenience for tests and tools: all bond angles at a centre (degrees). */
export function bondAnglesAt(mol: Molecule, centerId: AtomId): number[] {
  const c = mol.atoms.find((a) => a.id === centerId);
  if (!c) return [];
  const nbs = bondsOfAtom(mol, centerId)
    .map((b) => (b.atomA === centerId ? b.atomB : b.atomA))
    .map((id) => mol.atoms.find((a) => a.id === id)!);
  const out: number[] = [];
  for (let i = 0; i < nbs.length; i++) {
    for (let j = i + 1; j < nbs.length; j++) {
      const u = [nbs[i]!.position.x - c.position.x, nbs[i]!.position.y - c.position.y, nbs[i]!.position.z - c.position.z];
      const v = [nbs[j]!.position.x - c.position.x, nbs[j]!.position.y - c.position.y, nbs[j]!.position.z - c.position.z];
      out.push(Math.acos(Math.min(1, Math.max(-1, dot(u, v) / (norm(u) * norm(v))))) / DEG);
    }
  }
  return out;
}
