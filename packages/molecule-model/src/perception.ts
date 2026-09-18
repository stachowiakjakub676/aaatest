/**
 * Lightweight structural perception on the molecular graph: ring membership, simple cycles and
 * a small catalogue of functional groups. Deterministic, dependency-free, and deliberately
 * limited; RDKit remains the authority for full chemical perception.
 */
import { bondOrderValue, bondsOfAtom, getAtom, neighborsOf } from "./molecule";
import type { AtomId, BondId, Molecule } from "./types";

/** Number of independent rings (cyclomatic number). */
export function ringCount(mol: Molecule): number {
  const components = connectedComponents(mol).length;
  return Math.max(0, mol.bonds.length - mol.atoms.length + components);
}

/** Connected components as lists of atom ids (deterministic order). */
export function connectedComponents(mol: Molecule): AtomId[][] {
  const seen = new Set<AtomId>();
  const out: AtomId[][] = [];
  for (const a of mol.atoms) {
    if (seen.has(a.id)) continue;
    const comp: AtomId[] = [];
    const stack = [a.id];
    seen.add(a.id);
    while (stack.length) {
      const id = stack.pop()!;
      comp.push(id);
      for (const n of neighborsOf(mol, id)) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    out.push(comp.sort());
  }
  return out;
}

/** True when removing the bond keeps its two atoms connected (i.e. the bond is in a ring). */
export function bondInRing(mol: Molecule, bondId: BondId): boolean {
  const bond = mol.bonds.find((b) => b.id === bondId);
  if (!bond) return false;
  const rest: Molecule = { ...mol, bonds: mol.bonds.filter((b) => b.id !== bondId) };
  const seen = new Set<AtomId>([bond.atomA]);
  const stack = [bond.atomA];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === bond.atomB) return true;
    for (const n of neighborsOf(rest, id)) {
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return false;
}

/** Simple cycles of exactly `size` atoms (each reported once, as an ordered atom list). */
export function findCycles(mol: Molecule, size: number): AtomId[][] {
  const found = new Map<string, AtomId[]>();
  const adj = new Map<AtomId, AtomId[]>(mol.atoms.map((a) => [a.id, neighborsOf(mol, a.id)]));
  const walk = (start: AtomId, path: AtomId[]) => {
    const last = path[path.length - 1]!;
    for (const n of adj.get(last) ?? []) {
      if (n === start && path.length === size) {
        const key = [...path].sort().join("|");
        if (!found.has(key)) found.set(key, [...path]);
      } else if (path.length < size && !path.includes(n) && n > start) {
        walk(start, [...path, n]);
      }
    }
  };
  for (const a of mol.atoms) walk(a.id, [a.id]);
  return [...found.values()];
}

export interface FunctionalGroup {
  /** Stable identifier, e.g. "ester", "carboxylic-acid". */
  id: string;
  name: string;
  atomIds: AtomId[];
  /** Bonds that a retrosynthetic disconnection of this group would break. */
  keyBondIds: BondId[];
}

function heavyNeighbors(mol: Molecule, id: AtomId): AtomId[] {
  return neighborsOf(mol, id).filter((n) => getAtom(mol, n)?.element !== "H");
}
function bondBetweenIds(mol: Molecule, a: AtomId, b: AtomId) {
  return mol.bonds.find((x) => (x.atomA === a && x.atomB === b) || (x.atomA === b && x.atomB === a));
}
function doubleBondedNeighbors(mol: Molecule, id: AtomId, element: string): AtomId[] {
  return bondsOfAtom(mol, id)
    .filter((b) => b.order === "double")
    .map((b) => (b.atomA === id ? b.atomB : b.atomA))
    .filter((n) => getAtom(mol, n)?.element === element);
}
function singleBondedNeighbors(mol: Molecule, id: AtomId, element: string): AtomId[] {
  return bondsOfAtom(mol, id)
    .filter((b) => b.order === "single")
    .map((b) => (b.atomA === id ? b.atomB : b.atomA))
    .filter((n) => getAtom(mol, n)?.element === element);
}

/**
 * Detect common functional groups by local patterns. Coverage: carboxylic acid, ester, amide,
 * ketone, aldehyde, alcohol, ether, amine, nitrile, halide, aromatic six-membered ring
 * (explicit aromatic bonds or an alternating Kekulé ring).
 */
export function detectFunctionalGroups(mol: Molecule): FunctionalGroup[] {
  const groups: FunctionalGroup[] = [];
  const isH = (id: AtomId) => getAtom(mol, id)?.element === "H";
  const used = new Set<AtomId>();

  for (const atom of mol.atoms) {
    if (atom.element === "C") {
      const carbonylO = doubleBondedNeighbors(mol, atom.id, "O");
      if (carbonylO.length === 1) {
        const o = carbonylO[0]!;
        const singleO = singleBondedNeighbors(mol, atom.id, "O");
        const singleN = singleBondedNeighbors(mol, atom.id, "N");
        const cBond = (other: AtomId) => bondBetweenIds(mol, atom.id, other)!.id;
        if (singleO.length >= 1) {
          const ox = singleO[0]!;
          const oxHeavy = heavyNeighbors(mol, ox).filter((n) => n !== atom.id);
          if (oxHeavy.length === 0) {
            groups.push({ id: "carboxylic-acid", name: "Carboxylic acid", atomIds: [atom.id, o, ox], keyBondIds: [] });
          } else {
            groups.push({ id: "ester", name: "Ester", atomIds: [atom.id, o, ox, oxHeavy[0]!], keyBondIds: [cBond(ox)] });
          }
          used.add(ox);
        } else if (singleN.length >= 1) {
          const n = singleN[0]!;
          groups.push({ id: "amide", name: "Amide", atomIds: [atom.id, o, n], keyBondIds: [cBond(n)] });
          used.add(n);
        } else {
          const cNeighbors = heavyNeighbors(mol, atom.id).filter((x) => x !== o);
          if (cNeighbors.length === 2) groups.push({ id: "ketone", name: "Ketone", atomIds: [atom.id, o, ...cNeighbors], keyBondIds: cNeighbors.map(cBond) });
          else if (cNeighbors.length <= 1) groups.push({ id: "aldehyde", name: "Aldehyde", atomIds: [atom.id, o, ...cNeighbors], keyBondIds: [] });
        }
        used.add(atom.id);
        used.add(o);
        continue;
      }
      const nitrileN = bondsOfAtom(mol, atom.id)
        .filter((b) => b.order === "triple")
        .map((b) => (b.atomA === atom.id ? b.atomB : b.atomA))
        .filter((n) => getAtom(mol, n)?.element === "N");
      if (nitrileN.length === 1) {
        groups.push({ id: "nitrile", name: "Nitrile", atomIds: [atom.id, nitrileN[0]!], keyBondIds: [] });
        used.add(atom.id);
        used.add(nitrileN[0]!);
      }
    }
  }

  for (const atom of mol.atoms) {
    if (used.has(atom.id)) continue;
    if (atom.element === "O") {
      const heavy = heavyNeighbors(mol, atom.id);
      const hasDouble = bondsOfAtom(mol, atom.id).some((b) => bondOrderValue(b.order) > 1);
      if (hasDouble) continue;
      if (heavy.length === 1 && getAtom(mol, heavy[0]!)?.element === "C") {
        groups.push({ id: "alcohol", name: "Alcohol / hydroxyl", atomIds: [atom.id, heavy[0]!], keyBondIds: [] });
      } else if (heavy.length === 2 && heavy.every((n) => getAtom(mol, n)?.element === "C")) {
        groups.push({ id: "ether", name: "Ether", atomIds: [atom.id, ...heavy], keyBondIds: heavy.map((n) => bondBetweenIds(mol, atom.id, n)!.id) });
      }
    } else if (atom.element === "N") {
      const heavy = heavyNeighbors(mol, atom.id);
      const allSingle = bondsOfAtom(mol, atom.id).every((b) => b.order === "single");
      if (allSingle && heavy.length >= 1 && heavy.every((n) => getAtom(mol, n)?.element === "C")) {
        const hCount = neighborsOf(mol, atom.id).filter(isH).length;
        const degree = heavy.length;
        const kind = degree === 1 ? "Primary amine" : degree === 2 ? "Secondary amine" : "Tertiary amine";
        void hCount;
        groups.push({ id: "amine", name: kind, atomIds: [atom.id, ...heavy], keyBondIds: heavy.map((n) => bondBetweenIds(mol, atom.id, n)!.id) });
      }
    } else if (["F", "Cl", "Br", "I"].includes(atom.element)) {
      const heavy = heavyNeighbors(mol, atom.id);
      if (heavy.length === 1) groups.push({ id: "halide", name: `${atom.element === "F" ? "Fluoride" : atom.element === "Cl" ? "Chloride" : atom.element === "Br" ? "Bromide" : "Iodide"}`, atomIds: [atom.id, heavy[0]!], keyBondIds: [] });
    }
  }

  // Aromatic six-membered rings: all-aromatic bonds, or an alternating Kekulé pattern.
  for (const cycle of findCycles(mol, 6)) {
    const ringBonds = cycle.map((id, i) => bondBetweenIds(mol, id, cycle[(i + 1) % 6]!)!);
    const aromatic = ringBonds.every((b) => b.order === "aromatic");
    const kekule = ringBonds.filter((b) => b.order === "double").length === 3 && ringBonds.every((b, i) => b.order !== "double" || ringBonds[(i + 1) % 6]!.order !== "double");
    if (aromatic || kekule) groups.push({ id: "aromatic-ring", name: "Aromatic six-membered ring", atomIds: [...cycle], keyBondIds: [] });
  }
  return groups;
}
