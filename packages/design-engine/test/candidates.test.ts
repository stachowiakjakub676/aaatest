import { describe, expect, it } from "vitest";
import { FRAGMENTS, getSampleMolecule, molecularFormula } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import { DERIVATIVE_GENERATOR, LIBRARY_GENERATOR, checkConstraint, createRun, createSpecification, evaluateSpecification, generatorById, parseRun, serializeRun, structuralRejection, substitutionSites, validateCandidates } from "../src";
import type { CandidateProfile, GenerationInput, Specification, StructureTools } from "../src";

const ethanol = getSampleMolecule("ethanol")!;
const spec = createSpecification("test");

function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return { spec, seed: ethanol, limit: 1000, fragments: FRAGMENTS, libraries: [], parseSmiles: async () => null, ...overrides };
}

/** Engine stand-in: everything sanitises, canonical key = formula + heavy-atom count, substructure by formula text. */
const tools: StructureTools = {
  validate: async (m) => (m.atoms.some((a) => a.element === "Xx") ? { valid: false, issues: ["unknown element"] } : { valid: true, issues: [] }),
  canonicalSmiles: async (m) => molecularFormula(m, { includeImplicitHydrogens: true }),
  hasSubstructure: async (m, smarts) => (smarts === "bad(" ? null : molecularFormula(m, { includeImplicitHydrogens: true }).includes(smarts)),
};

describe("derivative generator", () => {
  it("substitutes every hydrogen-bearing C, N, O with every allowed fragment, deterministically, with provenance", async () => {
    expect(substitutionSites(ethanol)).toHaveLength(3); // CH3, CH2, OH
    const cands = await DERIVATIVE_GENERATOR.generate(input(), DERIVATIVE_GENERATOR.defaults);
    const fragCount = FRAGMENTS.filter((f) => f.category !== "protect").length;
    expect(cands).toHaveLength(3 * fragCount);
    const first = cands[0]!;
    expect(first.origin.generator).toBe("derivatives");
    expect(first.origin.parent?.name).toBe("Ethanol");
    expect(first.origin.operations[0]).toMatch(/^attach Methyl \(C\) at C/);
    expect(molecularFormula(first.molecule, { includeImplicitHydrogens: true })).toBe("C3H8O"); // ethanol + methyl
    const again = await DERIVATIVE_GENERATOR.generate(input(), DERIVATIVE_GENERATOR.defaults);
    expect(again.map((c) => c.name)).toEqual(cands.map((c) => c.name));
    expect(new Set(cands.map((c) => c.id)).size).toBe(cands.length);
  });

  it("respects the limit, the site elements and the allowed elements of the specification", async () => {
    const limited = await DERIVATIVE_GENERATOR.generate(input({ limit: 5 }), DERIVATIVE_GENERATOR.defaults);
    expect(limited).toHaveLength(5);
    const carbonOnly = await DERIVATIVE_GENERATOR.generate(input(), { ...DERIVATIVE_GENERATOR.defaults, sites: "C" });
    expect(carbonOnly.every((c) => /at C/.test(c.origin.operations[0]!))).toBe(true);
    const cho: Specification = { ...spec, structural: { ...spec.structural, allowedElements: ["C", "H", "O"] } };
    const clean = await DERIVATIVE_GENERATOR.generate(input({ spec: cho }), DERIVATIVE_GENERATOR.defaults);
    expect(clean.every((c) => c.molecule.atoms.every((a) => ["C", "H", "O"].includes(a.element)))).toBe(true);
    expect(clean.length).toBeLessThan(FRAGMENTS.length * 3);
    expect(await DERIVATIVE_GENERATOR.generate(input({ seed: null }), DERIVATIVE_GENERATOR.defaults)).toEqual([]);
  });
});

describe("library generator", () => {
  it("turns library entries into candidates through the engine parser and records the entry", async () => {
    const parse = async (smiles: string, name: string): Promise<Molecule | null> => (smiles === "bad" ? null : { ...ethanol, id: `lib-${name}`, name });
    const libs = [
      { name: "solvents", entries: [{ name: "Ethanol", smiles: "CCO" }, { name: "Broken", smiles: "bad" }] },
      { name: "other", entries: [{ name: "X", smiles: "C" }] },
    ];
    const cands = await LIBRARY_GENERATOR.generate(input({ libraries: libs, parseSmiles: parse }), { libraries: "solvents" });
    expect(cands.map((c) => c.name)).toEqual(["Ethanol"]);
    expect(cands[0]!.origin.libraryEntry).toEqual({ library: "solvents", name: "Ethanol", smiles: "CCO" });
    expect(generatorById("library")).toBe(LIBRARY_GENERATOR);
    expect(generatorById("nope")).toBeUndefined();
  });
});

