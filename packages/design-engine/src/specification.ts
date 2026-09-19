/**
 * Requirement specification: what a candidate molecule must satisfy (hard constraints), what is
 * preferred (soft preferences, used for ranking in a later phase) and what its structure may
 * look like (structural constraints). Immutable data; the builder UI produces new objects.
 */
import { getElement } from "@molecular-cad/molecule-model";
import { PROPERTY_BY_KEY } from "./properties";

export type ConstraintOp = "between" | "<=" | ">=" | "in";

export interface HardConstraint {
  id: string;
  /** Property catalogue key. */
  property: string;
  op: ConstraintOp;
  /** Lower bound (op "between" or ">="). */
  min?: number;
  /** Upper bound (op "between" or "<="). */
  max?: number;
  /** Allowed categories (op "in"). */
  values?: string[];
}

export type PreferenceDirection = "maximize" | "minimize" | "target";

export interface SoftPreference {
  id: string;
  property: string;
  direction: PreferenceDirection;
  /** Desired value for direction "target". */
  target?: number;
  /** Relative importance, 0–1. */
  weight: number;
}

export interface StructuralConstraints {
  /** Element symbols the candidate may contain (empty: any). */
  allowedElements: string[];
  minHeavyAtoms: number | null;
  maxHeavyAtoms: number | null;
  /** Net charge must be zero. */
  neutral: boolean;
  /** SMARTS patterns that must be present (checked by the chemistry engine in later phases). */
  requiredSubstructures: string[];
  /** SMARTS patterns that must be absent. */
  forbiddenSubstructures: string[];
}

