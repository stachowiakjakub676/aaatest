import { describe, expect, it } from "vitest";
import { MolfileError, SAMPLE_MOLECULES, createMolecule, molecularFormula, parseMolfile, validateMolecule, writeMolfile } from "../src";
import type { Molecule } from "../src";

/** Structural equality ignoring ids/metadata (ids are regenerated on import). */
function skeleton(m: Molecule) {
  const index = new Map(m.atoms.map((a, i) => [a.id, i]));
  return {
    atoms: m.atoms.map((a) => [a.element, a.formalCharge, a.isotope ?? null, a.position.x, a.position.y, a.position.z]),
    bonds: m.bonds.map((b) => [index.get(b.atomA), index.get(b.atomB), b.order, b.stereo ?? null]).sort(),
  };
}

describe("writeMolfile", () => {
  it("produces a V2000 block with fixed-width columns", () => {
    const water = SAMPLE_MOLECULES.find((m) => m.id === "water")!;
    const text = writeMolfile(water);
    const lines = text.split("\n");
    expect(lines[0]).toBe("Water");
    expect(lines[3]).toBe("  3  2  0  0  0  0  0  0  0  0999 V2000");
    expect(lines[4]).toMatch(/^ {2,}-?\d\.\d{4} {2,}-?\d\.\d{4} {2,}-?\d\.\d{4} O   0  0  0  0  0  0  0  0  0  0  0  0$/);
    expect(lines[7]).toMatch(/^  1  [23]  1  0$/);
    expect(text.endsWith("M  END\n")).toBe(true);
  });

  it("writes charges and isotopes as M CHG / M ISO lines", () => {
    const mol = createMolecule({
      id: "chg",
      atoms: [
        { id: "n", element: "N", formalCharge: 1, position: { x: 0, y: 0, z: 0 } },
        { id: "c", element: "C", formalCharge: 0, position: { x: 1.4, y: 0, z: 0 }, isotope: 13 },
        { id: "o", element: "O", formalCharge: -1, position: { x: 2.8, y: 0, z: 0 } },
      ],
      bonds: [{ id: "b1", atomA: "n", atomB: "c", order: "single" }],
    });
    const text = writeMolfile(mol);
    expect(text).toContain("M  CHG  2   1   1   3  -1");
    expect(text).toContain("M  ISO  1   2  13");
  });

  it("rejects molecules beyond the V2000 limits", () => {
    const big = createMolecule({
      id: "big",
      atoms: Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}`, element: "C", formalCharge: 0, position: { x: i, y: 0, z: 0 } })),
      bonds: [],
    });
    expect(() => writeMolfile(big)).toThrow(MolfileError);
  });
});

describe("parseMolfile", () => {
  it("round-trips every sample molecule (write -> parse) structurally", () => {
    for (const sample of SAMPLE_MOLECULES) {
      const back = parseMolfile(writeMolfile(sample), { id: sample.id });
      expect(skeleton(back), sample.id).toEqual(skeleton(sample));
      expect(back.name).toBe(sample.name);
      expect(validateMolecule(back).valid).toBe(true);
      expect(molecularFormula(back)).toBe(molecularFormula(sample));
    }
  });

  it("round-trips charges, isotopes and stereo flags", () => {
    const mol = createMolecule({
      id: "chg",
      atoms: [
        { id: "n", element: "N", formalCharge: 1, position: { x: 0, y: 0, z: 0 } },
        { id: "c", element: "C", formalCharge: 0, position: { x: 1.4, y: 0, z: 0 }, isotope: 13 },
        { id: "o", element: "O", formalCharge: -1, position: { x: 2.8, y: 0, z: 0 } },
      ],
      bonds: [
        { id: "b1", atomA: "n", atomB: "c", order: "single", stereo: "wedge_up" },
        { id: "b2", atomA: "c", atomB: "o", order: "single", stereo: "wedge_down" },
      ],
    });
    expect(skeleton(parseMolfile(writeMolfile(mol)))).toEqual(skeleton(mol));
  });

  it("reads a molfile written by another program (RDKit style, legacy charge column)", () => {
    const text = `
     RDKit          3D

  2  1  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 N   0  3  0  0  0  0  0  0  0  0  0  0
    1.4000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0
M  END
$$$$
`;
    const mol = parseMolfile(text);
    expect(mol.atoms[0]!.formalCharge).toBe(1); // legacy column 3 = +1
    expect(mol.bonds).toHaveLength(1);
    expect(mol.id).toBe("imported");
  });

  it.each([
    ["too short", "x\n", /too short/],
    ["V3000", "n\n\n\n  0  0  0     0  0            999 V3000\nM  END\n", /V3000/],
    ["bad counts", "n\n\n\nabcdef\n", /counts line/],
    ["truncated", "n\n\n\n  2  0  0  0  0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 C   0  0", /ends before/],
    ["blank atom line", "n\n\n\n  2  0  0  0  0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 C   0  0\n\n", /atom line/],
    ["bad bond type", "n\n\n\n  2  1  0  0  0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 C   0  0\n    1.0000    0.0000    0.0000 C   0  0\n  1  2  9  0\nM  END\n", /bond line/],
  ])("rejects malformed input: %s", (_label, text, pattern) => {
    expect(() => parseMolfile(text)).toThrow(MolfileError);
    expect(() => parseMolfile(text)).toThrow(pattern);
  });
});
