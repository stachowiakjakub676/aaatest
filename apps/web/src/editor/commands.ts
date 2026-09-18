/**
 * Editor commands: pure functions Molecule -> { molecule, label, selection? }.
 * They compose the domain operations and decide placement; they never touch the renderer.
 */
import {
  addAtom,
  addBond,
  bondBetween,
  bondInRing,
  getAtom,
  getBond,
  implicitHydrogenCount,
  invertCentre,
  isKnownElement,
  mirrorMolecule,
  moveAtom,
  neighborsOf,
  placeBondedAtom,
  removeAtom,
  removeBond,
  rotateAroundBond,
  setBondOrder,
  updateAtom,
  v3,
} from "@molecular-cad/molecule-model";
import type { AtomId, BondId, BondOrder, FragmentTemplate, Molecule, Vec3 } from "@molecular-cad/molecule-model";
import type { Selection } from "../state/selection";

export interface CommandResult {
  molecule: Molecule;
  label: string;
  /** Selection after the command (undefined = keep the current one). */
  selection?: Selection;
  /** True when the change affects bonding/valence so an automatic geometry tidy makes sense. */
  tidy?: boolean;
}

export class CommandError extends Error {}

function requireElement(element: string): void {
  if (!isKnownElement(element)) throw new CommandError(`"${element}" is not an element symbol.`);
}

/** Place a free atom at a world position (tap on empty space). */
export function addFreeAtom(mol: Molecule, element: string, position: Vec3): CommandResult {
  requireElement(element);
  const { molecule, atom } = addAtom(mol, { element, position });
  return { molecule, label: `Add ${element}`, selection: { atoms: [atom.id], bonds: [] } };
}

/** Add an atom bonded to `anchorId`, positioned by the placement heuristic. */
export function addBondedAtom(mol: Molecule, anchorId: AtomId, element: string, order: BondOrder = "single"): CommandResult {
  requireElement(element);
  if (!getAtom(mol, anchorId)) throw new CommandError("Anchor atom no longer exists.");
  const position = placeBondedAtom(mol, anchorId, element, order);
  const added = addAtom(mol, { element, position });
  const bonded = addBond(added.molecule, { atomA: anchorId, atomB: added.atom.id, order });
  return {
    molecule: bonded.molecule,
    label: `Add ${element} to ${getAtom(mol, anchorId)!.element}${anchorId}`,
    selection: { atoms: [added.atom.id], bonds: [] },
    tidy: true,
  };
}

/** Create a bond between two atoms, or change the order of the existing one. */
export function bondAtoms(mol: Molecule, a: AtomId, b: AtomId, order: BondOrder): CommandResult {
  if (a === b) throw new CommandError("Pick two different atoms.");
  const existing = bondBetween(mol, a, b);
  if (existing) {
    if (existing.order === order) return { molecule: mol, label: "No change" };
    return { molecule: setBondOrder(mol, existing.id, order), label: `Bond ${existing.id}: ${order}`, selection: { atoms: [], bonds: [existing.id] }, tidy: true };
  }
  const { molecule, bond } = addBond(mol, { atomA: a, atomB: b, order });
  return { molecule, label: `Bond ${a}-${b} (${order})`, selection: { atoms: [], bonds: [bond.id] }, tidy: true };
}

const ORDER_CYCLE: BondOrder[] = ["single", "double", "triple"];

export function changeBondOrder(mol: Molecule, bondId: BondId, order: BondOrder): CommandResult {
  const bond = getBond(mol, bondId);
  if (!bond) throw new CommandError("Bond no longer exists.");
  if (bond.order === order) return { molecule: mol, label: "No change" };
  return { molecule: setBondOrder(mol, bondId, order), label: `Bond ${bondId}: ${order}`, tidy: true };
}

/** single -> double -> triple -> single (aromatic goes to single). */
export function cycleBondOrder(mol: Molecule, bondId: BondId): CommandResult {
  const bond = getBond(mol, bondId);
  if (!bond) throw new CommandError("Bond no longer exists.");
  const idx = ORDER_CYCLE.indexOf(bond.order);
  const next = ORDER_CYCLE[(idx + 1) % ORDER_CYCLE.length]!;
  return changeBondOrder(mol, bondId, next);
}

export function deleteAtom(mol: Molecule, atomId: AtomId): CommandResult {
  const atom = getAtom(mol, atomId);
  if (!atom) throw new CommandError("Atom no longer exists.");
  return { molecule: removeAtom(mol, atomId), label: `Delete ${atom.element}${atomId}`, selection: { atoms: [], bonds: [] } };
}

export function deleteBond(mol: Molecule, bondId: BondId): CommandResult {
  if (!getBond(mol, bondId)) throw new CommandError("Bond no longer exists.");
  return { molecule: removeBond(mol, bondId), label: `Delete bond ${bondId}`, selection: { atoms: [], bonds: [] } };
}

