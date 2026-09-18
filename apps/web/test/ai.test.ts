import { describe, expect, it } from "vitest";
import { createMolecule, getSampleMolecule, molecularFormula, validateMolecule } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import { RULE_ANALYSIS, ruleSuggestions } from "../src/ai/analysis";
import { applySuggestion, validateOperation, validateSuggestion } from "../src/ai/suggestions";
import { RemoteExplanationService, TemplateExplanationService, renderTemplate } from "../src/ai/explanation";
import type { AnalysisInput } from "../src/ai/types";
import { EXPLANATION_DISCLAIMER } from "../src/ai/types";
import type { ComputedProperties } from "../src/chemistry/engine";
import { MockRetrosynthesisService, splitAtBond } from "../src/retro/mockRetrosynthesis";
import { PROVENANCE_POLICY, applySafetyDecision, validateReactionRecord } from "../src/retro/types";
import type { DisconnectionCandidate, ReactionRecord } from "../src/retro/types";
import { CommandError } from "../src/editor/commands";

const sample = (id: string) => getSampleMolecule(id)!;
const props: ComputedProperties = {
  kind: "computed",
  source: "rdkit-wasm test",
  canonicalSmiles: "CC(=O)Oc1ccccc1C(=O)O",
  inchiKey: "BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
  molecularWeight: 180.159,
  descriptors: {
    tpsa: { label: "TPSA", unit: "Å²", value: 63.6 },
    cLogP: { label: "cLogP", unit: "", value: 1.31 },
    hBondDonors: { label: "HBD", unit: "", value: 1 },
    hBondAcceptors: { label: "HBA", unit: "", value: 4 },
    rotatableBonds: { label: "Rot", unit: "", value: 3 },
  },
};
const input = (molecule: Molecule, withProps = true): AnalysisInput => ({ molecule, validation: validateMolecule(molecule), engineValidation: { valid: true, issues: [] }, properties: withProps ? props : null });

describe("MoleculeAnalysisService (deterministic)", () => {
  it("builds a structured report with rule checks and no predictions", () => {
    const r = RULE_ANALYSIS.analyze(input(sample("aspirin")));
    expect(r.kind).toBe("computed");
    expect(r.molecule.formulaExplicit).toBe("C9H8O4");
    expect(r.molecule.heavyAtomCount).toBe(13);
    expect(r.molecule.ringCount).toBe(1);
    expect(r.molecule.functionalGroups).toEqual(expect.arrayContaining(["Ester", "Carboxylic acid", "Aromatic six-membered ring"]));
    expect(r.ruleChecks.map((c) => c.passed)).toEqual(Array(8).fill(true));
    expect(r.engine?.canonicalSmiles).toBe(props.canonicalSmiles);
    expect(JSON.stringify(r)).not.toMatch(/predict/i);
    // Deterministic: same input, same report.
    expect(RULE_ANALYSIS.analyze(input(sample("aspirin")))).toEqual(r);
  });

  it("suggests hydrogens for heavy-atom sketches and a tidy for strained geometry", () => {
    const heavy = createMolecule({
      id: "h",
      atoms: [
        { id: "c1", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } },
        { id: "c2", element: "C", formalCharge: 0, position: { x: 0.9, y: 0, z: 0 } }, // far too short a bond
        { id: "o", element: "O", formalCharge: 0, position: { x: 3.5, y: 0, z: 0 } },
      ],
      bonds: [
        { id: "b1", atomA: "c1", atomB: "c2", order: "single" },
        { id: "b2", atomA: "c2", atomB: "o", order: "single" },
      ],
    });
    const ids = ruleSuggestions(heavy, input(heavy, false)).map((s) => s.id);
    expect(ids).toEqual(["add-hydrogens", "tidy"]);
    expect(ruleSuggestions(sample("aspirin"), input(sample("aspirin"))).map((s) => s.id)).toEqual([]);
  });

  it("suggests removing a hydrogen from an over-valent carbon", () => {
    const bad = createMolecule({
      id: "bad",
      atoms: [{ id: "c", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } }, ...[1, 2, 3, 4, 5].map((i) => ({ id: `h${i}`, element: "H", formalCharge: 0, position: { x: Math.cos(i), y: Math.sin(i), z: i / 5 } }))],
      bonds: [1, 2, 3, 4, 5].map((i) => ({ id: `b${i}`, atomA: "c", atomB: `h${i}`, order: "single" as const })),
    });
    const s = ruleSuggestions(bad, input(bad, false));
    expect(s[0]?.id).toBe("fix-valence-c");
    const applied = applySuggestion(bad, s[0]!);
    expect(validateMolecule(applied.molecule).valid).toBe(true);
    expect(applied.label).toMatch(/Apply suggestion/);
  });
});

