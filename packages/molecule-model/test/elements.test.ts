import { describe, expect, it } from "vitest";
import { DEFAULT_COVALENT_RADIUS, ELEMENTS, allowedValences, covalentRadius, elementColor, getElement, isKnownElement } from "../src";

describe("periodic table", () => {
  it("contains all 118 elements with consecutive atomic numbers and unique symbols", () => {
    expect(ELEMENTS).toHaveLength(118);
    ELEMENTS.forEach((e, i) => expect(e.atomicNumber).toBe(i + 1));
    expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(118);
  });

  it("looks up elements case-sensitively", () => {
    expect(getElement("C")?.name).toBe("Carbon");
    expect(isKnownElement("c")).toBe(false);
    expect(getElement("Og")?.atomicNumber).toBe(118);
  });

  it("has sane weights and radii", () => {
    expect(getElement("H")?.atomicWeight).toBeCloseTo(1.008);
    expect(getElement("C")?.atomicWeight).toBeCloseTo(12.011);
    expect(covalentRadius("C")).toBeCloseTo(0.76);
    expect(covalentRadius("Xx")).toBe(DEFAULT_COVALENT_RADIUS);
    for (const e of ELEMENTS) {
      expect(e.atomicWeight).toBeGreaterThan(0);
      if (e.covalentRadius !== undefined) expect(e.covalentRadius).toBeGreaterThan(0.2);
    }
  });

  it("provides colours for every element and a fallback for unknown symbols", () => {
    expect(elementColor("O")).toBe(0xff0d0d);
    expect(elementColor("??")).toBe(0xff1493);
  });

  it("adjusts allowed valences for formal charge", () => {
    expect(allowedValences("N", 0)).toEqual([3]);
    expect(allowedValences("N", 1)).toEqual([4]);
    expect(allowedValences("O", -1)).toEqual([1]);
    expect(allowedValences("C", 1)).toEqual([3]);
    expect(allowedValences("B", -1)).toEqual([4]);
    expect(allowedValences("H", 1)).toEqual([0]);
    expect(allowedValences("S", 0)).toEqual([2, 4, 6]);
    expect(allowedValences("Fe", 2)).toBeUndefined();
  });
});
