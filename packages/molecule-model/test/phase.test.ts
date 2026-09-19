import { describe, expect, it } from "vitest";
import { acentricFactor, boilingPointAtPressure, phaseAt, phaseModel, vapourPressure, watsonHvap } from "../src";

// Experimental constants (Poling et al., appendix A) so the correlations are tested on their own.
const hexane = { tb: 341.88, tc: 507.6, pc: 30.25, hvapTb: 28.85 };
const benzene = { tb: 353.24, tc: 562.05, pc: 48.95, hvapTb: 30.72 };

describe("Lee–Kesler vapour pressure", () => {
  it("recovers the acentric factor from Tb, Tc and pc", () => {
    expect(acentricFactor(hexane.tb, hexane.tc, hexane.pc)).toBeCloseTo(0.301, 1); // literature 0.301
    expect(acentricFactor(benzene.tb, benzene.tc, benzene.pc)).toBeCloseTo(0.210, 1); // literature 0.210
  });

  it("reproduces vapour pressures at 25 °C within a few percent", () => {
    const wh = acentricFactor(hexane.tb, hexane.tc, hexane.pc);
    expect(vapourPressure(298.15, hexane.tc, hexane.pc, wh)!).toBeCloseTo(0.202, 1); // 20.2 kPa measured
    const wb = acentricFactor(benzene.tb, benzene.tc, benzene.pc);
    expect(vapourPressure(298.15, benzene.tc, benzene.pc, wb)! * 100).toBeCloseTo(12.7, 0); // 12.7 kPa measured
    expect(vapourPressure(hexane.tc, hexane.tc, hexane.pc, wh)).toBeNull();
  });

  it("inverts to the boiling point at any pressure below pc", () => {
    const w = acentricFactor(hexane.tb, hexane.tc, hexane.pc);
    expect(boilingPointAtPressure(1.01325, hexane.tc, hexane.pc, w)!).toBeCloseTo(hexane.tb, 3);
    const t20 = boilingPointAtPressure(0.02, hexane.tc, hexane.pc, w)!; // rotary evaporator, 20 mbar
    expect(t20).toBeLessThan(hexane.tb);
    expect(t20).toBeGreaterThan(220);
    expect(t20).toBeLessThan(260); // Antoine: ≈ 254 K (−19 °C) at 20 mbar
    expect(boilingPointAtPressure(40, hexane.tc, hexane.pc, w)).toBeNull();
  });

  it("scales the enthalpy of vaporisation with Watson's rule", () => {
    expect(watsonHvap(298.15, hexane.tb, hexane.tc, hexane.hvapTb)!).toBeCloseTo(31.5, 0); // 31.56 measured
    expect(watsonHvap(hexane.tb, hexane.tb, hexane.tc, hexane.hvapTb)!).toBeCloseTo(hexane.hvapTb, 6);
    expect(watsonHvap(hexane.tc, hexane.tb, hexane.tc, hexane.hvapTb)).toBe(0);
  });
});

describe("phase diagram", () => {
  const input = { ...hexane, tm: 177.8, hfus: 13.08, molarVolume: 131.6 };
  const model = phaseModel(input);

  it("places the triple point on the vapour curve and the boundaries in order", () => {
    expect(model.triple!.T).toBe(177.8);
    expect(model.triple!.p).toBeLessThan(1e-4);
    expect(model.hsub!).toBeCloseTo(13.08 + watsonHvap(177.8, hexane.tb, hexane.tc, hexane.hvapTb)!, 6);
    expect(model.vapour[0]!.T).toBe(177.8);
    expect(model.vapour[model.vapour.length - 1]).toEqual({ T: hexane.tc, p: hexane.pc });
    for (let i = 1; i < model.vapour.length; i++) expect(model.vapour[i]!.p).toBeGreaterThan(model.vapour[i - 1]!.p);
    expect(model.sublimation[model.sublimation.length - 1]!.p).toBeCloseTo(model.triple!.p, 10);
    expect(model.sublimation[0]!.p).toBeLessThan(model.triple!.p);
    expect(model.meltingSlope!).toBeGreaterThan(0);
    expect(model.meltingSlope!).toBeLessThan(0.1); // a few hundredths of a kelvin per bar
    expect(model.melting[0]!.T).toBe(177.8);
  });

  it("classifies conditions", () => {
    expect(phaseAt(model, input, 298.15, 1.01325)).toBe("liquid");
    expect(phaseAt(model, input, 400, 1.01325)).toBe("gas");
    expect(phaseAt(model, input, 150, 1.01325)).toBe("solid");
    expect(phaseAt(model, input, 150, 1e-12)).toBe("gas");
    expect(phaseAt(model, input, 600, 100)).toBe("supercritical fluid");
    expect(phaseAt(model, input, 600, 1)).toBe("gas");
  });

  it("degrades honestly without a melting point", () => {
    const m = phaseModel(hexane);
    expect(m.triple).toBeNull();
    expect(m.sublimation).toEqual([]);
    expect(m.notes.some((n) => /solid region is not drawn/.test(n))).toBe(true);
    expect(phaseAt(m, hexane, 100, 1)).toBe("liquid");
  });
});