describe("suggestion validation and application", () => {
  const mol = sample("ethanol");
  it("accepts only operations from the closed set with existing ids", () => {
    expect(validateOperation(mol, { op: "setElement", atomId: mol.atoms[0]!.id, element: "N" }).ok).toBe(true);
    expect(validateOperation(mol, { op: "setElement", atomId: "ghost", element: "N" }).ok).toBe(false);
    expect(validateOperation(mol, { op: "setElement", atomId: mol.atoms[0]!.id, element: "Xx" }).ok).toBe(false);
    expect(validateOperation(mol, { op: "deleteEverything" }).ok).toBe(false);
    expect(validateOperation(mol, { op: "setCharge", atomId: mol.atoms[0]!.id, charge: 9 }).ok).toBe(false);
    expect(validateOperation(mol, { op: "setBondOrder", bondId: mol.bonds[0]!.id, order: "quadruple" }).ok).toBe(false);
    expect(validateOperation(mol, { op: "tidy" }).ok).toBe(true);
    expect(validateOperation(mol, "nope").ok).toBe(false);
  });

  it("rejects a suggestion entirely if any step is invalid", () => {
    const good = validateSuggestion(mol, { title: "Swap O for S", operations: [{ op: "setElement", atomId: mol.atoms[0]!.id, element: "S" }] }, "llm", 0);
    expect(good?.source).toBe("llm");
    expect(validateSuggestion(mol, { title: "Mixed", operations: [{ op: "tidy" }, { op: "removeAtom", atomId: "ghost" }] }, "llm", 1)).toBeNull();
    expect(validateSuggestion(mol, { title: "", operations: [{ op: "tidy" }] }, "llm", 2)).toBeNull();
    expect(validateSuggestion(mol, { title: "No ops", operations: [] }, "llm", 3)).toBeNull();
  });

  it("applies multi-step suggestions as one command and fails cleanly when stale", () => {
    const o = mol.atoms.find((a) => a.element === "O")!;
    const s = validateSuggestion(mol, { title: "Thiol", rationale: "demo", operations: [{ op: "setElement", atomId: o.id, element: "S" }, { op: "tidy" }] }, "llm", 0)!;
    const r = applySuggestion(mol, s);
    expect(molecularFormula(r.molecule)).toBe("C2H6S");
    expect(r.tidy).toBe(true);
    const stale = { ...s, operations: [{ op: "removeAtom" as const, atomId: "gone" }] };
    expect(() => applySuggestion(mol, stale)).toThrow(CommandError);
  });
});

