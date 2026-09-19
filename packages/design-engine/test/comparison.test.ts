import { describe, expect, it } from "vitest";
import { getSampleMolecule } from "@molecular-cad/molecule-model";
import { buildComparison, comparisonToCsv, createSpecification, rankRecords } from "../src";
import type { CandidateRecord, CandidateProfile, Specification } from "../src";

const mol = getSampleMolecule("ethanol")!;
function rec(name: string, values: Record<string, number | string>, overall: "pass" | "fail" = "pass"): CandidateRecord {
  const profile: CandidateProfile = {};
  for (const [k, v] of Object.entries(values)) profile[k] = { key: k, value: v, kind: k === "mw" ? "computed" : "predicted", method: "m", uncertainty: k === "tb" ? "±13" : null };
  return { candidate: { id: name, name, molecule: mol, origin: { generator: "g", strategy: "s", parent: null, operations: [`made ${name}`] } }, status: "valid", canonicalSmiles: name, profile, evaluation: { overall, constraints: [{ constraintId: "h1", property: "mw", requirement: "Molecular weight ≤ 70 g/mol", status: overall, actual: null, reason: "" }], structural: [], counts: { pass: 0, fail: 0, borderline: 0, unknown: 0 } } };
}

describe("comparison matrix", () => {
  const spec: Specification = { ...createSpecification("c"), hard: [{ id: "h1", property: "mw", op: "<=", max: 70 }], soft: [{ id: "p", property: "tb", direction: "minimize", weight: 1 }], structural: { ...createSpecification("c").structural, requiredSubstructures: ["[OX2H]"] } };
  const records = [rec("A", { mw: 60, tb: 80, logS: -1 }), rec("B", { mw: 74, tb: 65 }, "fail")];

  it("puts hard constraints first, then present properties by domain, marking the best only where a direction is known", () => {
    const cmp = buildComparison(rankRecords(records, spec).records, spec);
    expect(cmp.columns.map((c) => c.name)).toEqual(["A", "B"]);
    expect(cmp.rows[0]!.group).toBe("Hard constraints");
    expect(cmp.rows[0]!.cells.map((c) => c.text)).toEqual(["✓ 60", "✗ 74"]);
    expect(cmp.rows[1]!.label).toBe("Must contain [OX2H]");
    const tb = cmp.rows.find((r) => r.id === "prop:tb")!;
    expect(tb.cells.map((c) => c.best)).toEqual([false, true]); // lower is better
    expect(tb.cells[0]!.uncertainty).toBe("±13");
    const mw = cmp.rows.find((r) => r.id === "prop:mw")!;
    expect(mw.cells.every((c) => !c.best)).toBe(true); // no preference → no judgement
    const logS = cmp.rows.find((r) => r.id === "prop:logS")!;
    expect(logS.cells.map((c) => c.text)).toEqual(["-1", "—"]);
    expect(cmp.rows.find((r) => r.id === "prop:density")).toBeUndefined(); // absent everywhere
    expect(cmp.columns[0]!.paretoFront).toBe(1);
    expect(cmp.columns[1]!.verdict).toBe("fail");
  });

  it("serialises to CSV with provenance rows and quoting", () => {
    const csv = comparisonToCsv(buildComparison(records, spec));
    const lines = csv.split("\n");
    expect(lines[0]).toBe("group,property,unit,A,B");
    expect(lines[2]).toBe(",verdict,,pass,fail");
    expect(lines.some((l) => l.startsWith("Hard constraints,Molecular weight ≤ 70 g/mol,,60 (computed),74 (computed)"))).toBe(true);
    expect(lines.some((l) => l.includes('"Thermodynamic (predicted)"') || l.startsWith("Thermodynamic (predicted),Normal boiling point,°C,80 (predicted),65 (predicted)"))).toBe(true);
  });
});
