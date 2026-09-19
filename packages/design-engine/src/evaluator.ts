/**
 * Property evaluation and filtering (phase 3C). An evaluator turns a molecule into a candidate
 * profile through the chemistry engines and models; this module drives it over a run's valid
 * candidates with a cache keyed by canonical SMILES (identical structures are evaluated once),
 * applies the specification and records, per candidate, every requirement's verdict and reason.
 * No value is invented here: what the tools do not supply stays unknown.
 */
import type { Molecule } from "@molecular-cad/molecule-model";
import type { Candidate } from "./candidates";
import { evaluateSpecification } from "./evaluation";
import type { CandidateProfile, CheckStatus, EvaluationOptions } from "./evaluation";
import { summariseRun, validateCandidates } from "./run";
import type { CandidateRecord, DesignRun, StructureTools } from "./run";
import type { Specification } from "./specification";

export interface CandidateEvaluator {
  /** Models and tables the evaluator uses (recorded in the run's provenance). */
  readonly models: string[];
  profile(molecule: Molecule): Promise<CandidateProfile>;
}

/** Cache of profiles by canonical SMILES; shared across runs within a session. */
export type ProfileCache = Map<string, Promise<CandidateProfile>>;

export interface EvaluationSummary {
  evaluated: number;
  passed: number;
  borderline: number;
  failed: number;
  undecided: number;
  /** Profiles served from the cache instead of computed. */
  cacheHits: number;
}

export interface EvaluatedRun extends DesignRun {
  evaluation: EvaluationSummary;
  evaluationOptions: EvaluationOptions;
}

/** Evaluate every valid record of a run; rejected records are left untouched. */
export async function evaluateRun(run: DesignRun, evaluator: CandidateEvaluator, cache: ProfileCache, options: EvaluationOptions = {}, onProgress?: (done: number, total: number) => void): Promise<EvaluatedRun> {
  // Valid records have already passed the engine's substructure checks.
  const opts: EvaluationOptions = { ...options, substructuresVerified: true };
  const valid = run.records.filter((r) => r.status === "valid");
  let cacheHits = 0;
  let done = 0;
  const records: CandidateRecord[] = [];
  for (const r of run.records) {
    if (r.status !== "valid") {
      records.push(r);
      continue;
    }
    const key = r.canonicalSmiles ?? r.candidate.id;
    let p = cache.get(key);
    if (p) cacheHits += 1;
    else {
      p = evaluator.profile(r.candidate.molecule);
      cache.set(key, p);
    }
    let profile: CandidateProfile;
    try {
      profile = await p;
    } catch (e) {
      cache.delete(key);
      records.push({ ...r, profile: {}, evaluation: evaluateSpecification(run.specification, {}, r.candidate.molecule, opts), evaluationError: e instanceof Error ? e.message : String(e) });
      done += 1;
      onProgress?.(done, valid.length);
      continue;
    }
    records.push({ ...r, profile, evaluation: evaluateSpecification(run.specification, profile, r.candidate.molecule, opts) });
    done += 1;
    onProgress?.(done, valid.length);
  }
  const count = (s: CheckStatus) => records.filter((r) => r.evaluation?.overall === s).length;
  const models = [...new Set([...(run.provenance?.models ?? []), ...evaluator.models])];
  return {
    ...run,
    records,
    provenance: { ...run.provenance, app: run.provenance?.app ?? "unknown", engine: run.provenance?.engine ?? "unknown", models },
    finishedAt: new Date().toISOString(),
    evaluationOptions: { margins: opts.margins ?? true, substructuresVerified: true },
    evaluation: { evaluated: valid.length, passed: count("pass"), borderline: count("borderline"), failed: count("fail"), undecided: count("unknown"), cacheHits },
  };
}

export type CandidateFilter = "all" | "passing" | "passing-or-borderline" | "failing" | "undecided" | "rejected";

/** Which records a filter keeps; "passing" means every hard requirement passed. */
export function filterRecords(records: CandidateRecord[], filter: CandidateFilter): CandidateRecord[] {
  switch (filter) {
    case "all":
      return records;
    case "rejected":
      return records.filter((r) => r.status === "rejected");
    case "passing":
      return records.filter((r) => r.evaluation?.overall === "pass");
    case "passing-or-borderline":
      return records.filter((r) => r.evaluation?.overall === "pass" || r.evaluation?.overall === "borderline");
    case "failing":
      return records.filter((r) => r.evaluation?.overall === "fail");
    case "undecided":
      return records.filter((r) => r.evaluation?.overall === "unknown");
  }
}

