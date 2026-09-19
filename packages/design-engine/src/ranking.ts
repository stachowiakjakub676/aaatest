/**
 * Multi-objective ranking (phase 3D). The soft preferences are objectives; each candidate gets a
 * per-objective satisfaction in [0, 1] normalised over the population of ranked candidates, a
 * Pareto front number (1 = not dominated by any other candidate on every objective), and a
 * weighted score for a configurable ordering. The Pareto front is the honest answer to "which
 * candidates are best?": it keeps every trade-off visible instead of collapsing them into one
 * number. The weighted score only orders candidates once the user has said what matters more.
 */
import type { CheckStatus } from "./evaluation";
import { PROPERTY_BY_KEY } from "./properties";
import type { CandidateRecord } from "./run";
import type { SoftPreference, Specification } from "./specification";

export interface ObjectiveScore {
  preferenceId: string;
  property: string;
  direction: SoftPreference["direction"];
  weight: number;
  /** Actual value (null when the profile has none). */
  value: number | null;
  /** Satisfaction 0–1 over the ranked population (null when the value is missing). */
  score: number | null;
}

export interface RankingInfo {
  /** Ranked at all (verdict allowed by the options and every objective known). */
  eligible: boolean;
  /** Why not eligible. */
  reason: string | null;
  objectives: ObjectiveScore[];
  /** Weighted sum of the scores with the weights normalised to 1 (null when not eligible). */
  weighted: number | null;
  /** 1 for the Pareto front, 2 for the next layer, … (null when not eligible or no objectives). */
  paretoFront: number | null;
  /** Number of eligible candidates that dominate this one. */
  dominatedBy: number;
  /** Position in the final order (1-based) among eligible candidates. */
  position: number | null;
}

export interface RankedRecord extends CandidateRecord {
  ranking: RankingInfo;
}

export interface RankingOptions {
  /** Verdicts admitted to the ranking (default: pass and borderline). */
  admit?: CheckStatus[];
}

export interface ObjectiveSummary {
  preferenceId: string;
  property: string;
  label: string;
  unit: string | null;
  direction: SoftPreference["direction"];
  min: number | null;
  max: number | null;
  /** Candidate that satisfies this objective best. */
  best: { id: string; name: string; value: number } | null;
}

export interface RankingResult {
  records: RankedRecord[];
  /** Eligible records in final order. */
  ordered: RankedRecord[];
  /** Members of the first Pareto front, in final order. */
  front: RankedRecord[];
  objectives: ObjectiveSummary[];
  /** How many eligible candidates the front was computed over. */
  population: number;
  notes: string[];
}

function numeric(r: CandidateRecord, key: string): number | null {
  const v = r.profile?.[key]?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** a dominates b when a is at least as good on every objective and strictly better on one. */
function dominates(a: number[], b: number[]): boolean {
  let strictly = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]! < b[i]!) return false;
    if (a[i]! > b[i]!) strictly = true;
  }
  return strictly;
}