/** Delete everything in the selection (atoms take their bonds with them). */
export function deleteSelection(mol: Molecule, sel: Selection): CommandResult {
  let m = mol;
  for (const id of sel.bonds) if (getBond(m, id)) m = removeBond(m, id);
  for (const id of sel.atoms) if (getAtom(m, id)) m = removeAtom(m, id);
  if (m === mol) return { molecule: mol, label: "Nothing to delete" };
  const n = sel.atoms.length + sel.bonds.length;
  return { molecule: m, label: `Delete ${n} item${n > 1 ? "s" : ""}`, selection: { atoms: [], bonds: [] } };
}

export function setElement(mol: Molecule, atomId: AtomId, element: string): CommandResult {
  requireElement(element);
  const atom = getAtom(mol, atomId);
  if (!atom) throw new CommandError("Atom no longer exists.");
  if (atom.element === element) return { molecule: mol, label: "No change" };
  return { molecule: updateAtom(mol, atomId, { element }), label: `${atom.element}${atomId} -> ${element}`, tidy: true };
}

export function setFormalCharge(mol: Molecule, atomId: AtomId, formalCharge: number): CommandResult {
  const atom = getAtom(mol, atomId);
  if (!atom) throw new CommandError("Atom no longer exists.");
  if (!Number.isInteger(formalCharge)) throw new CommandError("Charge must be an integer.");
  return { molecule: updateAtom(mol, atomId, { formalCharge }), label: `Charge of ${atom.element}${atomId}: ${formalCharge > 0 ? "+" : ""}${formalCharge}` };
}

export function moveAtomTo(mol: Molecule, atomId: AtomId, position: Vec3): CommandResult {
  const atom = getAtom(mol, atomId);
  if (!atom) throw new CommandError("Atom no longer exists.");
  return { molecule: moveAtom(mol, atomId, position), label: `Move ${atom.element}${atomId}` };
}

/**
 * Add explicit hydrogens to satisfy the implicit hydrogen count of one atom (or every atom).
 * Placement uses the same heuristic as interactive adding.
 */
export function addHydrogens(mol: Molecule, atomId?: AtomId): CommandResult {
  const targets = atomId ? [atomId] : mol.atoms.map((a) => a.id);
  let m = mol;
  let added = 0;
  for (const id of targets) {
    if (!getAtom(m, id)) continue;
    let n = implicitHydrogenCount(m, id);
    while (n > 0) {
      const pos = placeBondedAtom(m, id, "H");
      const res = addAtom(m, { element: "H", position: pos });
      m = addBond(res.molecule, { atomA: id, atomB: res.atom.id }).molecule;
      added += 1;
      n -= 1;
    }
  }
  if (added === 0) return { molecule: mol, label: "No hydrogens to add" };
  return { molecule: m, label: `Add ${added} H`, tidy: true };
}

/** Remove every hydrogen atom (keeps the heavy-atom skeleton). */
export function removeHydrogens(mol: Molecule): CommandResult {
  let m = mol;
  let removed = 0;
  for (const a of mol.atoms) {
    if (a.element === "H") {
      m = removeAtom(m, a.id);
      removed += 1;
    }
  }
  if (removed === 0) return { molecule: mol, label: "No hydrogens to remove" };
  return { molecule: m, label: `Remove ${removed} H`, selection: { atoms: [], bonds: [] } };
}

// ---------------------------------------------------------------------------
// Stereochemistry and conformation
// ---------------------------------------------------------------------------

/** Mirror image: every stereocentre inverts (the enantiomer). */
export function mirror(mol: Molecule): CommandResult {
  if (mol.atoms.length === 0) return { molecule: mol, label: "Nothing to mirror" };
  return { molecule: mirrorMolecule(mol), label: "Mirror (enantiomer)" };
}

/** Swap two substituents around one tetrahedral centre; falls back with a clear error. */
export function invertStereocentre(mol: Molecule, atomId: AtomId): CommandResult {
  const atom = getAtom(mol, atomId);
  if (!atom) throw new CommandError("Atom no longer exists.");
  const inverted = invertCentre(mol, atomId);
  if (!inverted) throw new CommandError("This centre has no two independent substituent branches to swap (ring atom); use Mirror for the whole structure.");
  return { molecule: inverted, label: `Invert centre ${atom.element}${atomId}`, tidy: true };
}

/** Rotate the smaller side of an acyclic bond by `degrees` around the bond axis. */
export function rotateBond(mol: Molecule, bondId: BondId, degrees: number, side: "A" | "B" = "B"): CommandResult {
  const bond = getBond(mol, bondId);
  if (!bond) throw new CommandError("Bond no longer exists.");
  if (bondInRing(mol, bondId)) throw new CommandError("Ring bonds cannot be rotated.");
  return { molecule: rotateAroundBond(mol, bondId, (degrees * Math.PI) / 180, side), label: `Rotate bond ${bondId} by ${degrees}°` };
}

