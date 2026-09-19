import { beforeEach, describe, expect, it } from "vitest";
import {
  addAtom,
  addBond,
  applyConformer,
  bondBetween,
  bondOrderValue,
  centroid,
  createMolecule,
  explicitValence,
  extractConformer,
  moveAtom,
  neighborsOf,
  removeAtom,
  removeBond,
  resetIdCounter,
  setBondOrder,
  totalFormalCharge,
  updateAtom,
} from "../src";
import type { Molecule } from "../src";

const O = { x: 0, y: 0, z: 0 };

function water(): Molecule {
  let mol = createMolecule({ id: "w", name: "water" });
  const o = addAtom(mol, { id: "O1", element: "O", position: O });
  mol = o.molecule;
  const h1 = addAtom(mol, { id: "H1", element: "H", position: { x: 0.96, y: 0, z: 0 } });
  mol = h1.molecule;
  const h2 = addAtom(mol, { id: "H2", element: "H", position: { x: -0.24, y: 0.93, z: 0 } });
  mol = h2.molecule;
  mol = addBond(mol, { id: "b1", atomA: "O1", atomB: "H1" }).molecule;
  mol = addBond(mol, { id: "b2", atomA: "O1", atomB: "H2" }).molecule;
  return mol;
}

describe("createMolecule", () => {
  beforeEach(() => resetIdCounter());

  it("creates an empty molecule with schema version 1", () => {
    const mol = createMolecule();
    expect(mol.schemaVersion).toBe(1);
    expect(mol.atoms).toEqual([]);
    expect(mol.bonds).toEqual([]);
    expect(mol.metadata).toEqual({});
    expect(mol.id).toBe("mol1");
  });
});

describe("atom operations", () => {
  it("adds atoms immutably", () => {
    const mol = createMolecule({ id: "m" });
    const { molecule: next, atom } = addAtom(mol, { element: "C", position: O, id: "C1" });
    expect(mol.atoms).toHaveLength(0);
    expect(next.atoms).toHaveLength(1);
    expect(atom).toEqual({ id: "C1", element: "C", formalCharge: 0, position: O });
  });

  it("copies the position so later mutation of the input does not leak", () => {
    const pos = { x: 1, y: 2, z: 3 };
    const { molecule } = addAtom(createMolecule({ id: "m" }), { element: "C", position: pos, id: "C1" });
    pos.x = 99;
    expect(molecule.atoms[0]!.position.x).toBe(1);
  });

  it("never generates an id that collides with existing atoms or bonds (regression)", () => {
    resetIdCounter();
    const mol = createMolecule({
      id: "loaded",
      atoms: [1, 2, 3].map((i) => ({ id: `a${i}`, element: "C", formalCharge: 0, position: { x: i, y: 0, z: 0 } })),
      bonds: [{ id: "b1", atomA: "a1", atomB: "a2", order: "single" }],
    });
    const { molecule, atom } = addAtom(mol, { element: "N", position: O });
    expect(["a1", "a2", "a3"]).not.toContain(atom.id);
    const { bond } = addBond(molecule, { atomA: atom.id, atomB: "a3" });
    expect(bond.id).not.toBe("b1");
  });

  it("rejects duplicate atom ids", () => {
    const { molecule } = addAtom(createMolecule({ id: "m" }), { element: "C", position: O, id: "C1" });
    expect(() => addAtom(molecule, { element: "N", position: O, id: "C1" })).toThrow(/already exists/);
  });

  it("removes an atom together with its bonds", () => {
    const mol = removeAtom(water(), "H1");
    expect(mol.atoms.map((a) => a.id)).toEqual(["O1", "H2"]);
    expect(mol.bonds.map((b) => b.id)).toEqual(["b2"]);
  });

  it("throws when removing an unknown atom", () => {
    expect(() => removeAtom(water(), "X")).toThrow(/Unknown atom/);
  });

  it("moves and updates atoms", () => {
    const moved = moveAtom(water(), "H1", { x: 5, y: 5, z: 5 });
    expect(moved.atoms.find((a) => a.id === "H1")!.position).toEqual({ x: 5, y: 5, z: 5 });
    const charged = updateAtom(water(), "O1", { formalCharge: -1 });
    expect(totalFormalCharge(charged)).toBe(-1);
  });
});

describe("bond operations", () => {
  it("adds single bonds by default", () => {
    const mol = water();
    expect(mol.bonds[0]!.order).toBe("single");
    expect(bondBetween(mol, "H1", "O1")?.id).toBe("b1");
  });

  it("rejects self-bonds, unknown atoms and duplicate bonds", () => {
    const mol = water();
    expect(() => addBond(mol, { atomA: "O1", atomB: "O1" })).toThrow(/itself/);
    expect(() => addBond(mol, { atomA: "O1", atomB: "X" })).toThrow(/Unknown atom/);
    expect(() => addBond(mol, { atomA: "H1", atomB: "O1" })).toThrow(/already exists/);
  });

  it("changes bond order and removes bonds", () => {
    const mol = setBondOrder(water(), "b1", "double");
    expect(mol.bonds.find((b) => b.id === "b1")!.order).toBe("double");
    expect(removeBond(mol, "b1").bonds).toHaveLength(1);
    expect(() => removeBond(mol, "nope")).toThrow(/Unknown bond/);
  });

  it("computes neighbours and explicit valence", () => {
    const mol = water();
    expect(neighborsOf(mol, "O1").sort()).toEqual(["H1", "H2"]);
    expect(explicitValence(mol, "O1")).toBe(2);
    expect(explicitValence(setBondOrder(mol, "b1", "aromatic"), "O1")).toBe(2.5);
  });

  it("maps bond orders to numeric values", () => {
    expect(bondOrderValue("single")).toBe(1);
    expect(bondOrderValue("double")).toBe(2);
    expect(bondOrderValue("triple")).toBe(3);
    expect(bondOrderValue("aromatic")).toBe(1.5);
  });
});

describe("conformers", () => {
  it("round-trips coordinates through a conformer", () => {
    const mol = water();
    const conf = extractConformer(mol, "c1", "initial");
    const moved = moveAtom(mol, "H1", { x: 9, y: 9, z: 9 });
    const restored = applyConformer(moved, conf);
    expect(restored.atoms).toEqual(mol.atoms);
    expect(conf.name).toBe("initial");
  });

  it("rejects conformers that do not cover every atom", () => {
    const mol = water();
    expect(() => applyConformer(mol, { id: "bad", positions: { O1: O } })).toThrow(/lacks coordinates/);
  });
});

describe("geometry", () => {
  it("computes the centroid", () => {
    const mol = water();
    const c = centroid(mol);
    expect(c.x).toBeCloseTo((0 + 0.96 - 0.24) / 3);
    expect(c.y).toBeCloseTo(0.93 / 3);
    expect(centroid(createMolecule({ id: "e" }))).toEqual(O);
  });
});
