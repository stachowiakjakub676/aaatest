import { describe, expect, it } from "vitest";
import { getSampleMolecule } from "@molecular-cad/molecule-model";
import { createSpecification, rankRecords } from "../src";
import type { CandidateRecord, CandidateProfile, Specification } from "../src";

const mol = getSampleMolecule("ethanol")!;
function rec(name: string, values: Partial<Record<"tb" | "logS" | "mw", number>>, overall: "pass" | "fail" | "borderline" | "unknown" = "pass", status: "valid" | "rejected" = "valid"): CandidateRecord {
  const profile: CandidateProfile = {};
  for (const [k, v] of Object.entries(values)) profile[k] = { key: k, value: v!, kind: "predicted", method: "t", uncertainty: null };
  return { candidate: { id: name, name, molecule: mol, origin: { generator: "t", strategy: "t", parent: null, operations: [] } }, status, canonicalSmiles: name, profile, evaluation: { overall, constraints: [], structural: [], counts: { pass: 0, fail: 0, borderline: 0, unknown: 0 } } };
}
const spec: Specification = { ...createSpecification("r"), soft: [{ id: "p1", property: "tb", direction: "minimize", weight: 0.5 }, { id: "p2", property: "logS", direction: "maximize", weight: 0.5 }] };

describe("multi-objective ranking", () => {
  it("finds the Pareto front, peels fronts and orders by front then weighted score", () => {
    const records = [
      rec("A", { tb: 60, logS: -1 }), // best tb, best logS → dominates everything
      rec("B", { tb: 80, logS: -2 }),
      rec("C", { tb: 70, logS: -3 }),
      rec("D", { tb: 90, logS: -1.5 }),
    ];
    const r = rankRecords(records, spec);
    expect(r.population).toBe(4);
    expect(r.front.map((x) => x.candidate.name)).toEqual(["A"]);
    const byName = Object.fromEntries(r.records.map((x) => [x.candidate.name, x.ranking]));
    expect(byName.A!.paretoFront).toBe(1);
    expect(byName.A!.weighted).toBeCloseTo(1, 6);
    expect(byName.A!.dominatedBy).toBe(0);
    expect(byName.B!.paretoFront).toBe(2); // not dominated by C or D, only by A
    expect(byName.C!.paretoFront).toBe(2); // C: better tb than B, worse logS → not dominated by B
    expect(byName.D!.paretoFront).toBe(2); // D: better logS than B and C → not dominated by them
    expect(r.ordered.map((x) => x.candidate.name)[0]).toBe("A");
    expect(r.ordered.map((x) => x.ranking.position)).toEqual([1, 2, 3, 4]);
    expect(r.objectives[0]!.best!.name).toBe("A");
    expect(r.objectives[0]!.min).toBe(60);
    expect(r.objectives[0]!.max).toBe(90);
  });

  it("keeps a genuine trade-off as a multi-member front and lets weights order it", () => {
    const records = [rec("cool", { tb: 60, logS: -3 }), rec("soluble", { tb: 90, logS: -1 }), rec("dominated", { tb: 90, logS: -3 })];
    const even = rankRecords(records, spec);
    expect(even.front.map((x) => x.candidate.name).sort()).toEqual(["cool", "soluble"]);
    expect(even.records.find((x) => x.candidate.name === "dominated")!.ranking.paretoFront).toBe(2);
    expect(even.notes.some((n) => /2 candidates are Pareto-optimal/.test(n))).toBe(true);
    const tbFirst: Specification = { ...spec, soft: [{ ...spec.soft[0]!, weight: 0.9 }, { ...spec.soft[1]!, weight: 0.1 }] };
    expect(rankRecords(records, tbFirst).ordered[0]!.candidate.name).toBe("cool");
    const solFirst: Specification = { ...spec, soft: [{ ...spec.soft[0]!, weight: 0.1 }, { ...spec.soft[1]!, weight: 0.9 }] };
    expect(rankRecords(records, solFirst).ordered[0]!.candidate.name).toBe("soluble");
  });

  it("scores 'close to' targets, excludes missing values and non-admitted verdicts, and explains why", () => {
    const target: Specification = { ...spec, soft: [{ id: "t", property: "tb", direction: "target", target: 75, weight: 1 }] };
    const records = [rec("far", { tb: 60 }), rec("near", { tb: 74 }), rec("noValue", { logS: -1 }), rec("failed", { tb: 75 }, "fail"), rec("rejected", { tb: 75 }, "pass", "rejected")];
    const r = rankRecords(records, target);
    expect(r.ordered.map((x) => x.candidate.name)).toEqual(["near", "far"]);
    const info = Object.fromEntries(r.records.map((x) => [x.candidate.name, x.ranking]));
    expect(info.noValue!.eligible).toBe(false);
    expect(info.noValue!.reason).toMatch(/missing value for Normal boiling point/);
    expect(info.failed!.reason).toMatch(/verdict fail is not admitted/);
    expect(info.rejected!.reason).toBe("rejected during validation");
    expect(rankRecords(records, target, { admit: ["pass", "fail"] }).ordered.map((x) => x.candidate.name)).toEqual(["failed", "near", "far"]);
    expect(r.notes.some((n) => /lack a value/.test(n))).toBe(true);
    const none = rankRecords(records, createSpecification("empty"));
    expect(none.ordered).toEqual([]);
    expect(none.notes[0]).toMatch(/No soft preferences/);
  });
});