export function rankRecords(records: CandidateRecord[], spec: Specification, opts: RankingOptions = {}): RankingResult {
  const admit = new Set<CheckStatus>(opts.admit ?? ["pass", "borderline"]);
  const prefs = spec.soft.filter((p) => PROPERTY_BY_KEY.get(p.property)?.type === "number");
  const notes: string[] = [];
  if (prefs.length === 0) notes.push("No soft preferences: nothing to rank by. Candidates keep their generation order; add preferences in the specification to see trade-offs.");
  const totalWeight = prefs.reduce((s, p) => s + p.weight, 0);
  if (prefs.length && totalWeight === 0) notes.push("All preference weights are 0: the weighted order is undefined, only the Pareto front is meaningful.");

  // Population: admitted verdicts with every objective value present.
  const candidatesForRanking = records.filter((r) => r.status === "valid" && r.evaluation && admit.has(r.evaluation.overall));
  const withValues = candidatesForRanking.filter((r) => prefs.every((p) => numeric(r, p.property) !== null));
  const bounds = prefs.map((p) => {
    const vals = withValues.map((r) => numeric(r, p.property)!);
    return { min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null };
  });

  const scoreOf = (p: SoftPreference, v: number, b: { min: number | null; max: number | null }): number => {
    if (b.min === null || b.max === null) return 1;
    if (p.direction === "target") {
      const t = p.target ?? v;
      const span = Math.max(Math.abs(b.max - t), Math.abs(b.min - t));
      return span === 0 ? 1 : 1 - Math.abs(v - t) / span;
    }
    if (b.max === b.min) return 1;
    const up = (v - b.min) / (b.max - b.min);
    return p.direction === "maximize" ? up : 1 - up;
  };

  const eligibleIds = new Set(withValues.map((r) => r.candidate.id));
  const vectors = new Map<string, number[]>();
  const ranked: RankedRecord[] = records.map((r) => {
    const objectives: ObjectiveScore[] = prefs.map((p, i) => {
      const v = numeric(r, p.property);
      return { preferenceId: p.id, property: p.property, direction: p.direction, weight: p.weight, value: v, score: v === null || !eligibleIds.has(r.candidate.id) ? null : scoreOf(p, v, bounds[i]!) };
    });
    const eligible = eligibleIds.has(r.candidate.id) && prefs.length > 0;
    let reason: string | null = null;
    if (r.status !== "valid") reason = "rejected during validation";
    else if (!r.evaluation) reason = "not evaluated";
    else if (!admit.has(r.evaluation.overall)) reason = `verdict ${r.evaluation.overall} is not admitted to the ranking`;
    else if (prefs.length === 0) reason = "no soft preferences";
    else if (!eligibleIds.has(r.candidate.id)) reason = `missing value for ${prefs.filter((p) => numeric(r, p.property) === null).map((p) => PROPERTY_BY_KEY.get(p.property)?.label ?? p.property).join(", ")}`;
    if (eligible) vectors.set(r.candidate.id, objectives.map((o) => o.score!));
    const weighted = eligible && totalWeight > 0 ? objectives.reduce((s, o) => s + (o.score ?? 0) * o.weight, 0) / totalWeight : eligible ? objectives.reduce((s, o) => s + (o.score ?? 0), 0) / Math.max(1, objectives.length) : null;
    return { ...r, ranking: { eligible, reason, objectives, weighted, paretoFront: null, dominatedBy: 0, position: null } };
  });

  // Pareto fronts by peeling: front 1 = non-dominated among all, front 2 = non-dominated among the rest, …
  const eligible = ranked.filter((r) => r.ranking.eligible);
  for (const r of eligible) r.ranking.dominatedBy = eligible.filter((o) => o !== r && dominates(vectors.get(o.candidate.id)!, vectors.get(r.candidate.id)!)).length;
  let remaining = [...eligible];
  let front = 1;
  while (remaining.length) {
    const members = remaining.filter((r) => !remaining.some((o) => o !== r && dominates(vectors.get(o.candidate.id)!, vectors.get(r.candidate.id)!)));
    for (const m of members) m.ranking.paretoFront = front;
    remaining = remaining.filter((r) => !members.includes(r));
    front += 1;
  }
  const order = (a: RankedRecord, b: RankedRecord) => (a.ranking.paretoFront ?? 1e9) - (b.ranking.paretoFront ?? 1e9) || (b.ranking.weighted ?? 0) - (a.ranking.weighted ?? 0) || records.indexOf(a) - records.indexOf(b);
  const ordered = [...eligible].sort(order);
  ordered.forEach((r, i) => (r.ranking.position = i + 1));
  const frontMembers = ordered.filter((r) => r.ranking.paretoFront === 1);

  const objectives: ObjectiveSummary[] = prefs.map((p, i) => {
    const def = PROPERTY_BY_KEY.get(p.property);
    let best: ObjectiveSummary["best"] = null;
    for (const r of eligible) {
      const o = r.ranking.objectives[i]!;
      if (o.score !== null && (best === null || o.score > (eligible.find((x) => x.candidate.id === best!.id)!.ranking.objectives[i]!.score ?? -1))) best = { id: r.candidate.id, name: r.candidate.name, value: o.value! };
    }
    return { preferenceId: p.id, property: p.property, label: def?.label ?? p.property, unit: def?.unit ?? null, direction: p.direction, min: bounds[i]!.min, max: bounds[i]!.max, best };
  });
  if (prefs.length && eligible.length === 0) notes.push("No candidate is eligible for ranking: none passed the hard constraints with every preferred property available.");
  if (frontMembers.length > 1) notes.push(`${frontMembers.length} candidates are Pareto-optimal: each is best on some trade-off; the weighted order among them follows your weights.`);
  if (candidatesForRanking.length > withValues.length) notes.push(`${candidatesForRanking.length - withValues.length} admitted candidate(s) lack a value for a preferred property and are not ranked.`);
  return { records: ranked, ordered, front: frontMembers, objectives, population: eligible.length, notes };
}