/** One line saying why a candidate is not a clean pass (first failing, then borderline, then unknown requirement). */
export function verdictReason(r: CandidateRecord): string | null {
  const ev = r.evaluation;
  if (!ev) return r.rejection ? `${r.rejection.stage}: ${r.rejection.reason}` : null;
  const all = [...ev.constraints.map((c) => ({ status: c.status, text: `${c.requirement} — ${c.reason}` })), ...ev.structural.map((s) => ({ status: s.status, text: `${s.rule} — ${s.reason}` }))];
  const pick = (s: CheckStatus) => all.find((x) => x.status === s)?.text ?? null;
  return pick("fail") ?? pick("borderline") ?? pick("unknown");
}

function summariseEvaluation(records: CandidateRecord[], cacheHits: number): EvaluationSummary {
  const count = (s: CheckStatus) => records.filter((r) => r.evaluation?.overall === s).length;
  return { evaluated: records.filter((r) => r.status === "valid").length, passed: count("pass"), borderline: count("borderline"), failed: count("fail"), undecided: count("unknown"), cacheHits };
}

/**
 * Iteration: validate and evaluate extra candidates (e.g. edited by hand) against the run's own
 * specification snapshot and append them; duplicates of structures already in the run are rejected.
 */
export async function appendCandidates(run: EvaluatedRun, candidates: Candidate[], tools: StructureTools, evaluator: CandidateEvaluator, cache: ProfileCache): Promise<EvaluatedRun> {
  const seen = new Map<string, string>();
  for (const r of run.records) if (r.canonicalSmiles && r.status === "valid") seen.set(r.canonicalSmiles, r.candidate.name);
  if (candidates.length === 0) return run;
  const validated = await validateCandidates({ ...run, records: [] }, candidates, tools, undefined, seen);
  const evaluated = await evaluateRun(validated, evaluator, cache, run.evaluationOptions ?? {});
  const records = [...run.records, ...evaluated.records];
  const merged = summariseRun({ ...run, records, provenance: evaluated.provenance, history: [...(run.history ?? []), `${new Date().toISOString()}: added ${candidates.length} candidate(s) by hand (${evaluated.records.filter((r) => r.status === "valid").length} valid)`] });
  return { ...merged, evaluation: summariseEvaluation(records, (run.evaluation?.cacheHits ?? 0) + evaluated.evaluation.cacheHits) };
}

/**
 * Iteration on the specification: re-apply the hard constraints (and margins) to the existing
 * profiles without recomputing anything. Structural and substructure rules were checked during
 * validation against the old specification; if they changed, the run says so and a new run is
 * the honest answer.
 */
export function reevaluateRun(run: EvaluatedRun, spec: Specification, options: EvaluationOptions = {}): EvaluatedRun {
  const opts: EvaluationOptions = { ...(run.evaluationOptions ?? {}), ...options, substructuresVerified: true };
  const structuralChanged = JSON.stringify(run.specification.structural) !== JSON.stringify(spec.structural);
  const records = run.records.map((r) => (r.status === "valid" && r.profile ? { ...r, evaluation: evaluateSpecification(spec, r.profile, r.candidate.molecule, opts) } : r));
  const note = `${new Date().toISOString()}: re-evaluated against the specification updated at ${spec.updatedAt}${structuralChanged ? " (structural constraints changed: candidates were generated and validated under the previous ones; run again to apply them)" : ""}`;
  return { ...run, specification: JSON.parse(JSON.stringify(spec)) as Specification, records, history: [...(run.history ?? []), note], evaluationOptions: opts, evaluation: summariseEvaluation(records, run.evaluation?.cacheHits ?? 0) };
}

/** True when the specification changed after the run's snapshot was taken. */
export function specificationChanged(run: DesignRun, spec: Specification): boolean {
  return run.specification.updatedAt !== spec.updatedAt || JSON.stringify(run.specification) !== JSON.stringify(spec);
}
