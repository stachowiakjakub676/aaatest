import { describe, expect, it } from "vitest";
import { FRAGMENTS, getSampleMolecule, molecularFormula, molecularWeight } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import { DERIVATIVE_GENERATOR, createRun, createSpecification, evaluateRun, filterRecords, validateCandidates, verdictReason } from "../src";
import type { CandidateEvaluator, CandidateProfile, ProfileCache, Specification, StructureTools } from "../src";

const ethanol = getSampleMolecule("ethanol")!;
const tools: StructureTools = {
  validate: async () => ({ valid: true, issues: [] }),
  canonicalSmiles: async (m) => molecularFormula(m, { includeImplicitHydrogens: true }),
  hasSubstructure: async () => true,
};

/** Fake evaluator: molecular weight from the model, a "predicted" boiling point that grows with weight. */
function fakeEvaluator(): CandidateEvaluator & { calls: number } {
  const ev = {
    models: ["fake weight model"],
    calls: 0,
    async profile(m: Molecule): Promise<CandidateProfile> {
      ev.calls += 1;
      const mw = molecularWeight(m, { includeImplicitHydrogens: true }).value!;
      if (mw > 200) throw new Error("too heavy for the fake model");
      return { mw: { key: "mw", value: mw, kind: "computed", method: "model", uncertainty: null }, tb: { key: "tb", value: mw * 1.5, kind: "predicted", method: "fake", uncertainty: "±13" } };
    },
  };
  return ev;
}

describe("evaluation stage", () => {
  it("profiles valid candidates once per canonical structure, applies the specification and summarises", async () => {
    const spec: Specification = { ...createSpecification("s"), hard: [{ id: "h1", property: "mw", op: "<=", max: 62 }, { id: "h2", property: "tb", op: "between", min: 80, max: 100 }] };
    const cands = await DERIVATIVE_GENERATOR.generate({ spec, seed: ethanol, limit: 12, fragments: FRAGMENTS, libraries: [], parseSmiles: async () => null }, { ...DERIVATIVE_GENERATOR.defaults, categories: "alkyl" });
    const validated = await validateCandidates(createRun(spec, DERIVATIVE_GENERATOR, {}, ethanol, { app: "t", engine: "fake", models: [] }), cands, tools);
    const ev = fakeEvaluator();
    const cache: ProfileCache = new Map();
    const run = await evaluateRun(validated, ev, cache);
    expect(run.evaluation.evaluated).toBe(validated.summary.valid);
    expect(run.evaluation.passed + run.evaluation.borderline + run.evaluation.failed + run.evaluation.undecided).toBe(run.evaluation.evaluated);
    expect(ev.calls).toBe(validated.summary.valid); // one profile per distinct structure
    expect(run.provenance.models).toContain("fake weight model");
    // Methyl derivative: C3H8O, 60.1 g/mol → mw passes, fake tb 90 → passes.
    const methyl = run.records.find((r) => /Methyl @ C/.test(r.candidate.name) && r.status === "valid")!;
    expect(methyl.evaluation!.overall).toBe("pass");
    expect(verdictReason(methyl)).toBeNull();
    const ethyl = run.records.find((r) => /Ethyl @ C/.test(r.candidate.name) && r.status === "valid")!;
    expect(ethyl.evaluation!.overall).toBe("fail");
    expect(verdictReason(ethyl)).toMatch(/Molecular weight ≤ 62 g\/mol — 74.1 g\/mol is above 62 g\/mol/);
    expect(filterRecords(run.records, "passing").every((r) => r.evaluation?.overall === "pass")).toBe(true);
    expect(filterRecords(run.records, "rejected").every((r) => r.status === "rejected")).toBe(true);
    expect(filterRecords(run.records, "all")).toHaveLength(run.records.length);
    // A second run reuses the cache.
    const again = await evaluateRun(validated, ev, cache);
    expect(again.evaluation.cacheHits).toBe(validated.summary.valid);
    expect(ev.calls).toBe(validated.summary.valid);
  });

  it("keeps an evaluator failure on the record instead of dropping the candidate", async () => {
    const spec: Specification = { ...createSpecification("s"), hard: [{ id: "h1", property: "mw", op: "<=", max: 500 }] };
    const heavy = await DERIVATIVE_GENERATOR.generate({ spec, seed: ethanol, limit: 200, fragments: FRAGMENTS, libraries: [], parseSmiles: async () => null }, DERIVATIVE_GENERATOR.defaults);
    const big = heavy.filter((c) => molecularWeight(c.molecule, { includeImplicitHydrogens: true }).value! > 200).slice(0, 1);
    expect(big).toHaveLength(1);
    const validated = await validateCandidates(createRun(spec, DERIVATIVE_GENERATOR, {}, ethanol, { app: "t", engine: "fake", models: [] }), big, tools);
    const run = await evaluateRun(validated, fakeEvaluator(), new Map());
    const r = run.records[0]!;
    expect(r.evaluationError).toMatch(/too heavy/);
    expect(r.evaluation!.overall).toBe("unknown");
    expect(run.evaluation.undecided).toBe(1);
    expect(verdictReason(r)).toMatch(/no computed value available/);
  });
});
