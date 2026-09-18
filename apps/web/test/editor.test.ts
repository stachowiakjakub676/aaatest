import { describe, expect, it } from "vitest";
import { createMolecule, distance, getSampleMolecule, idealBondLength, molecularFormula, validateMolecule } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import {
  addBondedAtom,
  addFreeAtom,
  addHydrogens,
  bondAtoms,
  changeBondOrder,
  CommandError,
  cycleBondOrder,
  deleteAtom,
  deleteBond,
  deleteSelection,
  moveAtomTo,
  removeHydrogens,
  setElement,
  setFormalCharge,
} from "../src/editor/commands";
import { canRedo, canUndo, commit, commitFrom, createHistory, redo, redoLabel, replacePresent, undo, undoLabel } from "../src/editor/history";

const empty = () => createMolecule({ id: "new" });

describe("open-world editing: building from nothing", () => {
  it("grows an alkane chain one carbon at a time, always valid", () => {
    let r = addFreeAtom(empty(), "C", { x: 0, y: 0, z: 0 });
    let anchor = r.selection!.atoms[0]!;
    for (let i = 0; i < 12; i++) {
      r = addBondedAtom(r.molecule, anchor, "C");
      anchor = r.selection!.atoms[0]!;
      expect(validateMolecule(r.molecule).valid).toBe(true);
    }
    expect(r.molecule.atoms).toHaveLength(13);
    expect(r.molecule.bonds).toHaveLength(12);
    expect(molecularFormula(r.molecule, { includeImplicitHydrogens: true })).toBe("C13H28");
  });

  it("adds any known element and rejects unknown symbols", () => {
    const r = addFreeAtom(empty(), "Og", { x: 0, y: 0, z: 0 });
    expect(r.molecule.atoms[0]!.element).toBe("Og");
    expect(() => addFreeAtom(empty(), "Xx", { x: 0, y: 0, z: 0 })).toThrow(CommandError);
    expect(() => addBondedAtom(r.molecule, "missing", "C")).toThrow(/no longer exists/);
  });

  it("places bonded atoms at the ideal bond length and selects the new atom", () => {
    const c = addFreeAtom(empty(), "C", { x: 1, y: 1, z: 1 });
    const o = addBondedAtom(c.molecule, c.selection!.atoms[0]!, "O", "double");
    const [cAtom, oAtom] = o.molecule.atoms as [Molecule["atoms"][0], Molecule["atoms"][0]];
    expect(distance(cAtom.position, oAtom.position)).toBeCloseTo(idealBondLength("C", "O", "double"), 6);
    expect(o.molecule.bonds[0]!.order).toBe("double");
    expect(o.selection).toEqual({ atoms: [oAtom.id], bonds: [] });
    expect(o.label).toMatch(/Add O to C/);
  });

  it("fills and strips hydrogens", () => {
    let r = addFreeAtom(empty(), "C", { x: 0, y: 0, z: 0 });
    r = addBondedAtom(r.molecule, r.selection!.atoms[0]!, "O");
    const withH = addHydrogens(r.molecule);
    expect(molecularFormula(withH.molecule)).toBe("CH4O");
    expect(validateMolecule(withH.molecule).valid).toBe(true);
    expect(withH.label).toBe("Add 4 H");
    expect(addHydrogens(withH.molecule).label).toBe("No hydrogens to add");
    const stripped = removeHydrogens(withH.molecule);
    expect(molecularFormula(stripped.molecule)).toBe("CO");
    expect(stripped.label).toBe("Remove 4 H");
  });
});

describe("bond commands", () => {
  function twoCarbons() {
    const a = addFreeAtom(empty(), "C", { x: 0, y: 0, z: 0 });
    const b = addFreeAtom(a.molecule, "C", { x: 1.5, y: 0, z: 0 });
    return { mol: b.molecule, a: a.selection!.atoms[0]!, b: b.selection!.atoms[0]! };
  }

  it("creates, upgrades, cycles and deletes bonds", () => {
    const { mol, a, b } = twoCarbons();
    const bonded = bondAtoms(mol, a, b, "single");
    expect(bonded.molecule.bonds).toHaveLength(1);
    const bondId = bonded.selection!.bonds[0]!;
    expect(bondAtoms(bonded.molecule, a, b, "single").label).toBe("No change");
    const dbl = bondAtoms(bonded.molecule, b, a, "double");
    expect(dbl.molecule.bonds[0]!.order).toBe("double");
    expect(dbl.molecule.bonds).toHaveLength(1);
    const cycled = cycleBondOrder(dbl.molecule, bondId);
    expect(cycled.molecule.bonds[0]!.order).toBe("triple");
    expect(cycleBondOrder(cycled.molecule, bondId).molecule.bonds[0]!.order).toBe("single");
    expect(changeBondOrder(cycled.molecule, bondId, "aromatic").molecule.bonds[0]!.order).toBe("aromatic");
    expect(deleteBond(cycled.molecule, bondId).molecule.bonds).toHaveLength(0);
    expect(() => bondAtoms(mol, a, a, "single")).toThrow(/two different/);
    expect(() => deleteBond(mol, "nope")).toThrow(CommandError);
  });

  it("lets the validator, not the editor, report over-valent results", () => {
    const { mol, a, b } = twoCarbons();
    let m = bondAtoms(mol, a, b, "triple").molecule;
    m = addBondedAtom(m, a, "C", "double").molecule; // C with triple + double = 5
    expect(validateMolecule(m).valid).toBe(false);
  });
});

