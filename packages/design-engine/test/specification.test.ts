import { describe, expect, it } from "vitest";
import { createMolecule, getSampleMolecule } from "@molecular-cad/molecule-model";
import { PROPERTY_CATALOGUE, checkConstraint, checkStructural, createHardConstraint, createSoftPreference, createSpecification, describeConstraint, describePreference, describeStructural, evaluateSpecification, hasErrors, parseSpecification, propertyDefinition, serializeSpecification, validateSpecification } from "../src";
import type { CandidateProfile, Specification } from "../src";

const profile: CandidateProfile = {
  mw: { key: "mw", value: 46.07, kind: "computed", method: "RDKit", uncertainty: null },
  tb: { key: "tb", value: 64.4, kind: "predicted", method: "Joback", uncertainty: "≈ 13 K" },
  acidBase: { key: "acidBase", value: "neutral", kind: "predicted", method: "class pKa", uncertainty: null },
};

describe("property catalogue", () => {
  it("has unique keys, provenance and units", () => {
    expect(new Set(PROPERTY_CATALOGUE.map((p) => p.key)).size).toBe(PROPERTY_CATALOGUE.length);
    for (const p of PROPERTY_CATALOGUE) {
      expect(p.method.length).toBeGreaterThan(3);
      expect(["computed", "predicted", "estimated", "experimental", "database"]).toContain(p.kind);
      if (p.kind !== "computed") expect(p.uncertainty, p.key).not.toBeNull();
    }
    expect(propertyDefinition("tb")!.unit).toBe("°C");
    expect(propertyDefinition("acidBase")!.categories).toContain("acidic");
    expect(propertyDefinition("nope")).toBeUndefined();
  });
});

describe("specification validation", () => {
  it("flags incomplete or contradictory constraints and stays quiet on a sound one", () => {
    const spec = createSpecification("Solvent");
    const tb = { ...createHardConstraint("tb"), min: 60, max: 80 };
    const bad = { ...createHardConstraint("mw"), min: 200, max: 100 };
    const missing = { ...createHardConstraint("logS"), op: ">=" as const };
    const cat = { ...createHardConstraint("acidBase"), values: ["neutral", "weird"] };
    const s2: Specification = { ...spec, hard: [tb, bad, missing, cat], soft: [{ ...createSoftPreference("density", "target"), weight: 2 }, createSoftPreference("acidBase")], structural: { ...spec.structural, allowedElements: ["C", "Xx"], minHeavyAtoms: 10, maxHeavyAtoms: 5, requiredSubstructures: ["c1ccccc1"], forbiddenSubstructures: ["c1ccccc1"] } };
    const issues = validateSpecification(s2);
    const messages = issues.map((i) => i.message).join("\n");
    expect(messages).toMatch(/lower bound \(200\) exceeds/);
    expect(messages).toMatch(/enter the lower bound/);
    expect(messages).toMatch(/"weird" is not a known value/);
    expect(messages).toMatch(/enter the target value/);
    expect(messages).toMatch(/weight must be between/);
    expect(messages).toMatch(/categorical and cannot be maximised/);
    expect(messages).toMatch(/Unknown element symbol "Xx"/);
    expect(messages).toMatch(/minimum \(10\) exceeds the maximum \(5\)/);
    expect(messages).toMatch(/both required and forbidden/);
    expect(hasErrors(issues)).toBe(true);
    expect(issues.find((i) => i.path === `hard:${tb.id}`)).toBeUndefined();
    const sound: Specification = { ...spec, hard: [tb] };
    expect(validateSpecification(sound)).toEqual([]);
    expect(validateSpecification(createSpecification("x")).map((i) => i.path)).toEqual(["spec"]);
  });

  it("describes requirements in words", () => {
    expect(describeConstraint({ id: "a", property: "tb", op: "between", min: 60, max: 80 })).toBe("Normal boiling point between 60 and 80 °C");
    expect(describeConstraint({ id: "a", property: "mw", op: "<=", max: 200 })).toBe("Molecular weight ≤ 200 g/mol");
    expect(describeConstraint({ id: "a", property: "acidBase", op: "in", values: ["neutral"] })).toBe("Acid/base character one of: neutral");
    expect(describePreference({ id: "s", property: "logS", direction: "maximize", weight: 0.7 })).toBe("Aqueous solubility, log S: higher is better (weight 0.70)");
    expect(describeStructural({ allowedElements: ["C", "H", "O"], minHeavyAtoms: null, maxHeavyAtoms: 12, neutral: true, requiredSubstructures: ["[OX2H]"], forbiddenSubstructures: [] })).toEqual(["Elements limited to C, H, O", "Heavy atoms any – 12", "Neutral molecule (net charge 0)", "Must contain [OX2H]"]);
  });
});

