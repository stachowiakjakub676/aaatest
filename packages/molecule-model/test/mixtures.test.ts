import { describe, expect, it } from "vitest";
import { acentricFactor, assessCrystallisation, assessDistillation, bubblePoint, fenskeMinimumStages, idealSolubility, knownAzeotrope, nonIdealityFromHansen, relativeVolatility, solubilityMoleFraction, solubilityToGrams, txyDiagram } from "../src";
import type { PureComponent } from "../src";

// Measured constants (Poling et al., appendix A; Hansen 2007) so the mixture rules are tested on their own.
const benzene: PureComponent = { name: "benzene", molarMass: 78.11, tb: 353.24, tc: 562.05, pc: 48.95, omega: acentricFactor(353.24, 562.05, 48.95), hvapTb: 30.72, tm: 278.7, hfus: 9.87, hansen: { dd: 18.4, dp: 0, dh: 2.0 }, provenance: "measured" };
const toluene: PureComponent = { name: "toluene", molarMass: 92.14, tb: 383.78, tc: 591.75, pc: 41.08, omega: acentricFactor(383.78, 591.75, 41.08), hvapTb: 33.18, tm: 178.2, hfus: 6.64, hansen: { dd: 18.0, dp: 1.4, dh: 2.0 }, provenance: "measured" };
const water: PureComponent = { name: "water", molarMass: 18.015, tb: 373.15, tc: 647.1, pc: 220.64, omega: acentricFactor(373.15, 647.1, 220.64), // ω anchored at Tb: Lee–Kesler with the true ω (0.344) is 9 % low at 100 °C for water
  hvapTb: 40.66, tm: 273.15, hfus: 6.01, hansen: { dd: 15.5, dp: 16.0, dh: 42.3 }, provenance: "measured" };
const ethanol: PureComponent = { name: "ethanol", molarMass: 46.07, tb: 351.44, tc: 513.92, pc: 61.48, omega: acentricFactor(351.44, 513.92, 61.48), hvapTb: 38.56, tm: 159.0, hfus: 4.93, hansen: { dd: 15.8, dp: 8.8, dh: 19.4 }, provenance: "measured" };
const naphthalene: PureComponent = { name: "naphthalene", molarMass: 128.17, tb: 491.1, tc: 748.4, pc: 40.5, omega: 0.302, hvapTb: 43.2, tm: 353.4, hfus: 19.1, hansen: { dd: 19.2, dp: 2.0, dh: 5.9 }, provenance: "measured" };

describe("ideal vapour–liquid equilibrium (Raoult)", () => {
  it("benzene–toluene: textbook bubble point and relative volatility", () => {
    const b = bubblePoint(benzene, toluene, 0.5)!;
    expect(b.T - 273.15).toBeCloseTo(92, 0); // measured ≈ 92 °C at x = 0.5
    expect(b.y1).toBeGreaterThan(0.7); // vapour enriched in benzene (≈ 0.71–0.72)
    expect(b.y1).toBeLessThan(0.75);
    expect(relativeVolatility(benzene, toluene, 365)!).toBeGreaterThan(2.2);
    expect(relativeVolatility(benzene, toluene, 365)!).toBeLessThan(2.7);
    expect(bubblePoint(benzene, toluene, 0)!.T).toBeCloseTo(toluene.tb, 2);
    expect(bubblePoint(benzene, toluene, 1)!.T).toBeCloseTo(benzene.tb, 2);
  });

  it("T–x–y is monotonic and the vapour is always richer in the light component", () => {
    const pts = txyDiagram(benzene, toluene);
    expect(pts).toHaveLength(41);
    for (let i = 1; i < pts.length; i++) expect(pts[i]!.T).toBeLessThan(pts[i - 1]!.T);
    for (const p of pts.slice(1, -1)) expect(p.y1).toBeGreaterThan(p.x1);
    expect(fenskeMinimumStages(2.4)!).toBeCloseTo(10.5, 0);
    expect(fenskeMinimumStages(1)).toBeNull();
  });

  it("assesses separations and orders the components by volatility", () => {
    const bt = assessDistillation(toluene, benzene)!; // heavy first on purpose
    expect(bt.lightIndex).toBe(2);
    expect(bt.light.name).toBe("benzene");
    expect(bt.verdict).toBe("normal");
    expect(bt.dTb).toBeCloseTo(30.5, 0);
    expect(bt.nonIdeality.level).toBe("near-ideal");
    expect(Math.ceil(bt.nmin!)).toBeGreaterThanOrEqual(9);
    const ew = assessDistillation(ethanol, water)!;
    expect(ew.light.name).toBe("ethanol");
    expect(ew.nonIdeality.level).toBe("strong"); // the ideal picture is wrong here: known azeotrope
    expect(ew.nonIdeality.text).toMatch(/azeotrope/);
    expect(knownAzeotrope("water", "ethanol")!.t).toBe(78.2);
    expect(knownAzeotrope("benzene", "toluene")).toBeNull();
  });

  it("flags near-identical boiling points as impractical", () => {
    const twin = { ...toluene, name: "twin", tb: toluene.tb + 1.5, omega: acentricFactor(toluene.tb + 1.5, toluene.tc, toluene.pc) };
    const a = assessDistillation(toluene, twin)!;
    expect(a.verdict).toBe("impractical");
    expect(a.alphaMean).toBeLessThan(1.1);
    expect(nonIdealityFromHansen(toluene, { ...twin, hansen: null }).ra).toBeNull();
  });
});