describe("atom commands", () => {
  it("changes element, charge and position; deletes atoms with their bonds", () => {
    const mol = getSampleMolecule("water")!;
    const o = mol.atoms[0]!;
    const asS = setElement(mol, o.id, "S");
    expect(molecularFormula(asS.molecule)).toBe("H2S");
    expect(setElement(mol, o.id, "O").label).toBe("No change");
    expect(() => setElement(mol, o.id, "Q")).toThrow(CommandError);
    const charged = setFormalCharge(mol, o.id, -1);
    expect(charged.molecule.atoms[0]!.formalCharge).toBe(-1);
    expect(() => setFormalCharge(mol, o.id, 0.5)).toThrow(/integer/);
    const moved = moveAtomTo(mol, o.id, { x: 9, y: 9, z: 9 });
    expect(moved.molecule.atoms[0]!.position).toEqual({ x: 9, y: 9, z: 9 });
    const del = deleteAtom(mol, o.id);
    expect(del.molecule.atoms).toHaveLength(2);
    expect(del.molecule.bonds).toHaveLength(0);
    expect(del.selection).toEqual({ atoms: [], bonds: [] });
  });

  it("deletes a mixed selection and ignores stale ids", () => {
    const mol = getSampleMolecule("ethanol")!;
    const sel = { atoms: [mol.atoms[0]!.id, "stale"], bonds: [mol.bonds[0]!.id] };
    const r = deleteSelection(mol, sel);
    expect(r.molecule.atoms).toHaveLength(mol.atoms.length - 1);
    expect(r.label).toBe("Delete 3 items");
    expect(deleteSelection(mol, { atoms: [], bonds: [] }).label).toBe("Nothing to delete");
  });
});

describe("history", () => {
  it("undoes and redoes commits in order", () => {
    let h = createHistory(empty());
    const s1 = addFreeAtom(h.present, "C", { x: 0, y: 0, z: 0 });
    h = commit(h, s1.molecule, s1.label);
    const s2 = addBondedAtom(h.present, s1.selection!.atoms[0]!, "N");
    h = commit(h, s2.molecule, s2.label);
    expect(h.present.atoms).toHaveLength(2);
    expect(undoLabel(h)).toBe(s2.label);
    h = undo(h);
    expect(h.present.atoms).toHaveLength(1);
    expect(redoLabel(h)).toBe(s2.label);
    h = undo(h);
    expect(h.present.atoms).toHaveLength(0);
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    h = redo(h);
    h = redo(h);
    expect(h.present.atoms).toHaveLength(2);
    expect(canRedo(h)).toBe(false);
    expect(redo(h)).toBe(h);
  });

  it("drops the redo stack on a new commit and ignores no-op commits", () => {
    let h = createHistory(empty());
    h = commit(h, addFreeAtom(h.present, "C", { x: 0, y: 0, z: 0 }).molecule, "Add C");
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = commit(h, addFreeAtom(h.present, "N", { x: 0, y: 0, z: 0 }).molecule, "Add N");
    expect(canRedo(h)).toBe(false);
    expect(commit(h, h.present, "noop")).toBe(h);
  });

  it("collapses a drag into one undo step", () => {
    let h = createHistory(getSampleMolecule("water")!);
    const before = h.present;
    const id = before.atoms[0]!.id;
    for (let i = 1; i <= 5; i++) h = replacePresent(h, moveAtomTo(h.present, id, { x: i, y: 0, z: 0 }).molecule);
    expect(canUndo(h)).toBe(false);
    h = commitFrom(h, before, "Move O");
    expect(h.past).toHaveLength(1);
    expect(h.present.atoms[0]!.position.x).toBe(5);
    expect(undo(h).present).toBe(before);
    expect(commitFrom(h, h.present, "noop")).toBe(h);
  });
});