export interface Specification {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  hard: HardConstraint[];
  soft: SoftPreference[];
  structural: StructuralConstraints;
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function emptyStructural(): StructuralConstraints {
  return { allowedElements: [], minHeavyAtoms: null, maxHeavyAtoms: null, neutral: false, requiredSubstructures: [], forbiddenSubstructures: [] };
}

export function createSpecification(name = "Untitled specification"): Specification {
  const now = new Date().toISOString();
  return { id: newId("spec"), name, description: "", createdAt: now, updatedAt: now, hard: [], soft: [], structural: emptyStructural() };
}

export function touch(spec: Specification): Specification {
  return { ...spec, updatedAt: new Date().toISOString() };
}

export function createHardConstraint(property: string): HardConstraint {
  const def = PROPERTY_BY_KEY.get(property);
  if (def?.type === "category") return { id: newId("hard"), property, op: "in", values: def.categories ? [def.categories[0]!] : [] };
  return { id: newId("hard"), property, op: "between" };
}

export function createSoftPreference(property: string, direction: PreferenceDirection = "maximize"): SoftPreference {
  return { id: newId("soft"), property, direction, weight: 0.5 };
}

export interface SpecificationIssue {
  severity: "error" | "warning";
  /** Where: "hard:<id>", "soft:<id>", "structural", "name". */
  path: string;
  message: string;
}

/** Sanity checks a builder shows live; a specification with errors cannot drive a design run. */
export function validateSpecification(spec: Specification): SpecificationIssue[] {
  const issues: SpecificationIssue[] = [];
  if (!spec.name.trim()) issues.push({ severity: "warning", path: "name", message: "The specification has no name." });
  const seen = new Map<string, number>();
  for (const c of spec.hard) {
    const path = `hard:${c.id}`;
    const def = PROPERTY_BY_KEY.get(c.property);
    if (!def) {
      issues.push({ severity: "error", path, message: `Unknown property "${c.property}".` });
      continue;
    }
    seen.set(c.property, (seen.get(c.property) ?? 0) + 1);
    if (def.type === "category") {
      if (c.op !== "in") issues.push({ severity: "error", path, message: `${def.label} is categorical: use "one of".` });
      else if (!c.values || c.values.length === 0) issues.push({ severity: "error", path, message: `${def.label}: choose at least one allowed value.` });
      else for (const v of c.values) if (!def.categories?.includes(v)) issues.push({ severity: "error", path, message: `${def.label}: "${v}" is not a known value.` });
      continue;
    }
    if (c.op === "in") {
      issues.push({ severity: "error", path, message: `${def.label} is numeric: use a range or a bound.` });
      continue;
    }
    const hasMin = typeof c.min === "number" && Number.isFinite(c.min);
    const hasMax = typeof c.max === "number" && Number.isFinite(c.max);
    if (c.op === "between" && (!hasMin || !hasMax)) issues.push({ severity: "error", path, message: `${def.label}: a range needs both a lower and an upper bound.` });
    if (c.op === ">=" && !hasMin) issues.push({ severity: "error", path, message: `${def.label}: enter the lower bound.` });
    if (c.op === "<=" && !hasMax) issues.push({ severity: "error", path, message: `${def.label}: enter the upper bound.` });
    if (hasMin && hasMax && c.min! > c.max!) issues.push({ severity: "error", path, message: `${def.label}: the lower bound (${c.min}) exceeds the upper bound (${c.max}).` });
    if (hasMin && hasMax && c.min === c.max) issues.push({ severity: "warning", path, message: `${def.label}: a zero-width range; with a model error of ${def.uncertainty ?? "unknown size"} nothing will pass reliably.` });
  }
  for (const [key, n] of seen) if (n > 1) issues.push({ severity: "warning", path: "hard", message: `${PROPERTY_BY_KEY.get(key)?.label ?? key} is constrained ${n} times; the constraints combine with AND.` });
  for (const s of spec.soft) {
    const path = `soft:${s.id}`;
    const def = PROPERTY_BY_KEY.get(s.property);
    if (!def) {
      issues.push({ severity: "error", path, message: `Unknown property "${s.property}".` });
      continue;
    }
    if (def.type === "category") issues.push({ severity: "error", path, message: `${def.label} is categorical and cannot be maximised or minimised; use a hard constraint.` });
    if (s.direction === "target" && !(typeof s.target === "number" && Number.isFinite(s.target))) issues.push({ severity: "error", path, message: `${def.label}: enter the target value.` });
    if (!(s.weight >= 0 && s.weight <= 1)) issues.push({ severity: "error", path, message: `${def.label}: weight must be between 0 and 1.` });
  }
  const st = spec.structural;
  for (const el of st.allowedElements) if (!getElement(el)) issues.push({ severity: "error", path: "structural", message: `Unknown element symbol "${el}".` });
  if (st.minHeavyAtoms !== null && st.maxHeavyAtoms !== null && st.minHeavyAtoms > st.maxHeavyAtoms) issues.push({ severity: "error", path: "structural", message: `Heavy-atom minimum (${st.minHeavyAtoms}) exceeds the maximum (${st.maxHeavyAtoms}).` });
  if (st.minHeavyAtoms !== null && st.minHeavyAtoms < 1) issues.push({ severity: "error", path: "structural", message: "Heavy-atom minimum must be at least 1." });
  for (const s of [...st.requiredSubstructures, ...st.forbiddenSubstructures]) if (!s.trim()) issues.push({ severity: "error", path: "structural", message: "Empty substructure pattern." });
  const both = st.requiredSubstructures.filter((s) => st.forbiddenSubstructures.includes(s));
  for (const s of both) issues.push({ severity: "error", path: "structural", message: `"${s}" is both required and forbidden.` });
  if (spec.hard.length === 0 && spec.soft.length === 0 && st.allowedElements.length === 0 && st.minHeavyAtoms === null && st.maxHeavyAtoms === null && st.requiredSubstructures.length === 0 && st.forbiddenSubstructures.length === 0 && !st.neutral) issues.push({ severity: "warning", path: "spec", message: "The specification is empty: every candidate would pass." });
  return issues;
}

export function hasErrors(issues: SpecificationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

/** Human-readable requirement lines, for summaries and reports. */
export function describeConstraint(c: HardConstraint): string {
  const def = PROPERTY_BY_KEY.get(c.property);
  const label = def?.label ?? c.property;
  const unit = def?.unit ? ` ${def.unit}` : "";
  switch (c.op) {
    case "between":
      return `${label} between ${c.min ?? "?"} and ${c.max ?? "?"}${unit}`;
    case "<=":
      return `${label} ≤ ${c.max ?? "?"}${unit}`;
    case ">=":
      return `${label} ≥ ${c.min ?? "?"}${unit}`;
    case "in":
      return `${label} one of: ${(c.values ?? []).join(", ") || "?"}`;
  }
}

export function describePreference(s: SoftPreference): string {
  const def = PROPERTY_BY_KEY.get(s.property);
  const label = def?.label ?? s.property;
  const unit = def?.unit ? ` ${def.unit}` : "";
  const w = `weight ${s.weight.toFixed(2)}`;
  if (s.direction === "target") return `${label} close to ${s.target ?? "?"}${unit} (${w})`;
  return `${label}: ${s.direction === "maximize" ? "higher" : "lower"} is better (${w})`;
}

export function describeStructural(st: StructuralConstraints): string[] {
  const out: string[] = [];
  if (st.allowedElements.length) out.push(`Elements limited to ${st.allowedElements.join(", ")}`);
  if (st.minHeavyAtoms !== null || st.maxHeavyAtoms !== null) out.push(`Heavy atoms ${st.minHeavyAtoms ?? "any"} – ${st.maxHeavyAtoms ?? "any"}`);
  if (st.neutral) out.push("Neutral molecule (net charge 0)");
  for (const s of st.requiredSubstructures) out.push(`Must contain ${s}`);
  for (const s of st.forbiddenSubstructures) out.push(`Must not contain ${s}`);
  return out;
}
