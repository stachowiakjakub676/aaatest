/**
 * Editor commands: pure functions Molecule -> { molecule, label, selection? }.
 * They compose the domain operations and decide placement; they never touch the renderer.
 */
import {
  addAtom,
  addBond,
  bondBetween,
  getAtom,
  getBond,
  implicitHydrogenCount,
  isKnownElement,
  moveAtom,
  placeBondedAtom,
  removeAtom,
  removeBond,
  setBondOrder,
  updateAtom,
} from "@molecular-cad/molecule-model";
import type { AtomId, BondId, BondOrder, Molecule, Vec3 } from "@molecular-cad/molecule-model";
import type { Selection } from "../state/selection";

export interface CommandResult {
  molecule: Molecule;
  label: string;
  /** Selection after the command (undefined = keep the current one). */
  selection?: Selection;
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
  };
}

/** Create a bond between two atoms, or change the order of the existing one. */
export function bondAtoms(mol: Molecule, a: AtomId, b: AtomId, order: BondOrder): CommandResult {
  if (a === b) throw new CommandError("Pick two different atoms.");
  const existing = bondBetween(mol, a, b);
  if (existing) {
    if (existing.order === order) return { molecule: mol, label: "No change" };
    return { molecule: setBondOrder(mol, existing.id, order), label: `Bond ${existing.id}: ${order}`, selection: { atoms: [], bonds: [existing.id] } };
  }
  const { molecule, bond } = addBond(mol, { atomA: a, atomB: b, order });
  return { molecule, label: `Bond ${a}-${b} (${order})`, selection: { atoms: [], bonds: [bond.id] } };
}

const ORDER_CYCLE: BondOrder[] = ["single", "double", "triple"];

export function changeBondOrder(mol: Molecule, bondId: BondId, order: BondOrder): CommandResult {
  const bond = getBond(mol, bondId);
  if (!bond) throw new CommandError("Bond no longer exists.");
  if (bond.order === order) return { molecule: mol, label: "No change" };
  return { molecule: setBondOrder(mol, bondId, order), label: `Bond ${bondId}: ${order}` };
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
  return { molecule: updateAtom(mol, atomId, { element }), label: `${atom.element}${atomId} -> ${element}` };
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
  return { molecule: m, label: `Add ${added} H` };
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
