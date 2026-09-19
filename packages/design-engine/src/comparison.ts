/**
 * Candidate comparison (phase 3E): a property-by-candidate matrix built from the records, with
 * the hard-constraint verdicts first, then every catalogue property any selected candidate has
 * a value for, grouped by domain. "Best in row" is only marked where the specification says
 * which direction is better (a soft preference on that property); otherwise values are shown
 * without judgement. Pure data: the UI renders it, the CSV export serialises it.
 */
import { DOMAIN_LABELS, PROPERTY_BY_KEY, PROPERTY_CATALOGUE } from "./properties";
import type { PropertyDomain, ValueKind } from "./properties";
import type { CheckStatus } from "./evaluation";
import type { CandidateRecord } from "./run";
import type { RankedRecord } from "./ranking";
import type { Specification } from "./specification";
import { describeConstraint } from "./specification";

export interface ComparisonCell {
  text: string;
  value: number | string | null;
  kind: ValueKind | null;
  method: string | null;
  uncertainty: string | null;
  status: CheckStatus | null;
  best: boolean;
}

export interface ComparisonRow {
  id: string;
  group: string;
  label: string;
  unit: string | null;
  cells: ComparisonCell[];
}

export interface ComparisonColumn {
  id: string;
  name: string;
  canonicalSmiles: string | null;
  verdict: CheckStatus | null;
  origin: string;
  paretoFront: number | null;
  position: number | null;
  weighted: number | null;
}

export interface Comparison {
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
}

const fmt = (v: number | string): string => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1)) : v);
const STATUS_TEXT: Record<CheckStatus, string> = { pass: "✓", fail: "✗", borderline: "△", unknown: "?" };

export function buildComparison(records: Array<CandidateRecord | RankedRecord>, spec: Specification): Comparison {
  const columns: ComparisonColumn[] = records.map((r) => {
    const ranking = (r as RankedRecord).ranking;
    return { id: r.candidate.id, name: r.candidate.name, canonicalSmiles: r.canonicalSmiles ?? null, verdict: r.status === "rejected" ? null : (r.evaluation?.overall ?? null), origin: r.candidate.origin.operations.join("; "), paretoFront: ranking?.paretoFront ?? null, position: ranking?.position ?? null, weighted: ranking?.weighted ?? null };
  });
  const rows: ComparisonRow[] = [];
  // Hard constraints: verdict per candidate.
  for (const c of spec.hard) {
    const def = PROPERTY_BY_KEY.get(c.property);
    rows.push({
      id: `hard:${c.id}`,
      group: "Hard constraints",
      label: describeConstraint(c),
      unit: null,
      cells: records.map((r) => {
        const res = r.evaluation?.constraints.find((x) => x.constraintId === c.id);
        const v = r.profile?.[c.property];
        return { text: res ? `${STATUS_TEXT[res.status]} ${v ? fmt(v.value) : "—"}` : "—", value: v?.value ?? null, kind: v?.kind ?? null, method: v?.method ?? null, uncertainty: v?.uncertainty ?? null, status: res?.status ?? null, best: false };
      }),
    });
    void def;
  }
  for (const s of spec.structural.requiredSubstructures) rows.push({ id: `req:${s}`, group: "Hard constraints", label: `Must contain ${s}`, unit: null, cells: records.map((r) => ({ text: r.status === "valid" ? "✓" : "—", value: null, kind: null, method: null, uncertainty: null, status: r.status === "valid" ? "pass" : null, best: false })) });
  // Properties present in any profile, in catalogue order, grouped by domain.
  const directions = new Map<string, "maximize" | "minimize">();
  for (const p of spec.soft) if (p.direction !== "target") directions.set(p.property, p.direction);
  for (const def of PROPERTY_CATALOGUE) {
    const values = records.map((r) => r.profile?.[def.key] ?? null);
    if (values.every((v) => v === null)) continue;
    const numeric = values.map((v) => (v && typeof v.value === "number" ? v.value : null));
    const dir = directions.get(def.key);
    let bestValue: number | null = null;
    if (dir && numeric.some((v) => v !== null)) bestValue = dir === "maximize" ? Math.max(...numeric.filter((v): v is number => v !== null)) : Math.min(...numeric.filter((v): v is number => v !== null));
    rows.push({
      id: `prop:${def.key}`,
      group: DOMAIN_LABELS[def.domain as PropertyDomain],
      label: def.label,
      unit: def.unit,
      cells: values.map((v, i) => ({ text: v ? fmt(v.value) : "—", value: v?.value ?? null, kind: v?.kind ?? null, method: v?.method ?? null, uncertainty: v?.uncertainty ?? null, status: null, best: bestValue !== null && numeric[i] === bestValue })),
    });
  }
  return { columns, rows };
}

/** CSV with one row per property and one column per candidate (plus provenance columns). */
export function comparisonToCsv(cmp: Comparison): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [["group", "property", "unit", ...cmp.columns.map((c) => c.name)].map(esc).join(",")];
  lines.push(["", "canonical SMILES", "", ...cmp.columns.map((c) => c.canonicalSmiles ?? "")].map(esc).join(","));
  lines.push(["", "verdict", "", ...cmp.columns.map((c) => c.verdict ?? "rejected")].map(esc).join(","));
  lines.push(["", "Pareto front", "", ...cmp.columns.map((c) => (c.paretoFront === null ? "" : String(c.paretoFront)))].map(esc).join(","));
  for (const r of cmp.rows) lines.push([r.group, r.label, r.unit ?? "", ...r.cells.map((c) => (c.value === null ? "" : `${fmt(c.value)}${c.kind ? ` (${c.kind})` : ""}`))].map(esc).join(","));
  return lines.join("\n");
}
