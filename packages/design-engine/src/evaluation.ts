/**
 * Evaluation of a candidate against a specification. A candidate is represented by a property
 * profile: values keyed by catalogue key, each carrying its provenance. Values that no tool
 * supplied are "unknown", which is neither a pass nor a fail; a candidate passes only when every
 * hard constraint passes, fails when any fails, and is otherwise undecided.
 */
import { getAtom, neighborsOf, totalFormalCharge } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import { PROPERTY_BY_KEY } from "./properties";
import type { ValueKind } from "./properties";
import { describeConstraint } from "./specification";
import type { HardConstraint, Specification, StructuralConstraints } from "./specification";

export interface PropertyValue {
  key: string;
  value: number | string;
  kind: ValueKind;
  /** Method or model that produced the value (provenance). */
  method: string;
  uncertainty: string | null;
}

/** Catalogue key → value with provenance. */
export type CandidateProfile = Record<string, PropertyValue>;

export type CheckStatus = "pass" | "fail" | "unknown";

export interface ConstraintResult {
  constraintId: string;
  property: string;
  requirement: string;
  status: CheckStatus;
  actual: PropertyValue | null;
  reason: string;
}

export interface StructuralResult {
  rule: string;
  status: CheckStatus;
  reason: string;
}

export interface EvaluationResult {
  overall: CheckStatus;
  constraints: ConstraintResult[];
  structural: StructuralResult[];
  /** Numbers of hard checks by status (constraints + structural rules). */
  counts: Record<CheckStatus, number>;
}

function fmt(v: number | string): string {
  return typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1)) : v;
}

export function checkConstraint(c: HardConstraint, profile: CandidateProfile): ConstraintResult {
  const def = PROPERTY_BY_KEY.get(c.property);
  const requirement = describeConstraint(c);
  const actual = profile[c.property] ?? null;
  const base = { constraintId: c.id, property: c.property, requirement, actual };
  if (!def) return { ...base, status: "unknown", reason: "unknown property" };
  if (!actual) return { ...base, status: "unknown", reason: `no ${def.kind} value available for ${def.label.toLowerCase()}` };
  const unit = def.unit ? ` ${def.unit}` : "";
  if (c.op === "in") {
    const ok = typeof actual.value === "string" && (c.values ?? []).includes(actual.value);
    return { ...base, status: ok ? "pass" : "fail", reason: ok ? `${actual.value} is allowed` : `${actual.value} is not one of ${(c.values ?? []).join(", ")}` };
  }
  if (typeof actual.value !== "number") return { ...base, status: "unknown", reason: "value is not numeric" };
  const v = actual.value;
  const lowOk = c.op === "<=" || (typeof c.min === "number" && v >= c.min);
  const highOk = c.op === ">=" || (typeof c.max === "number" && v <= c.max);
  if (c.op === "between" && (typeof c.min !== "number" || typeof c.max !== "number")) return { ...base, status: "unknown", reason: "incomplete range" };
  if (c.op === ">=" && typeof c.min !== "number") return { ...base, status: "unknown", reason: "missing bound" };
  if (c.op === "<=" && typeof c.max !== "number") return { ...base, status: "unknown", reason: "missing bound" };
  const ok = lowOk && highOk;
  const where = !lowOk ? `${fmt(v)}${unit} is below ${c.min}${unit}` : !highOk ? `${fmt(v)}${unit} is above ${c.max}${unit}` : `${fmt(v)}${unit} is within the requirement`;
  const caveat = actual.kind === "predicted" || actual.kind === "estimated" ? ` (${actual.kind}: ${actual.uncertainty ?? "uncertainty not stated"})` : "";
  return { ...base, status: ok ? "pass" : "fail", reason: where + caveat };
}

/** Structural rules that follow from the graph alone; substructure patterns need the chemistry engine and stay unknown here. */
export function checkStructural(st: StructuralConstraints, mol: Molecule): StructuralResult[] {
  const out: StructuralResult[] = [];
  const heavy = mol.atoms.filter((a) => a.element !== "H");
  if (st.allowedElements.length) {
    const present = [...new Set(mol.atoms.map((a) => a.element))].filter((e) => e !== "H");
    const bad = present.filter((e) => !st.allowedElements.includes(e));
    out.push({ rule: `Elements limited to ${st.allowedElements.join(", ")}`, status: bad.length ? "fail" : "pass", reason: bad.length ? `contains ${bad.join(", ")}` : `contains only ${present.join(", ") || "hydrogen"}` });
  }
  if (st.minHeavyAtoms !== null || st.maxHeavyAtoms !== null) {
    const ok = (st.minHeavyAtoms === null || heavy.length >= st.minHeavyAtoms) && (st.maxHeavyAtoms === null || heavy.length <= st.maxHeavyAtoms);
    out.push({ rule: `Heavy atoms ${st.minHeavyAtoms ?? "any"} – ${st.maxHeavyAtoms ?? "any"}`, status: ok ? "pass" : "fail", reason: `${heavy.length} heavy atoms` });
  }
  if (st.neutral) {
    const q = totalFormalCharge(mol);
    out.push({ rule: "Neutral molecule", status: q === 0 ? "pass" : "fail", reason: `net charge ${q > 0 ? "+" : ""}${q}` });
  }
  for (const s of st.requiredSubstructures) out.push({ rule: `Must contain ${s}`, status: "unknown", reason: "substructure matching needs the chemistry engine (phase 3B)" });
  for (const s of st.forbiddenSubstructures) out.push({ rule: `Must not contain ${s}`, status: "unknown", reason: "substructure matching needs the chemistry engine (phase 3B)" });
  // Disconnected fragments are never a valid single candidate.
  if (heavy.length > 1) {
    const seen = new Set<string>();
    const stack = [heavy[0]!.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const n of neighborsOf(mol, id)) if (getAtom(mol, n)?.element !== "H") stack.push(n);
    }
    if (seen.size !== heavy.length) out.push({ rule: "Single connected molecule", status: "fail", reason: "the structure has several disconnected fragments" });
  }
  return out;
}

export function evaluateSpecification(spec: Specification, profile: CandidateProfile, mol: Molecule | null): EvaluationResult {
  const constraints = spec.hard.map((c) => checkConstraint(c, profile));
  const structural = mol ? checkStructural(spec.structural, mol) : [];
  const counts: Record<CheckStatus, number> = { pass: 0, fail: 0, unknown: 0 };
  for (const r of [...constraints, ...structural]) counts[r.status] += 1;
  const overall: CheckStatus = counts.fail > 0 ? "fail" : counts.unknown > 0 ? "unknown" : "pass";
  return { overall, constraints, structural, counts };
}