/** Swap E/Z on a double bond by rotating one side 180°, then let the tidy re-planarise. */
export function flipDoubleBond(mol: Molecule, bondId: BondId): CommandResult {
  const bond = getBond(mol, bondId);
  if (!bond) throw new CommandError("Bond no longer exists.");
  if (bond.order !== "double") throw new CommandError("E/Z flip needs a double bond.");
  if (bondInRing(mol, bondId)) throw new CommandError("Ring double bonds cannot be flipped.");
  return { molecule: rotateAroundBond(mol, bondId, Math.PI, "B"), label: `Flip E/Z on bond ${bondId}`, tidy: true };
}

// ---------------------------------------------------------------------------
// Fragment library
// ---------------------------------------------------------------------------

/**
 * Attach a library fragment to `anchorId`: one hydrogen on the anchor (if any) and one on the
 * fragment's attachment atom are replaced by the new bond. The fragment is placed at the ideal
 * bond length, oriented so its attachment direction points at the anchor; auto-tidy relaxes it.
 */
export function attachFragment(mol: Molecule, anchorId: AtomId, fragment: FragmentTemplate): CommandResult {
  const anchor = getAtom(mol, anchorId);
  if (!anchor) throw new CommandError("Anchor atom no longer exists.");
  const frag = fragment.molecule;
  const attach = getAtom(frag, fragment.attachAtomId);
  if (!attach) throw new CommandError("Fragment template is malformed.");

  // 1. Remove one hydrogen from the anchor (the one whose direction we will reuse), if present.
  let m = mol;
  let direction: Vec3 | null = null;
  const anchorHs = neighborsOf(m, anchorId).filter((n) => getAtom(m, n)?.element === "H");
  if (anchorHs.length > 0) {
    const h = getAtom(m, anchorHs[0]!)!;
    direction = v3.normalize(v3.sub(h.position, anchor.position));
    m = removeAtom(m, h.id);
  }
  // 2. Target position for the fragment's attachment atom.
  const target = direction
    ? v3.add(anchor.position, v3.scale(direction, covalentSum(anchor.element, attach.element)))
    : placeBondedAtom(m, anchorId, attach.element);
  const toAnchor = v3.normalize(v3.sub(anchor.position, target));

  // 3. Fragment frame: drop one hydrogen on the attachment atom, use its direction as the "bond out" axis.
  const fragHs = neighborsOf(frag, attach.id).filter((n) => getAtom(frag, n)?.element === "H");
  if (fragHs.length === 0) throw new CommandError("Fragment attachment atom has no hydrogen to replace.");
  const hOut = getAtom(frag, fragHs[0]!)!;
  const outDir = v3.normalize(v3.sub(hOut.position, attach.position));
  const axis = v3.cross(outDir, toAnchor);
  const angle = v3.angle(outDir, toAnchor);
  const rotate = (p: Vec3): Vec3 => {
    const rel = v3.sub(p, attach.position);
    const r = v3.length(axis) < 1e-6 ? (angle > Math.PI / 2 ? v3.scale(rel, -1) : rel) : v3.rotate(rel, axis, angle);
    return v3.add(target, r);
  };

  // 4. Copy fragment atoms/bonds with fresh ids.
  const idMap = new Map<AtomId, AtomId>();
  for (const a of frag.atoms) {
    if (a.id === hOut.id) continue;
    const added = addAtom(m, { element: a.element, position: rotate(a.position), formalCharge: a.formalCharge });
    m = added.molecule;
    idMap.set(a.id, added.atom.id);
  }
  for (const b of frag.bonds) {
    const a1 = idMap.get(b.atomA);
    const a2 = idMap.get(b.atomB);
    if (!a1 || !a2) continue;
    m = addBond(m, { atomA: a1, atomB: a2, order: b.order }).molecule;
  }
  const newAttach = idMap.get(attach.id)!;
  m = addBond(m, { atomA: anchorId, atomB: newAttach }).molecule;
  return { molecule: m, label: `Attach ${fragment.name} to ${anchor.element}${anchorId}`, selection: { atoms: [newAttach], bonds: [] }, tidy: true };
}

function covalentSum(a: string, b: string): number {
  // Ideal single-bond length via the placement helper's rule (sum of covalent radii).
  return placeBondedAtom({ schemaVersion: 1, id: "t", atoms: [{ id: "x", element: a, formalCharge: 0, position: { x: 0, y: 0, z: 0 } }], bonds: [], metadata: {} }, "x", b).x;
}
