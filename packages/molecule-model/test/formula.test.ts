import { describe, expect, it } from "vitest";
import { getSampleMolecule, hillOrder, implicitHydrogenCount, molecularFormula, molecularWeight, createMolecule } from "../src";
import type { Molecule } from "../src";

function sample(id: string): Molecule {
  const m = getSampleMolecule(id);
  if (!m) throw new Error(`missing sample ${id}`);
  return m;
}

describe("hillOrder", () => {
  it("puts C then H first when carbon is present", () => {
    expect(hillOrder(["O", "H", "N", "C"])).toEqual(["C", "H", "N", "O"]);
  });
  it("is alphabetical without carbon", () => {
    expect(hillOrder(["O", "H", "Na"])).toEqual(["H", "Na", "O"]);
  });
});

describe("molecularFormula / molecularWeight (explicit atoms)", () => {
  it.each([
    ["water", "H2O", 18.015],
    ["methane", "CH4", 16.043],
    ["ethanol", "C2H6O", 46.069],
    ["benzene", "C6H6", 78.114],
    ["aspirin", "C9H8O4", 180.159],
    ["caffeine", "C8H10N4O2", 194.194],
    ["glucose", "C6H12O6", 180.156],
  ])("%s -> %s, %f g/mol", (id, formula, weight) => {
    const m = sample(id);
    expect(molecularFormula(m)).toBe(formula);
    const mw = molecularWeight(m);
    expect(mw.approximate).toBe(false);
    expect(mw.value).toBeCloseTo(weight, 2);
  });

  it("appends the net charge", () => {
    const m = createMolecule({
      id: "nh4",
      atoms: [
        { id: "n", element: "N", formalCharge: 1, position: { x: 0, y: 0, z: 0 } },
        ...[1, 2, 3, 4].map((i) => ({ id: `h${i}`, element: "H", formalCharge: 0, position: { x: i, y: 0, z: 0 } })),
      ],
      bonds: [1, 2, 3, 4].map((i) => ({ id: `b${i}`, atomA: "n", atomB: `h${i}`, order: "single" as const })),
    });
    expect(molecularFormula(m)).toBe("H4N+");
    const so4 = createMolecule({
      id: "so4",
      atoms: [
        { id: "s", element: "S", formalCharge: 0, position: { x: 0, y: 0, z: 0 } },
        ...[1, 2, 3, 4].map((i) => ({ id: `o${i}`, element: "O", formalCharge: i <= 2 ? -1 : 0, position: { x: i, y: 0, z: 0 } })),
      ],
      bonds: [],
    });
    expect(molecularFormula(so4)).toBe("O4S2-");
  });

  it("marks weights with isotopes or mass-number-only elements as approximate", () => {
    const m = createMolecule({
      id: "iso",
      atoms: [{ id: "c", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 }, isotope: 13 }],
      bonds: [],
    });
    const mw = molecularWeight(m);
    expect(mw.approximate).toBe(true);
    expect(mw.value).toBeCloseTo(13, 5);
    const tc = createMolecule({ id: "tc", atoms: [{ id: "t", element: "Tc", formalCharge: 0, position: { x: 0, y: 0, z: 0 } }], bonds: [] });
    expect(molecularWeight(tc)).toEqual({ value: 98, approximate: true });
  });

  it("returns no weight for unknown elements", () => {
    const m = createMolecule({ id: "x", atoms: [{ id: "x", element: "Xx", formalCharge: 0, position: { x: 0, y: 0, z: 0 } }], bonds: [] });
    expect(molecularWeight(m).value).toBeUndefined();
  });
});

describe("implicit hydrogens", () => {
  const heavyEthanol = createMolecule({
    id: "etoh",
    atoms: [
      { id: "c1", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } },
      { id: "c2", element: "C", formalCharge: 0, position: { x: 1.5, y: 0, z: 0 } },
      { id: "o", element: "O", formalCharge: 0, position: { x: 3, y: 0, z: 0 } },
    ],
    bonds: [
      { id: "b1", atomA: "c1", atomB: "c2", order: "single" },
      { id: "b2", atomA: "c2", atomB: "o", order: "single" },
    ],
  });

  it("fills valence with hydrogens for organic elements", () => {
    expect(implicitHydrogenCount(heavyEthanol, "c1")).toBe(3);
    expect(implicitHydrogenCount(heavyEthanol, "c2")).toBe(2);
    expect(implicitHydrogenCount(heavyEthanol, "o")).toBe(1);
    expect(molecularFormula(heavyEthanol)).toBe("C2O");
    expect(molecularFormula(heavyEthanol, { includeImplicitHydrogens: true })).toBe("C2H6O");
    expect(molecularWeight(heavyEthanol, { includeImplicitHydrogens: true }).value).toBeCloseTo(46.069, 2);
  });

  it("uses the smallest allowed valence for multivalent elements", () => {
    const h2s = createMolecule({ id: "s", atoms: [{ id: "s", element: "S", formalCharge: 0, position: { x: 0, y: 0, z: 0 } }], bonds: [] });
    expect(implicitHydrogenCount(h2s, "s")).toBe(2);
  });

  it("honours an explicit implicitHydrogens value and gives 0 for metals / over-valent atoms", () => {
    const m = createMolecule({
      id: "m",
      atoms: [
        { id: "c", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 }, implicitHydrogens: 1 },
        { id: "fe", element: "Fe", formalCharge: 0, position: { x: 2, y: 0, z: 0 } },
      ],
      bonds: [],
    });
    expect(implicitHydrogenCount(m, "c")).toBe(1);
    expect(implicitHydrogenCount(m, "fe")).toBe(0);
    expect(() => implicitHydrogenCount(m, "nope")).toThrow(/Unknown atom/);
  });
});