describe("ExplanationService", () => {
  it("renders deterministic template prose that labels computed values", async () => {
    const report = RULE_ANALYSIS.analyze(input(sample("aspirin")));
    const e = await new TemplateExplanationService().explain(report);
    expect(e.text).toContain("Aspirin has 21 atoms (13 heavy)");
    expect(e.text).toContain("Lipinski");
    expect(e.text).toContain("computed not measured");
    expect(e.disclaimer).toBe(EXPLANATION_DISCLAIMER);
    expect(e.suggestions).toEqual([]);
    expect(renderTemplate(RULE_ANALYSIS.analyze(input(createMolecule({ id: "e" }), false)))).toMatch(/empty/);
  });

  it("validates suggestions coming back from the server", async () => {
    const mol = sample("ethanol");
    const o = mol.atoms.find((a) => a.element === "O")!;
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          text: "Ethanol is a small alcohol.",
          model: "claude-opus-5",
          suggestions: [
            { title: "Make the thiol analogue", rationale: "for comparison", operations: [{ op: "setElement", atomId: o.id, element: "S" }] },
            { title: "Do something impossible", operations: [{ op: "removeAtom", atomId: "nope" }] },
            { title: "Injected", operations: [{ op: "runShell", cmd: "rm -rf" }] },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;
    const svc = new RemoteExplanationService("http://localhost:8000", () => mol, fetchImpl);
    const e = await svc.explain(RULE_ANALYSIS.analyze(input(mol, false)));
    expect(e.source).toBe("claude-opus-5 via server");
    expect(e.suggestions).toHaveLength(1);
    expect(e.suggestions[0]!.source).toBe("llm");
    const down = new RemoteExplanationService("http://localhost:1", () => mol, (async () => new Response(JSON.stringify({ detail: "no provider configured" }), { status: 503 })) as unknown as typeof fetch);
    await expect(down.explain(RULE_ANALYSIS.analyze(input(mol, false)))).rejects.toThrow(/no provider/);
  });
});

describe("MockRetrosynthesisService", () => {
  const svc = new MockRetrosynthesisService(null);

  it("splits a molecule at a bond into H-capped fragments", () => {
    const asp = sample("aspirin");
    const ester = asp.bonds.find((b) => {
      const a = asp.atoms.find((x) => x.id === b.atomA)!;
      const c = asp.atoms.find((x) => x.id === b.atomB)!;
      return b.order === "single" && ((a.element === "C" && c.element === "O") || (a.element === "O" && c.element === "C"));
    })!;
    const pieces = splitAtBond(asp, ester.id);
    expect(pieces).toHaveLength(2);
    expect(pieces.reduce((s, p) => s + p.atoms.length, 0)).toBe(asp.atoms.length + 2);
    for (const p of pieces) expect(validateMolecule(p).valid).toBe(true);
  });

  it("analyses the target and produces ranked, policy-screened conceptual candidates", async () => {
    const asp = sample("aspirin");
    const analysis = await svc.analyzeTarget(asp);
    expect(analysis.functionalGroups.map((g) => g.id)).toContain("ester");
    expect(analysis.ringCount).toBe(1);
    const candidates = await svc.generateCandidates(asp, analysis);
    expect(candidates.length).toBeGreaterThan(0);
    const ranked = await svc.rankCandidates(candidates);
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[0]!.strategy).toMatch(/Ester/);
    expect(ranked.map((c) => c.rank)).toEqual(ranked.map((_, i) => i + 1));
    for (const c of ranked) {
      expect(c.fragments).toHaveLength(2);
      expect(c.reaction).toBeUndefined(); // the mock has no knowledge base and never invents reaction data
      expect(c.rationale.join(" ")).toMatch(/fixed heuristic/);
    }
    expect(analysis.screening.permitted).toBe(true);
    expect(analysis.screening.screener).toBe("no screener configured");
  });

  it("never disconnects ring bonds or bonds to hydrogen", async () => {
    const bz = sample("benzene");
    const analysis = await svc.analyzeTarget(bz);
    expect(analysis.disconnectableBondCount).toBe(0);
    expect(await svc.generateCandidates(bz, analysis)).toEqual([]);
    expect(analysis.notes.join(" ")).toMatch(/Ring bonds/);
  });

  it("provenance policy shows user/literature data, withholds unreviewed model data and screened targets", () => {
    const base: DisconnectionCandidate = { id: "x", bondId: "b", strategy: "s", description: "d", fragments: [], score: 1, rank: 1, rationale: [] };
    const record = (provenance: ReactionRecord["provenance"], reviewed = false): ReactionRecord => ({ reagents: [{ role: "reagent", name: "example" }], conditions: { temperature: { value: 25, unit: "C" } }, yield: { value: 80, unit: "%", type: "reported" }, procedure: "step text", provenance, reviewed });
    const ok = { permitted: true, screener: "test" };
    const user = { ...base, reaction: record({ source: "user" }) };
    expect(PROVENANCE_POLICY.screen(user, ok)).toEqual({ allowed: true, redactReaction: false });
    const lit = { ...base, reaction: record({ source: "literature", citation: "J. Example 2020" }) };
    expect(PROVENANCE_POLICY.screen(lit, ok).redactReaction).toBe(false);
    const model = { ...base, reaction: record({ source: "model", model: "m" }) };
    const d = PROVENANCE_POLICY.screen(model, ok);
    expect(d.redactReaction).toBe(true);
    expect(applySafetyDecision(model, d).reaction).toBeUndefined();
    expect(applySafetyDecision(model, d).rationale.join(" ")).toMatch(/reviewed/);
    expect(PROVENANCE_POLICY.screen({ ...base, reaction: record({ source: "model", model: "m" }, true) }, ok).redactReaction).toBe(false);
    const blocked = PROVENANCE_POLICY.screen(user, { permitted: false, screener: "policy list" });
    expect(blocked.redactReaction).toBe(true);
    expect(applySafetyDecision(user, blocked).reaction).toBeUndefined();
    expect(PROVENANCE_POLICY.screen(base, { permitted: false, screener: "policy list" }).redactReaction).toBe(false);
  });

  it("validates reaction records from user input or imports", () => {
    const good = validateReactionRecord({ provenance: { source: "user" }, reagents: [{ role: "solvent", name: "water" }], conditions: { time: { value: 2, unit: "h" } }, yield: { value: 55, unit: "%", type: "isolated" }, procedure: "notes" });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.record.reviewed).toBe(false);
      expect(JSON.parse(JSON.stringify(good.record))).toEqual(good.record);
    }
    expect(validateReactionRecord({ reagents: [], procedure: "" }).ok).toBe(false);
    expect(validateReactionRecord({ provenance: { source: "literature" }, reagents: [], procedure: "" }).ok).toBe(false);
    expect(validateReactionRecord({ provenance: { source: "user" }, reagents: [{ role: "wizard", name: "x" }], procedure: "" }).ok).toBe(false);
    expect(validateReactionRecord({ provenance: { source: "user" }, reagents: [], yield: { value: 150, unit: "%", type: "isolated" }, procedure: "" }).ok).toBe(false);
    expect(validateReactionRecord({ provenance: { source: "alien" }, reagents: [], procedure: "" }).ok).toBe(false);
  });
});
