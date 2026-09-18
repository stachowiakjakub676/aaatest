import type { Atom, AtomId, Bond, BondId, BondOrder, Conformer, Molecule, Vec3 } from "./types";

/** Numeric contribution of a bond to an atom's explicit valence. */
export function bondOrderValue(order: BondOrder): number {
  switch (order) {
    case "single":
      return 1;
    case "double":
      return 2;
    case "triple":
      return 3;
    case "aromatic":
      return 1.5;
  }
}

export const BOND_ORDERS: readonly BondOrder[] = ["single", "double", "triple", "aromatic"];

let counter = 0;
/** Unique ids for interactive use; importers should provide their own stable ids. */
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}`;
}
/** Test hook: reset the id counter. */
export function resetIdCounter(): void {
  counter = 0;
}

/** Next generated id that is not already used by an atom or bond of `mol`. */
export function uniqueId(mol: Molecule, prefix: string): string {
  const used = new Set<string>([...mol.atoms.map((a) => a.id), ...mol.bonds.map((b) => b.id)]);
  let id = nextId(prefix);
  while (used.has(id)) id = nextId(prefix);
  return id;
}

export function createMolecule(init: Partial<Omit<Molecule, "schemaVersion">> = {}): Molecule {
  const mol: Molecule = {
    schemaVersion: 1,
    id: init.id ?? nextId("mol"),
    atoms: init.atoms ?? [],
    bonds: init.bonds ?? [],
    metadata: init.metadata ?? {},
  };
  if (init.name !== undefined) mol.name = init.name;
  if (init.conformers !== undefined) mol.conformers = init.conformers;
  return mol;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getAtom(mol: Molecule, id: AtomId): Atom | undefined {
  return mol.atoms.find((a) => a.id === id);
}

export function getBond(mol: Molecule, id: BondId): Bond | undefined {
  return mol.bonds.find((b) => b.id === id);
}

export function bondsOfAtom(mol: Molecule, atomId: AtomId): Bond[] {
  return mol.bonds.filter((b) => b.atomA === atomId || b.atomB === atomId);
}

export function neighborsOf(mol: Molecule, atomId: AtomId): AtomId[] {
  return bondsOfAtom(mol, atomId).map((b) => (b.atomA === atomId ? b.atomB : b.atomA));
}

export function bondBetween(mol: Molecule, a: AtomId, b: AtomId): Bond | undefined {
  return mol.bonds.find(
    (bond) => (bond.atomA === a && bond.atomB === b) || (bond.atomA === b && bond.atomB === a),
  );
}

/** Sum of bond orders around an atom (aromatic counts 1.5). Excludes implicit hydrogens. */
export function explicitValence(mol: Molecule, atomId: AtomId): number {
  return bondsOfAtom(mol, atomId).reduce((sum, b) => sum + bondOrderValue(b.order), 0);
}

export function totalFormalCharge(mol: Molecule): number {
  return mol.atoms.reduce((sum, a) => sum + a.formalCharge, 0);
}

// ---------------------------------------------------------------------------
// Pure edit operations (the editor layer wraps these with undo/redo)
// ---------------------------------------------------------------------------

export interface AtomInit {
  element: string;
  position: Vec3;
  id?: AtomId;
  formalCharge?: number;
  isotope?: number;
  chirality?: Atom["chirality"];
  implicitHydrogens?: number;
}

export function addAtom(mol: Molecule, init: AtomInit): { molecule: Molecule; atom: Atom } {
  const atom: Atom = {
    id: init.id ?? uniqueId(mol, "a"),
    element: init.element,
    formalCharge: init.formalCharge ?? 0,
    position: { ...init.position },
  };
  if (init.isotope !== undefined) atom.isotope = init.isotope;
  if (init.chirality !== undefined) atom.chirality = init.chirality;
  if (init.implicitHydrogens !== undefined) atom.implicitHydrogens = init.implicitHydrogens;
  if (getAtom(mol, atom.id)) throw new Error(`Atom id already exists: ${atom.id}`);
  return { molecule: { ...mol, atoms: [...mol.atoms, atom] }, atom };
}

/** Removes an atom and every bond incident to it. */
export function removeAtom(mol: Molecule, atomId: AtomId): Molecule {
  if (!getAtom(mol, atomId)) throw new Error(`Unknown atom: ${atomId}`);
  return {
    ...mol,
    atoms: mol.atoms.filter((a) => a.id !== atomId),
    bonds: mol.bonds.filter((b) => b.atomA !== atomId && b.atomB !== atomId),
  };
}

export function updateAtom(mol: Molecule, atomId: AtomId, patch: Partial<Omit<Atom, "id">>): Molecule {
  if (!getAtom(mol, atomId)) throw new Error(`Unknown atom: ${atomId}`);
  return {
    ...mol,
    atoms: mol.atoms.map((a) => (a.id === atomId ? { ...a, ...patch } : a)),
  };
}

export function moveAtom(mol: Molecule, atomId: AtomId, position: Vec3): Molecule {
  return updateAtom(mol, atomId, { position: { ...position } });
}

export interface BondInit {
  atomA: AtomId;
  atomB: AtomId;
  order?: BondOrder;
  id?: BondId;
  stereo?: Bond["stereo"];
}

export function addBond(mol: Molecule, init: BondInit): { molecule: Molecule; bond: Bond } {
  if (init.atomA === init.atomB) throw new Error("Cannot bond an atom to itself");
  if (!getAtom(mol, init.atomA)) throw new Error(`Unknown atom: ${init.atomA}`);
  if (!getAtom(mol, init.atomB)) throw new Error(`Unknown atom: ${init.atomB}`);
  if (bondBetween(mol, init.atomA, init.atomB)) {
    throw new Error(`Bond already exists between ${init.atomA} and ${init.atomB}`);
  }
  const bond: Bond = {
    id: init.id ?? uniqueId(mol, "b"),
    atomA: init.atomA,
    atomB: init.atomB,
    order: init.order ?? "single",
  };
  if (init.stereo !== undefined) bond.stereo = init.stereo;
  if (getBond(mol, bond.id)) throw new Error(`Bond id already exists: ${bond.id}`);
  return { molecule: { ...mol, bonds: [...mol.bonds, bond] }, bond };
}

export function removeBond(mol: Molecule, bondId: BondId): Molecule {
  if (!getBond(mol, bondId)) throw new Error(`Unknown bond: ${bondId}`);
  return { ...mol, bonds: mol.bonds.filter((b) => b.id !== bondId) };
}

export function setBondOrder(mol: Molecule, bondId: BondId, order: BondOrder): Molecule {
  if (!getBond(mol, bondId)) throw new Error(`Unknown bond: ${bondId}`);
  return { ...mol, bonds: mol.bonds.map((b) => (b.id === bondId ? { ...b, order } : b)) };
}

// ---------------------------------------------------------------------------
// Conformers
// ---------------------------------------------------------------------------

/** Snapshot of the active coordinates as a Conformer. */
export function extractConformer(mol: Molecule, id: string, name?: string): Conformer {
  const positions: Record<AtomId, Vec3> = {};
  for (const a of mol.atoms) positions[a.id] = { ...a.position };
  const c: Conformer = { id, positions };
  if (name !== undefined) c.name = name;
  return c;
}

/** Returns a molecule whose atoms carry the conformer's coordinates. Every atom must be covered. */
export function applyConformer(mol: Molecule, conformer: Conformer): Molecule {
  const missing = mol.atoms.filter((a) => !(a.id in conformer.positions)).map((a) => a.id);
  if (missing.length > 0) {
    throw new Error(`Conformer ${conformer.id} lacks coordinates for atoms: ${missing.join(", ")}`);
  }
  return {
    ...mol,
    atoms: mol.atoms.map((a) => ({ ...a, position: { ...conformer.positions[a.id]! } })),
  };
}

// ---------------------------------------------------------------------------
// Geometry helpers (pure, no rendering)
// ---------------------------------------------------------------------------

export function centroid(mol: Molecule): Vec3 {
  if (mol.atoms.length === 0) return { x: 0, y: 0, z: 0 };
  const s = mol.atoms.reduce(
    (acc, a) => ({ x: acc.x + a.position.x, y: acc.y + a.position.y, z: acc.z + a.position.z }),
    { x: 0, y: 0, z: 0 },
  );
  const n = mol.atoms.length;
  return { x: s.x / n, y: s.y / n, z: s.z / n };
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
