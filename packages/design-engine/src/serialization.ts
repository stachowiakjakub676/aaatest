/** Specification files: `kind: "clapeyron-specification"`, version 1. */
import { emptyStructural, validateSpecification } from "./specification";
import type { HardConstraint, SoftPreference, Specification, StructuralConstraints } from "./specification";

export const SPECIFICATION_KIND = "clapeyron-specification";

export interface SpecificationFile {
  kind: typeof SPECIFICATION_KIND;
  version: 1;
  specification: Specification;
}

export function serializeSpecification(spec: Specification, pretty = true): string {
  const file: SpecificationFile = { kind: SPECIFICATION_KIND, version: 1, specification: spec };
  return JSON.stringify(file, null, pretty ? 2 : 0);
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);

/** Parse a specification file; null when the text is not one; throws on a malformed one. */
export function parseSpecification(text: string): Specification | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || (raw as { kind?: unknown }).kind !== SPECIFICATION_KIND) return null;
  const s = (raw as { specification?: unknown }).specification as Partial<Specification> | undefined;
  if (!s || typeof s !== "object") throw new Error("Specification file has no specification object.");
  if (typeof s.id !== "string" || typeof s.name !== "string") throw new Error("Specification needs an id and a name.");
  const hard: HardConstraint[] = (Array.isArray(s.hard) ? s.hard : []).map((c: Partial<HardConstraint>, i) => {
    if (typeof c.id !== "string" || typeof c.property !== "string" || !["between", "<=", ">=", "in"].includes(String(c.op))) throw new Error(`Hard constraint ${i + 1} is malformed.`);
    const out: HardConstraint = { id: c.id, property: c.property, op: c.op as HardConstraint["op"] };
    const mn = num(c.min);
    const mx = num(c.max);
    if (mn !== undefined) out.min = mn;
    if (mx !== undefined) out.max = mx;
    if (Array.isArray(c.values)) out.values = strList(c.values);
    return out;
  });
  const soft: SoftPreference[] = (Array.isArray(s.soft) ? s.soft : []).map((p: Partial<SoftPreference>, i) => {
    if (typeof p.id !== "string" || typeof p.property !== "string" || !["maximize", "minimize", "target"].includes(String(p.direction))) throw new Error(`Preference ${i + 1} is malformed.`);
    const out: SoftPreference = { id: p.id, property: p.property, direction: p.direction as SoftPreference["direction"], weight: num(p.weight) ?? 0.5 };
    const t = num(p.target);
    if (t !== undefined) out.target = t;
    return out;
  });
  const st = (s.structural ?? {}) as Partial<StructuralConstraints>;
  const structural: StructuralConstraints = { ...emptyStructural(), allowedElements: strList(st.allowedElements), minHeavyAtoms: numOrNull(st.minHeavyAtoms), maxHeavyAtoms: numOrNull(st.maxHeavyAtoms), neutral: st.neutral === true, requiredSubstructures: strList(st.requiredSubstructures), forbiddenSubstructures: strList(st.forbiddenSubstructures) };
  const spec: Specification = { id: s.id, name: s.name, description: typeof s.description === "string" ? s.description : "", createdAt: typeof s.createdAt === "string" ? s.createdAt : new Date().toISOString(), updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : new Date().toISOString(), hard, soft, structural };
  // Structural errors in a file are surfaced by the builder, not rejected here; only shape errors throw.
  void validateSpecification(spec);
  return spec;
}
