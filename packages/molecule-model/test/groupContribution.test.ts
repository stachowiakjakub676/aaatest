import { describe, expect, it } from "vitest";
import { assignJobackGroups, createMolecule, getSampleMolecule, girolamiDensity, jobackEstimates, molecularWeight } from "../src";
import type { Molecule } from "../src/types";

const sample = (id: string) => getSampleMolecule(id)!;

/** Heavy-atom sketch (implicit hydrogens) built from an element list and bonds. */
function sketch(atoms: string[], bonds: Array<[number, number, "single" | "double" | "triple" | "aromatic"]>): Molecule {
  return createMolecule({
    id: "s",
    atoms: atoms.map((element, i) => ({ id: `a${i}`, element, formalCharge: 0, position: { x: i, y: 0, z: 0 } })),
    bonds: bonds.map(([a, b, order], i) => ({ id: `b${i}`, atomA: `a${a}`, atomB: `a${b}`, order })),
  });
}

describe("Joback group contributions", () => {
  it("reproduces the published acetone example", () => {
    // CC(=O)C: two CH3 and one >C=O.
    const acetone = sketch(["C", "C", "O", "C"], [[0, 1, "single"], [1, 2, "double"], [1, 3, "single"]]);
    const r = jobackEstimates(acetone);
    expect(r.groups.map((g) => `${g.groupId}x${g.count}`).sort()).toEqual(["C=Ox1", "CH3x2"]);
    expect(r.unassigned).toEqual([]);
    expect(r.atomCount).toBe(10);
    expect(r.tb).toBeCloseTo(322.11, 1);
    expect(r.tm).toBeCloseTo(173.5, 1);
    expect(r.tc).toBeCloseTo(500.6, 0);
    expect(r.pc).toBeCloseTo(48.0, 0);
    expect(r.hf).toBeCloseTo(-217.83, 1);
    expect(r.gf).toBeCloseTo(-154.54, 1);
    expect(r.hvap).toBeCloseTo(29.02, 1);
    expect(r.hfus).toBeCloseTo(5.125, 2);
    expect(r.cp298).toBeCloseTo(74.9, 0);
  });

  it("assigns the same groups whether hydrogens are explicit or implicit", () => {
    const ethanol = jobackEstimates(sample("ethanol"));
    expect(ethanol.groups.map((g) => g.groupId).sort()).toEqual(["CH2", "CH3", "OH"]);
    expect(ethanol.tb).toBeCloseTo(337.54, 1);
    const sketchEthanol = sketch(["C", "C", "O"], [[0, 1, "single"], [1, 2, "single"]]);
    expect(jobackEstimates(sketchEthanol).tb).toBeCloseTo(337.54, 1);
  });

  it("uses ring and aromatic variants and multi-atom groups", () => {
    const benzene = assignJobackGroups(sample("benzene"));
    expect(benzene.groups).toEqual([expect.objectContaining({ groupId: "r=CH", count: 6 })]);
    const aspirin = assignJobackGroups(sample("aspirin"));
    const ids = Object.fromEntries(aspirin.groups.map((g) => [g.groupId, g.count]));
    expect(ids).toEqual({ "r=CH": 4, "r=C": 2, COOH: 1, COO: 1, CH3: 1 });
    expect(aspirin.unassigned).toEqual([]);
    const aceticAcid = jobackEstimates(sample("acetic-acid"));
    expect(aceticAcid.tb).toBeCloseTo(198.2 + 23.58 + 169.09, 2);
  });

  it("shows the homologous-series trend: each CH2 adds 22.88 K", () => {
    const hexanal = sketch(["C", "C", "C", "C", "C", "C", "O"], [[0, 1, "single"], [1, 2, "single"], [2, 3, "single"], [3, 4, "single"], [4, 5, "single"], [5, 6, "double"]]);
    const heptanal = sketch(["C", "C", "C", "C", "C", "C", "C", "O"], [[0, 1, "single"], [1, 2, "single"], [2, 3, "single"], [3, 4, "single"], [4, 5, "single"], [5, 6, "single"], [6, 7, "double"]]);
    const a = jobackEstimates(hexanal);
    const b = jobackEstimates(heptanal);
    expect(a.groups.find((g) => g.groupId === "CHO")).toBeDefined();
    expect(b.tb! - a.tb!).toBeCloseTo(22.88, 5);
    expect(a.tb).toBeCloseTo(385.5, 0); // experimental 402 K: within the method's typical error
  });

  it("refuses molecules with atoms outside the group table instead of guessing", () => {
    const sulfone = sketch(["C", "S", "O", "O", "C"], [[0, 1, "single"], [1, 2, "double"], [1, 3, "double"], [1, 4, "single"]]);
    const r = jobackEstimates(sulfone);
    expect(r.unassigned).toEqual(["a1"]);
    expect(r.tb).toBeNull();
    expect(jobackEstimates(createMolecule({ id: "e" })).tb).toBeNull();
  });
});

describe("Girolami density", () => {
  it("matches the textbook examples within the method's error", () => {
    const water = girolamiDensity(sample("water"), molecularWeight(sample("water")).value!)!;
    expect(water.scaledVolume).toBe(4);
    expect(water.corrections).toEqual(["hydroxyl"]);
    expect(water.density).toBeCloseTo(0.99, 1);
    const benzene = girolamiDensity(sample("benzene"), molecularWeight(sample("benzene")).value!)!;
    expect(benzene.density).toBeCloseTo(0.87, 1);
    const acid = girolamiDensity(sample("acetic-acid"), 60.05)!;
    expect(acid.corrections).toEqual(["carboxylic acid"]);
  });
});
