import { describe, expect, it } from "vitest";
import { SAMPLE_MOLECULES, createMolecule, validateMolecule } from "../src";
import type { Bond, Molecule } from "../src";

const P = { x: 0, y: 0, z: 0 };

function mol(atoms: Array<[string, string, number?]>, bonds: Array<[string, string, string, Bond["order"]?]>): Molecule {
  return createMolecule({
    id: "t",
    atoms: atoms.map(([id, element, charge], i) => ({
      id,
      element,
      formalCharge: charge ?? 0,
      position: { x: i * 1.2, y: 0, z: 0 },
    })),
    bonds: bonds.map(([id, atomA, atomB, order]) => ({ id, atomA, atomB, order: order ?? "single" })),
  });
}

function codes(m: Molecule): string[] {
  return validateMolecule(m).issues.map((i) => i.code);
}

describe("validateMolecule: graph integrity", () => {
  it("accepts every built-in sample molecule", () => {
    for (const sample of SAMPLE_MOLECULES) {
      const result = validateMolecule(sample);
      expect(result.issues, sample.id).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it("warns (not errors) on an empty molecule", () => {
    const result = validateMolecule(createMolecule({ id: "e" }));
    expect(result.valid).toBe(true);
    expect(result.issues.map((i) => i.code)).toEqual(["EMPTY_MOLECULE"]);
  });

  it("detects duplicate atom and bond ids", () => {
    const m = mol([["a", "C"], ["a", "C"]], [["b", "a", "a"], ["b", "a", "a"]]);
    expect(codes(m)).toContain("DUPLICATE_ATOM_ID");
    expect(codes(m)).toContain("DUPLICATE_BOND_ID");
  });

  it("detects unknown elements", () => {
    const result = validateMolecule(mol([["a", "Xx"]], []));
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: "UNKNOWN_ELEMENT", atomIds: ["a"] });
  });

  it("is case-sensitive about element symbols", () => {
    expect(codes(mol([["a", "CL"]], []))).toEqual(["UNKNOWN_ELEMENT"]);
    expect(codes(mol([["a", "Cl"]], []))).toEqual([]);
  });

  it("detects bonds referencing unknown atoms and self bonds", () => {
    expect(codes(mol([["a", "C"]], [["b", "a", "zzz"]]))).toContain("BOND_UNKNOWN_ATOM");
    expect(codes(mol([["a", "C"]], [["b", "a", "a"]]))).toContain("BOND_SELF");
  });

  it("detects duplicate bonds regardless of direction", () => {
    const m = mol([["a", "C"], ["b", "C"]], [["b1", "a", "b"], ["b2", "b", "a"]]);
    expect(codes(m)).toContain("BOND_DUPLICATE");
  });

  it("detects invalid bond orders coming from untyped input", () => {
    const m = mol([["a", "C"], ["b", "C"]], [["b1", "a", "b", "quadruple" as Bond["order"]]]);
    expect(codes(m)).toContain("INVALID_BOND_ORDER");
  });

  it("detects bad charges, isotopes, coordinates and implicit-H counts", () => {
    const base = mol([["a", "C"]], []);
    const atom = base.atoms[0]!;
    expect(codes({ ...base, atoms: [{ ...atom, formalCharge: 1.5 }] })).toContain("INVALID_CHARGE");
    expect(codes({ ...base, atoms: [{ ...atom, formalCharge: 40 }] })).toContain("INVALID_CHARGE");
    expect(codes({ ...base, atoms: [{ ...atom, isotope: -3 }] })).toContain("INVALID_ISOTOPE");
    expect(codes({ ...base, atoms: [{ ...atom, position: { x: NaN, y: 0, z: 0 } }] })).toContain("INVALID_COORDINATES");
    expect(codes({ ...base, atoms: [{ ...atom, implicitHydrogens: -1 }] })).toContain("INVALID_IMPLICIT_H");
  });
});

describe("validateMolecule: valence rules", () => {
  it("flags a five-bonded carbon", () => {
    const m = mol(
      [["c", "C"], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"], ["h5", "H"]],
      [["b1", "c", "h1"], ["b2", "c", "h2"], ["b3", "c", "h3"], ["b4", "c", "h4"], ["b5", "c", "h5"]],
    );
    const result = validateMolecule(m);
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === "VALENCE_EXCEEDED");
    expect(issue?.atomIds).toEqual(["c"]);
    expect(issue?.bondIds).toHaveLength(5);
  });

  it("accepts tetravalent nitrogen only when positively charged", () => {
    const atoms: Array<[string, string, number?]> = [["n", "N"], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"]];
    const bonds: Array<[string, string, string]> = [["b1", "n", "h1"], ["b2", "n", "h2"], ["b3", "n", "h3"], ["b4", "n", "h4"]];
    expect(codes(mol(atoms, bonds))).toContain("VALENCE_EXCEEDED");
    atoms[0] = ["n", "N", 1];
    expect(codes(mol(atoms, bonds))).toEqual([]);
  });

  it("applies charge rules for oxygen anion and carbocation", () => {
    // O- with two bonds: exceeded (allowed 1)
    expect(codes(mol([["o", "O", -1], ["h1", "H"], ["h2", "H"]], [["b1", "o", "h1"], ["b2", "o", "h2"]]))).toContain("VALENCE_EXCEEDED");
    // C+ with three bonds: fine; with four: exceeded
    const c3 = mol([["c", "C", 1], ["h1", "H"], ["h2", "H"], ["h3", "H"]], [["b1", "c", "h1"], ["b2", "c", "h2"], ["b3", "c", "h3"]]);
    expect(codes(c3)).toEqual([]);
    const c4 = mol([["c", "C", 1], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"]], [["b1", "c", "h1"], ["b2", "c", "h2"], ["b3", "c", "h3"], ["b4", "c", "h4"]]);
    expect(codes(c4)).toContain("VALENCE_EXCEEDED");
  });

  it("allows hypervalent sulfur and phosphorus up to their documented maxima", () => {
    const so = mol(
      [["s", "S"], ["o1", "O"], ["o2", "O"], ["o3", "O"]],
      [["b1", "s", "o1", "double"], ["b2", "s", "o2", "double"], ["b3", "s", "o3", "double"]],
    );
    expect(codes(so)).toEqual([]);
    const s8 = { ...so, bonds: [...so.bonds, { id: "b4", atomA: "s", atomB: "o1x", order: "double" as const }] };
    // o1x does not exist -> graph error, valence check is skipped
    expect(codes(s8)).toEqual(["BOND_UNKNOWN_ATOM"]);
  });

  it("counts user-specified implicit hydrogens in valence", () => {
    const base = mol([["c", "C"], ["n", "N"]], [["b1", "c", "n", "triple"]]);
    expect(codes(base)).toEqual([]);
    const withH = { ...base, atoms: base.atoms.map((a) => (a.id === "c" ? { ...a, implicitHydrogens: 2 } : a)) };
    expect(codes(withH)).toContain("VALENCE_EXCEEDED");
  });

  it("skips valence checks for metals (delegated to the chemistry engine)", () => {
    const m = mol(
      [["fe", "Fe"], ["c1", "C"], ["c2", "C"], ["c3", "C"], ["c4", "C"], ["c5", "C"], ["c6", "C"], ["c7", "C"]],
      [["b1", "fe", "c1"], ["b2", "fe", "c2"], ["b3", "fe", "c3"], ["b4", "fe", "c4"], ["b5", "fe", "c5"], ["b6", "fe", "c6"], ["b7", "fe", "c7"]],
    );
    expect(codes(m)).toEqual([]);
  });

  it("treats aromatic bonds as 1.5 in the valence sum", () => {
    // carbon with two aromatic bonds + one double bond = 5 -> exceeded
    const m = mol(
      [["c", "C"], ["a", "C"], ["b", "C"], ["o", "O"]],
      [["b1", "c", "a", "aromatic"], ["b2", "c", "b", "aromatic"], ["b3", "c", "o", "double"]],
    );
    const issue = validateMolecule(m).issues.find((i) => i.code === "VALENCE_EXCEEDED");
    expect(issue?.message).toContain("valence 5");
  });
});

describe("validateMolecule: geometry", () => {
  it("warns about overlapping atoms", () => {
    const m = createMolecule({
      id: "o",
      atoms: [
        { id: "a", element: "C", formalCharge: 0, position: P },
        { id: "b", element: "C", formalCharge: 0, position: { x: 0.1, y: 0, z: 0 } },
      ],
      bonds: [],
    });
    const result = validateMolecule(m);
    expect(result.valid).toBe(true);
    expect(result.issues[0]).toMatchObject({ code: "ATOMS_OVERLAP", severity: "warning", atomIds: ["a", "b"] });
  });
});
