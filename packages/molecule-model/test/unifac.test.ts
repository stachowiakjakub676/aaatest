import { describe, expect, it } from "vitest";
import { UNIFAC_INTERACTIONS, UNIFAC_SUBGROUPS, describeUnifacGroups, unifacCoverage, unifacGammas } from "../src";

interface Fixture {
  thermo: string;
  gammas: Array<{ name: string; groups: Array<Record<string, number>>; T: number; xs: number[]; gammas: number[] }>;
}
import fixtureJson from "./fixtures/unifac.json";
const fixture = fixtureJson as unknown as Fixture;
const toGroups = (g: Record<string, number>) => Object.fromEntries(Object.entries(g).map(([k, v]) => [Number(k), v]));

describe("UNIFAC activity coefficients", () => {
  it("reproduces the textbook examples", () => {
    // Poling, Prausnitz & O'Connell ex. 8-12: acetone(1)/n-pentane(2), 307 K, x1 = 0.047 → γ1 = 4.99, γ2 = 1.005.
    const [g1, g2] = unifacGammas([{ 1: 1, 18: 1 }, { 1: 2, 2: 3 }], [0.047, 0.953], 307)!;
    expect(g1).toBeCloseTo(4.99, 2);
    expect(g2).toBeCloseTo(1.005, 3);
    // Smith, Van Ness & Abbott app. H: diethylamine(1)/n-heptane(2), 308.15 K, x1 = 0.4 → γ1 = 1.133, γ2 = 1.047.
    const [d1, d2] = unifacGammas([{ 1: 2, 2: 1, 32: 1 }, { 1: 2, 2: 5 }], [0.4, 0.6], 308.15)!;
    expect(d1).toBeCloseTo(1.133, 3);
    expect(d2).toBeCloseTo(1.047, 3);
  });

  it(`matches the reference implementation (thermo ${fixture.thermo}) on every fixture case`, () => {
    for (const c of fixture.gammas) {
      const g = unifacGammas(c.groups.map(toGroups), c.xs, c.T);
      expect(g, c.name).not.toBeNull();
      g!.forEach((v, i) => expect(Math.abs(v / c.gammas[i]! - 1), `${c.name} γ${i + 1}`).toBeLessThan(1e-6));
    }
  });

  it("handles infinite dilution and pure components", () => {
    const [g1, g2] = unifacGammas([{ 1: 1, 2: 1, 14: 1 }, { 16: 1 }], [0, 1], 351)!; // ethanol infinitely dilute in water
    expect(g1).toBeGreaterThan(3);
    expect(g2).toBeCloseTo(1, 6);
    const [p1] = unifacGammas([{ 1: 1, 2: 1, 14: 1 }, { 16: 1 }], [1, 0], 351)!;
    expect(p1).toBeCloseTo(1, 6);
  });

  it("refuses unknown subgroups and missing interaction parameters instead of guessing", () => {
    expect(unifacGammas([{ 999: 1 }, { 16: 1 }], [0.5, 0.5], 300)).toBeNull();
    const cov = unifacCoverage([{ 999: 1 }]);
    expect(cov.ok).toBe(false);
    expect(cov.unknown).toEqual([999]);
    // Some main-group pairs have no published parameter (e.g. CS2 with many groups).
    const pairs = Object.keys(UNIFAC_INTERACTIONS).length;
    expect(pairs).toBeGreaterThan(1000);
    expect(Object.keys(UNIFAC_SUBGROUPS).length).toBeGreaterThan(100);
    expect(describeUnifacGroups({ 1: 1, 2: 1, 14: 1 })).toBe("CH3 ×1, CH2 ×1, OH ×1");
  });
});