describe("validation stage", () => {
  it("rejects out-of-scope, invalid, duplicate and substructure-violating candidates with stage and reason", async () => {
    const st = { allowedElements: ["C", "H", "O"], minHeavyAtoms: 2, maxHeavyAtoms: 4, neutral: true, requiredSubstructures: ["O"], forbiddenSubstructures: ["C4"] };
    const s: Specification = { ...spec, structural: st };
    const cands = await DERIVATIVE_GENERATOR.generate(input({ spec: s, limit: 40 }), { ...DERIVATIVE_GENERATOR.defaults, categories: "alkyl,halogen,group" });
    const withBad = [...cands, { ...cands[0]!, id: "x", name: "Xx-atom", molecule: { ...cands[0]!.molecule, atoms: [...cands[0]!.molecule.atoms, { id: "zz", element: "Xx", formalCharge: 0, position: { x: 9, y: 9, z: 9 } }] } }];
    const run = await validateCandidates(createRun(s, DERIVATIVE_GENERATOR, DERIVATIVE_GENERATOR.defaults, ethanol, { app: "test", engine: "fake", models: [] }), withBad, tools);
    expect(run.finishedAt).not.toBeNull();
    expect(run.summary.generated).toBe(withBad.length);
    expect(run.summary.rejected + run.summary.valid).toBe(withBad.length);
    const stages = new Set(run.records.filter((r) => r.rejection).map((r) => r.rejection!.stage));
    expect(stages.has("structural")).toBe(true); // > 4 heavy atoms or forbidden elements
    expect(stages.has("duplicate")).toBe(true); // methyl at C1 and methyl at C2 share a formula key here
    expect(run.records.find((r) => r.candidate.name === "Xx-atom")!.rejection!.stage).toMatch(/structural|graph|engine/);
    const valid = run.records.filter((r) => r.status === "valid");
    expect(valid.length).toBeGreaterThan(0);
    for (const r of valid) expect(r.canonicalSmiles).toMatch(/O/);
    expect(structuralRejection(st, ethanol)).toBeNull();
    expect(structuralRejection({ ...st, minHeavyAtoms: 5 }, ethanol)).toMatch(/fewer than 5/);
  });

  it("reports unparsable patterns instead of silently passing", async () => {
    const s: Specification = { ...spec, structural: { ...spec.structural, requiredSubstructures: ["bad("] } };
    const run = await validateCandidates(createRun(s, DERIVATIVE_GENERATOR, {}, ethanol, { app: "t", engine: "fake", models: [] }), await DERIVATIVE_GENERATOR.generate(input({ spec: s, limit: 1 }), DERIVATIVE_GENERATOR.defaults), tools);
    expect(run.records).toHaveLength(1);
    expect(run.records.every((r) => r.rejection?.stage === "substructure" && /does not parse/.test(r.rejection.reason))).toBe(true);
    const text = serializeRun(run);
    expect(parseRun(text)!.id).toBe(run.id);
    expect(parseRun("{}")).toBeNull();
  });
});

describe("margin-aware evaluation", () => {
  const profile: CandidateProfile = { tb: { key: "tb", value: 85, kind: "predicted", method: "Joback", uncertainty: "≈ 13 K" }, mw: { key: "mw", value: 46, kind: "computed", method: "RDKit", uncertainty: null } };
  it("softens a miss smaller than the model error to borderline, but not a clear miss or a computed value", () => {
    const near = checkConstraint({ id: "1", property: "tb", op: "between", min: 60, max: 80 }, profile);
    expect(near.status).toBe("borderline");
    expect(near.reason).toMatch(/by 5 °C, less than the model's typical error \(13 °C\)/);
    expect(checkConstraint({ id: "1", property: "tb", op: "between", min: 60, max: 80 }, profile, { margins: false }).status).toBe("fail");
    expect(checkConstraint({ id: "2", property: "tb", op: "<=", max: 50 }, profile).status).toBe("fail");
    expect(checkConstraint({ id: "3", property: "mw", op: "<=", max: 45 }, profile).status).toBe("fail"); // no error for a computed weight
    const r = evaluateSpecification({ ...spec, hard: [{ id: "1", property: "tb", op: "between", min: 60, max: 80 }] }, profile, null);
    expect(r.overall).toBe("borderline");
    expect(r.counts.borderline).toBe(1);
  });
});
