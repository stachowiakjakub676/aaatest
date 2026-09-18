import { describe, expect, it } from "vitest";
import { addAtom, addBond, covalentRadius, createMolecule, distance, freeDirection, guessGeometry, idealBondLength, placeBondedAtom, v3 } from "../src";
import type { Molecule } from "../src";

const deg = (rad: number) => (rad * 180) / Math.PI;

/** Build a molecule by repeatedly attaching atoms to an anchor with the placement heuristic. */
function grow(mol: Molecule, anchor: string, elements: string[], order: "single" | "double" | "triple" = "single"): Molecule {
  let m = mol;
  for (const el of elements) {
    const pos = placeBondedAtom(m, anchor, el, order);
    const { molecule, atom } = addAtom(m, { element: el, position: pos });
    m = addBond(molecule, { atomA: anchor, atomB: atom.id, order }).molecule;
  }
  return m;
}

function anglesAt(mol: Molecule, center: string): number[] {
  const c = mol.atoms.find((a) => a.id === center)!;
  const others = mol.atoms.filter((a) => a.id !== center);
  const out: number[] = [];
  for (let i = 0; i < others.length; i++)
    for (let j = i + 1; j < others.length; j++) {
      out.push(deg(v3.angle(v3.sub(others[i]!.position, c.position), v3.sub(others[j]!.position, c.position))));
    }
  return out;
}

describe("vec3", () => {
  it("rotates with Rodrigues' formula", () => {
    const r = v3.rotate({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, Math.PI / 2);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
    expect(v3.length(v3.perpendicular({ x: 0, y: 5, z: 0 }))).toBeCloseTo(1);
    expect(v3.dot(v3.perpendicular({ x: 0, y: 5, z: 0 }), { x: 0, y: 1, z: 0 })).toBeCloseTo(0);
  });
});

describe("idealBondLength", () => {
  it("uses covalent radii and shortens multiple bonds", () => {
    expect(idealBondLength("C", "C")).toBeCloseTo(covalentRadius("C") * 2);
    expect(idealBondLength("C", "H")).toBeCloseTo(1.07, 2);
    expect(idealBondLength("C", "C", "double")).toBeLessThan(idealBondLength("C", "C"));
    expect(idealBondLength("C", "C", "triple")).toBeLessThan(idealBondLength("C", "C", "double"));
  });
});

describe("placeBondedAtom", () => {
  it("builds methane with tetrahedral angles step by step", () => {
    const { molecule: base } = addAtom(createMolecule({ id: "m" }), { id: "c", element: "C", position: { x: 0, y: 0, z: 0 } });
    const methane = grow(base, "c", ["H", "H", "H", "H"]);
    expect(methane.atoms).toHaveLength(5);
    for (const h of methane.atoms.filter((a) => a.element === "H")) {
      expect(distance(h.position, { x: 0, y: 0, z: 0 })).toBeCloseTo(idealBondLength("C", "H"), 6);
    }
    for (const angle of anglesAt(methane, "c")) expect(angle).toBeCloseTo(109.47, 0);
  });

  it("builds a planar trigonal centre when a double bond is present", () => {
    let m = addAtom(createMolecule({ id: "m" }), { id: "c", element: "C", position: { x: 0, y: 0, z: 0 } }).molecule;
    m = grow(m, "c", ["O"], "double");
    m = grow(m, "c", ["H", "H"]);
    expect(guessGeometry(m, "c")).toBe("trigonal");
    for (const angle of anglesAt(m, "c")) expect(angle).toBeCloseTo(120, 0);
  });

  it("places a linear substituent across a triple bond", () => {
    let m = addAtom(createMolecule({ id: "m" }), { id: "c", element: "C", position: { x: 0, y: 0, z: 0 } }).molecule;
    m = grow(m, "c", ["N"], "triple");
    m = grow(m, "c", ["H"]);
    expect(anglesAt(m, "c")[0]).toBeCloseTo(180, 0);
  });

  it("gives an isolated atom a deterministic direction and never a zero vector", () => {
    const m = addAtom(createMolecule({ id: "m" }), { id: "c", element: "C", position: { x: 1, y: 2, z: 3 } }).molecule;
    const dir = freeDirection(m, "c", "tetrahedral");
    expect(v3.length(dir)).toBeCloseTo(1);
    expect(placeBondedAtom(m, "c", "C")).toEqual({ x: 1 + idealBondLength("C", "C"), y: 2, z: 3 });
    expect(() => placeBondedAtom(m, "nope", "C")).toThrow(/Unknown atom/);
  });

  it("keeps adding carbons indefinitely with sane bond lengths", () => {
    let m = addAtom(createMolecule({ id: "chain" }), { id: "a0", element: "C", position: { x: 0, y: 0, z: 0 } }).molecule;
    let anchor = "a0";
    for (let i = 1; i <= 30; i++) {
      const pos = placeBondedAtom(m, anchor, "C");
      const res = addAtom(m, { id: `a${i}`, element: "C", position: pos });
      m = addBond(res.molecule, { atomA: anchor, atomB: `a${i}` }).molecule;
      anchor = `a${i}`;
    }
    expect(m.atoms).toHaveLength(31);
    for (const b of m.bonds) {
      const a = m.atoms.find((x) => x.id === b.atomA)!;
      const c = m.atoms.find((x) => x.id === b.atomB)!;
      expect(distance(a.position, c.position)).toBeCloseTo(idealBondLength("C", "C"), 6);
    }
    // A zig-zag chain should extend, not fold onto itself.
    const first = m.atoms[0]!.position;
    const last = m.atoms[30]!.position;
    expect(distance(first, last)).toBeGreaterThan(10);
  });
});