describe("evaluation", () => {
  it("passes, fails and stays undecided for missing values, carrying provenance", () => {
    const pass = checkConstraint({ id: "1", property: "tb", op: "between", min: 60, max: 80 }, profile);
    expect(pass.status).toBe("pass");
    expect(pass.reason).toMatch(/within the requirement \(predicted: ≈ 13 K\)/);
    const fail = checkConstraint({ id: "2", property: "mw", op: "<=", max: 40 }, profile);
    expect(fail.status).toBe("fail");
    expect(fail.reason).toMatch(/46.1 g\/mol is above 40 g\/mol/);
    expect(checkConstraint({ id: "3", property: "logS", op: ">=", min: -2 }, profile).status).toBe("unknown");
    expect(checkConstraint({ id: "4", property: "acidBase", op: "in", values: ["acidic"] }, profile).status).toBe("fail");
    expect(checkConstraint({ id: "5", property: "acidBase", op: "in", values: ["neutral", "basic"] }, profile).status).toBe("pass");
  });

  it("checks structural rules on the graph and defers substructures to the engine", () => {
    const ethanol = getSampleMolecule("ethanol")!;
    const r = checkStructural({ allowedElements: ["C", "O"], minHeavyAtoms: 2, maxHeavyAtoms: 5, neutral: true, requiredSubstructures: ["[OX2H]"], forbiddenSubstructures: [] }, ethanol);
    expect(r.map((x) => x.status)).toEqual(["pass", "pass", "pass", "unknown"]);
    const cl = checkStructural({ allowedElements: ["C"], minHeavyAtoms: null, maxHeavyAtoms: 2, neutral: false, requiredSubstructures: [], forbiddenSubstructures: [] }, ethanol);
    expect(cl[0]!.status).toBe("fail");
    expect(cl[0]!.reason).toBe("contains O");
    expect(cl[1]!.status).toBe("fail");
    const two = createMolecule({ id: "two", atoms: [{ id: "a", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } }, { id: "b", element: "C", formalCharge: 0, position: { x: 5, y: 0, z: 0 } }], bonds: [] });
    expect(checkStructural({ allowedElements: [], minHeavyAtoms: null, maxHeavyAtoms: null, neutral: false, requiredSubstructures: [], forbiddenSubstructures: [] }, two)[0]!.rule).toBe("Single connected molecule");
  });

  it("combines everything into an overall verdict with counts", () => {
    const spec: Specification = { ...createSpecification("s"), hard: [{ id: "1", property: "tb", op: "between", min: 60, max: 80 }, { id: "2", property: "logS", op: ">=", min: -2 }] };
    const r = evaluateSpecification(spec, profile, getSampleMolecule("ethanol")!);
    expect(r.overall).toBe("unknown");
    expect(r.counts).toEqual({ pass: 1, fail: 0, borderline: 0, unknown: 1 });
    const r2 = evaluateSpecification({ ...spec, hard: [spec.hard[0]!, { id: "3", property: "mw", op: "<=", max: 40 }] }, profile, null);
    expect(r2.overall).toBe("fail");
    expect(evaluateSpecification({ ...spec, hard: [spec.hard[0]!] }, profile, null).overall).toBe("pass");
  });
});

describe("serialization", () => {
  it("round-trips and rejects foreign or malformed files", () => {
    const spec: Specification = { ...createSpecification("Round trip"), hard: [{ id: "h1", property: "tb", op: "between", min: 60, max: 80 }, { id: "h2", property: "acidBase", op: "in", values: ["neutral"] }], soft: [{ id: "s1", property: "logS", direction: "target", target: -1, weight: 0.3 }], structural: { allowedElements: ["C", "H", "O"], minHeavyAtoms: 2, maxHeavyAtoms: 12, neutral: true, requiredSubstructures: ["[OX2H]"], forbiddenSubstructures: ["[N+](=O)[O-]"] } };
    const text = serializeSpecification(spec);
    expect(text).toContain('"kind": "clapeyron-specification"');
    expect(parseSpecification(text)).toEqual(spec);
    expect(parseSpecification("{\"kind\":\"clapeyron-workspace\"}")).toBeNull();
    expect(parseSpecification("not json")).toBeNull();
    expect(() => parseSpecification(JSON.stringify({ kind: "clapeyron-specification", version: 1, specification: { id: "x" } }))).toThrow(/id and a name/);
    expect(() => parseSpecification(JSON.stringify({ kind: "clapeyron-specification", version: 1, specification: { id: "x", name: "y", hard: [{ id: "h", property: "tb", op: "≈" }] } }))).toThrow(/malformed/);
  });
});
