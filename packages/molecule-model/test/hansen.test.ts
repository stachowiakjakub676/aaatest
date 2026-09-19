import { describe, expect, it } from "vitest";
import { CHEM21_ORDER, SOLVENTS, assignHansenGroups, createMolecule, getSampleMolecule, greenerAlternatives, hansenDistance, hansenParameters, rankSolvents } from "../src";
import type { Molecule } from "../src/types";

function sketch(atoms: string[], bonds: Array<[number, number, "single" | "double" | "triple" | "aromatic"]>): Molecule {
  return createMolecule({
    id: "s",
    atoms: atoms.map((element, i) => ({ id: `a${i}`, element, formalCharge: 0, position: { x: i, y: 0, z: 0 } })),
    bonds: bonds.map(([a, b, order], i) => ({ id: `b${i}`, atomA: `a${a}`, atomB: `a${b}`, order })),
  });
}

describe("Hoftyzer–Van Krevelen Hansen parameters", () => {
  it("ethanol lands within the method's error of Hansen's values (15.8, 8.8, 19.4)", () => {
    const h = hansenParameters(getSampleMolecule("ethanol")!, 58.4)!; // V = M/ρ at 25 °C
    expect(h.groups.map((g) => `${g.groupId}x${g.count}`).sort()).toEqual(["CH2x1", "CH3x1", "OHx1"]);
    expect(h.dd).toBeCloseTo(15.4, 0);
    expect(h.dp).toBeCloseTo(8.6, 0);
    expect(h.dh).toBeCloseTo(18.5, 0);
    expect(Math.abs(h.dd - 15.8)).toBeLessThan(1.5);
    expect(Math.abs(h.dp - 8.8)).toBeLessThan(1.5);
    expect(Math.abs(h.dh - 19.4)).toBeLessThan(1.5);
  });

  it("acetone and toluene: ketone polarity, phenyl dispersion", () => {
    const acetone = sketch(["C", "C", "O", "C"], [[0, 1, "single"], [1, 2, "double"], [1, 3, "single"]]);
    const a = hansenParameters(acetone, 74.0)!;
    expect(Math.abs(a.dd - 15.5)).toBeLessThan(1);
    expect(Math.abs(a.dp - 10.4)).toBeLessThan(1);
    const toluene = sketch(["C", "C", "C", "C", "C", "C", "C"], [[0, 1, "single"], [1, 2, "aromatic"], [2, 3, "aromatic"], [3, 4, "aromatic"], [4, 5, "aromatic"], [5, 6, "aromatic"], [6, 1, "aromatic"]]);
    const t = hansenParameters(toluene, 106.3)!;
    expect(t.groups.map((g) => g.groupId).sort()).toEqual(["CH3", "Ph1"]);
    expect(Math.abs(t.dd - 18.0)).toBeLessThan(1);
    expect(t.dp).toBeLessThan(2);
    expect(t.dh).toBe(0);
  });

  it("applies the symmetry rule to identical halogens on one carbon", () => {
    const chloroform = sketch(["C", "Cl", "Cl", "Cl"], [[0, 1, "single"], [0, 2, "single"], [0, 3, "single"]]);
    const c = hansenParameters(chloroform, 80.7)!;
    expect(c.groups.find((g) => g.groupId === "Cl")!.polarFactor).toBe(0.25);
    expect(Math.abs(c.dp - 3.1)).toBeLessThan(1); // Hansen: 3.1; without the rule it would be ≈ 11.8
    expect(Math.abs(c.dd - 17.8)).toBeLessThan(1);
    const ccl4 = sketch(["C", "Cl", "Cl", "Cl", "Cl"], [[0, 1, "single"], [0, 2, "single"], [0, 3, "single"], [0, 4, "single"]]);
    expect(hansenParameters(ccl4, 97.1)!.dp).toBe(0);
  });

  it("refuses structures outside the table instead of guessing", () => {
    const pyridine = sketch(["N", "C", "C", "C", "C", "C"], [[0, 1, "aromatic"], [1, 2, "aromatic"], [2, 3, "aromatic"], [3, 4, "aromatic"], [4, 5, "aromatic"], [5, 0, "aromatic"]]);
    expect(assignHansenGroups(pyridine).unassigned.length).toBeGreaterThan(0);
    expect(hansenParameters(pyridine, 80)).toBeNull();
    const cyclohexane = sketch(["C", "C", "C", "C", "C", "C"], [[0, 1, "single"], [1, 2, "single"], [2, 3, "single"], [3, 4, "single"], [4, 5, "single"], [5, 0, "single"]]);
    const c = hansenParameters(cyclohexane, 108.7)!;
    expect(c.groups.find((g) => g.groupId === "ring")!.count).toBe(1);
    expect(Math.abs(c.dd - 16.8)).toBeLessThan(1.5);
  });
});

describe("solvent table", () => {
  it("has consistent classes and a distance that is zero to itself", () => {
    expect(SOLVENTS.length).toBeGreaterThan(40);
    expect(new Set(SOLVENTS.map((s) => s.id)).size).toBe(SOLVENTS.length);
    for (const s of SOLVENTS) expect(CHEM21_ORDER[s.chem21]).toBeGreaterThanOrEqual(0);
    const dcm = SOLVENTS.find((s) => s.id === "dcm")!;
    expect(hansenDistance(dcm, dcm)).toBe(0);
  });

  it("ranks like with like", () => {
    const top = rankSolvents({ dd: 15.8, dp: 8.8, dh: 19.4 }).slice(0, 3).map((m) => m.solvent.id); // ethanol-like
    expect(top).toContain("ethanol");
    expect(top).not.toContain("hexane");
    const apolar = rankSolvents({ dd: 15.0, dp: 0, dh: 0 })[0]!.solvent.id;
    expect(["hexane", "heptane", "pentane"]).toContain(apolar);
  });

  it("proposes greener substitutes for dichloromethane", () => {
    const alts = greenerAlternatives("dcm");
    expect(alts.length).toBeGreaterThan(5);
    expect(alts.every((m) => m.solvent.chem21 === "recommended" || m.solvent.chem21 === "problematic")).toBe(true);
    expect(alts.some((m) => m.solvent.id === "dcm")).toBe(false);
    for (let i = 1; i < alts.length; i++) expect(alts[i]!.ra).toBeGreaterThanOrEqual(alts[i - 1]!.ra);
    expect(alts.slice(0, 6).map((m) => m.solvent.id)).toContain("ethyl-acetate"); // the textbook DCM replacement
    expect(greenerAlternatives("dcm", "recommended").every((m) => m.solvent.chem21 === "recommended")).toBe(true);
    expect(greenerAlternatives("nope")).toEqual([]);
  });
});