describe("ideal solubility and cooling crystallisation", () => {
  it("naphthalene: the classic textbook value x ≈ 0.30 at 25 °C", () => {
    expect(idealSolubility(19.1, 353.4, 298.15)).toBeCloseTo(0.30, 1); // measured in benzene 0.296
    expect(idealSolubility(19.1, 353.4, 353.4)).toBe(1);
    expect(idealSolubility(19.1, 353.4, 400)).toBe(1);
    expect(solubilityToGrams(0.3, 128.17, 92.14)).toBeCloseTo(59.6, 0);
    expect(solubilityToGrams(1, 128.17, 92.14)).toBe(Infinity);
  });

  it("naphthalene in toluene, 25 → 0 °C: about 60 % of the dissolved solid crystallises", () => {
    const c = assessCrystallisation(naphthalene, toluene, 298.15, 273.15)!;
    expect(c.sHot).toBeCloseTo(59.6, 0);
    expect(c.sCold).toBeCloseTo(24.2, 0);
    expect(c.recovery).toBeGreaterThan(0.55);
    expect(c.recovery).toBeLessThan(0.65);
    expect(c.solventPerGram).toBeCloseTo(100 / 59.6, 1);
    expect(c.nonIdeality.level).toBe("near-ideal");
    const w = assessCrystallisation(naphthalene, water, 298.15, 273.15)!;
    expect(w.nonIdeality.level).toBe("strong");
    expect(w.notes.some((n) => /anti-solvent|upper bound/.test(n))).toBe(true);
  });

  it("refuses when the solute would be molten or the data are missing", () => {
    expect(assessCrystallisation(naphthalene, toluene, 360, 273.15)!.recovery).toBe(0);
    expect(assessCrystallisation({ ...naphthalene, tm: null }, toluene, 298.15, 273.15)).toBeNull();
    expect(assessCrystallisation(naphthalene, toluene, 273.15, 298.15)).toBeNull();
  });
});

describe("with UNIFAC activity coefficients", () => {
  const u = (c: PureComponent, unifac: Record<number, number>): PureComponent => ({ ...c, unifac });
  const ethanolU = u(ethanol, { 1: 1, 2: 1, 14: 1 });
  const waterU = u(water, { 16: 1 });
  const benzeneU = u(benzene, { 9: 6 });
  const tolueneU = u(toluene, { 9: 5, 11: 1 });
  const naphthaleneU = u(naphthalene, { 9: 8, 10: 2 });

  it("predicts the ethanol–water minimum-boiling azeotrope near 78 °C and x ≈ 0.9", () => {
    const a = assessDistillation(ethanolU, waterU)!;
    expect(a.activityModel.kind).toBe("UNIFAC");
    expect(a.verdict).toBe("azeotropic");
    expect(a.azeotrope).not.toBeNull();
    expect(a.azeotrope!.kind).toBe("minimum-boiling");
    expect(a.azeotrope!.x1).toBeGreaterThan(0.8);
    expect(a.azeotrope!.x1).toBeLessThan(0.98);
    expect(Math.abs(a.azeotrope!.T - 351.3)).toBeLessThan(4); // measured 78.2 °C
    expect(a.nmin).toBeNull();
    expect(a.notes.some((n) => /azeotrope predicted/.test(n))).toBe(true);
    // Dilute ethanol is far more volatile than Raoult says (γ∞ ≈ 4–6).
    expect(a.alphaLow).toBeGreaterThan(5);
  });

  it("leaves benzene–toluene nearly ideal and without an azeotrope", () => {
    const a = assessDistillation(benzeneU, tolueneU)!;
    expect(a.activityModel.kind).toBe("UNIFAC");
    expect(a.azeotrope).toBeNull();
    expect(a.verdict).toBe("normal");
    expect(a.alphaMean).toBeGreaterThan(2.2);
    expect(a.alphaMean).toBeLessThan(2.7);
  });

  it("falls back to the ideal model with a reason when a component has no groups", () => {
    const a = assessDistillation(ethanolU, water)!;
    expect(a.activityModel).toEqual({ kind: "ideal", reason: "water could not be split into UNIFAC groups" });
    expect(a.azeotrope).toBeNull();
  });

  it("naphthalene: nearly ideal in toluene, practically insoluble in water", () => {
    const xTol = solubilityMoleFraction(naphthaleneU, tolueneU, 298.15)!;
    expect(xTol).toBeGreaterThan(0.22); // measured 0.296 in benzene/toluene; UNIFAC gives a modest γ
    expect(xTol).toBeLessThan(0.32);
    const xWater = solubilityMoleFraction(naphthaleneU, waterU, 298.15)!;
    expect(xWater).toBeLessThan(1e-4); // measured ≈ 4e-6
    const c = assessCrystallisation(naphthaleneU, waterU, 298.15, 273.15)!;
    expect(c.activityModel.kind).toBe("UNIFAC");
    expect(c.gammaHot).toBeGreaterThan(1000);
    expect(c.notes.some((n) => /anti-solvent/.test(n))).toBe(true);
  });
});
