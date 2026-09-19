/**
 * A design run: one execution of generate → validate (→ evaluate → filter → rank in later phases)
 * against a snapshot of the specification, with everything needed to reproduce it: generator and
 * parameters, seed, tool versions, timestamps, and every candidate with its status and the reason
 * for a rejection. Runs serialise to `kind: "clapeyron-design-run"` files.
 */
import { validateMolecule } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { Candidate, GeneratorParams } from "./candidates";
import { structuralRejection } from "./candidates";
import type { CandidateProfile, EvaluationResult } from "./evaluation";
import { newId } from "./specification";
import type { Specification } from "./specification";

export type CandidateStatus = "generated" | "rejected" | "valid";

export type RejectionStage = "structural" | "graph" | "engine" | "duplicate" | "substructure";

export interface CandidateRecord {
  candidate: Candidate;
  status: CandidateStatus;
  rejection?: { stage: RejectionStage; reason: string };
  canonicalSmiles?: string;
  /** Filled by the evaluation stage (phase 3C). */
  profile?: CandidateProfile;
  evaluation?: EvaluationResult;
  /** Set when the evaluator threw for this candidate (its profile is then empty). */
  evaluationError?: string;
}

export interface RunProvenance {
  app: string;
  /** Chemistry engine id and version used for validation and canonical SMILES. */
  engine: string;
  /** Models and tables that produced property values (phase 3C). */
  models: string[];
}

export interface DesignRun {
  id: string;
  createdAt: string;
  finishedAt: string | null;
  specification: Specification;
  generator: { id: string; label: string; params: GeneratorParams };
  seed: { id: string; name: string; atoms: number } | null;
  /** The seed molecule itself, so the run can be repeated exactly. */
  seedMolecule: Molecule | null;
  /** Id of the run this one repeats, if any. */
  repeatOf: string | null;
  provenance: RunProvenance;
  records: CandidateRecord[];
  summary: { generated: number; rejected: number; valid: number };
  /** Rejections by stage, for the report. */
  rejectionsByStage: Record<RejectionStage, number>;
  /** Events after the run finished: manual additions, re-evaluations (with timestamps). */
  history: string[];
}

/** What the validation stage needs from the chemistry engine. */
export interface StructureTools {
  /** Engine-side sanitisation (RDKit): valid, or the issues. */
  validate(mol: Molecule): Promise<{ valid: boolean; issues: string[] }>;
  canonicalSmiles(mol: Molecule): Promise<string>;
  /** True/false for a valid SMARTS; null when the pattern itself does not parse. */
  hasSubstructure(mol: Molecule, smarts: string): Promise<boolean | null>;
}

export function createRun(spec: Specification, generator: { id: string; label: string }, params: GeneratorParams, seed: Molecule | null, provenance: RunProvenance, repeatOf: string | null = null): DesignRun {
  return {
    id: newId("run"),
    createdAt: new Date().toISOString(),
    finishedAt: null,
    specification: JSON.parse(JSON.stringify(spec)) as Specification,
    generator: { id: generator.id, label: generator.label, params: { ...params } },
    seed: seed && seed.atoms.length ? { id: seed.id, name: seed.name ?? seed.id, atoms: seed.atoms.length } : null,
    seedMolecule: seed && seed.atoms.length ? seed : null,
    repeatOf,
    provenance,
    records: [],
    summary: { generated: 0, rejected: 0, valid: 0 },
    rejectionsByStage: { structural: 0, graph: 0, engine: 0, duplicate: 0, substructure: 0 },
    history: [],
  };
}

/** Recompute the counts from the records. */
export function summariseRun<T extends DesignRun>(run: T): T {
  const summary = { generated: run.records.length, rejected: run.records.filter((r) => r.status === "rejected").length, valid: run.records.filter((r) => r.status === "valid").length };
  const rejectionsByStage: DesignRun["rejectionsByStage"] = { structural: 0, graph: 0, engine: 0, duplicate: 0, substructure: 0 };
  for (const r of run.records) if (r.rejection) rejectionsByStage[r.rejection.stage] += 1;
  return { ...run, summary, rejectionsByStage };
}

/**
 * Validation stage: structural scope → graph validity (valence, connectivity) → engine
 * sanitisation → duplicates by canonical SMILES → required/forbidden substructures.
 * Every rejection keeps its stage and reason; nothing invalid reaches the next stage.
 */
export async function validateCandidates(run: DesignRun, candidates: Candidate[], tools: StructureTools, onProgress?: (done: number, total: number) => void, seen: Map<string, string> = new Map()): Promise<DesignRun> {
  const records: CandidateRecord[] = [];
  const st = run.specification.structural;
  let done = 0;
  for (const c of candidates) {
    done += 1;
    const reject = (stage: RejectionStage, reason: string, canonicalSmiles?: string): CandidateRecord => (canonicalSmiles ? { candidate: c, status: "rejected", rejection: { stage, reason }, canonicalSmiles } : { candidate: c, status: "rejected", rejection: { stage, reason } });
    const scope = structuralRejection(st, c.molecule);
    if (scope) {
      records.push(reject("structural", scope));
      continue;
    }
    const graph = validateMolecule(c.molecule);
    if (!graph.valid) {
      records.push(reject("graph", graph.issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ")));
      continue;
    }
    const heavy = c.molecule.atoms.filter((a) => a.element !== "H");
    const reach = new Set<string>();
    const stack = heavy[0] ? [heavy[0].id] : [];
    while (stack.length) {
      const id = stack.pop()!;
      if (reach.has(id)) continue;
      reach.add(id);
      for (const b of c.molecule.bonds) {
        const other = b.atomA === id ? b.atomB : b.atomB === id ? b.atomA : null;
        if (other && !reach.has(other)) stack.push(other);
      }
    }
    if (heavy.some((a) => !reach.has(a.id))) {
      records.push(reject("graph", "disconnected fragments"));
      continue;
    }
    const engine = await tools.validate(c.molecule);
    if (!engine.valid) {
      records.push(reject("engine", engine.issues.join("; ") || "rejected by the chemistry engine"));
      continue;
    }
    let smiles: string;
    try {
      smiles = await tools.canonicalSmiles(c.molecule);
    } catch (e) {
      records.push(reject("engine", e instanceof Error ? e.message : String(e)));
      continue;
    }
    const dup = seen.get(smiles);
    if (dup) {
      records.push(reject("duplicate", `same structure as ${dup}`, smiles));
      continue;
    }
    seen.set(smiles, c.name);
    let subReason: string | null = null;
    for (const p of st.requiredSubstructures) {
      const hit = await tools.hasSubstructure(c.molecule, p);
      if (hit === null) subReason = `pattern "${p}" does not parse`;
      else if (!hit) subReason = `lacks required substructure ${p}`;
      if (subReason) break;
    }
    if (!subReason)
      for (const p of st.forbiddenSubstructures) {
        const hit = await tools.hasSubstructure(c.molecule, p);
        if (hit === null) subReason = `pattern "${p}" does not parse`;
        else if (hit) subReason = `contains forbidden substructure ${p}`;
        if (subReason) break;
      }
    if (subReason) {
      records.push(reject("substructure", subReason, smiles));
      continue;
    }
    records.push({ candidate: c, status: "valid", canonicalSmiles: smiles });
    onProgress?.(done, candidates.length);
  }
  return summariseRun({ ...run, records, finishedAt: new Date().toISOString() });
}

export const DESIGN_RUN_KIND = "clapeyron-design-run";

export function serializeRun(run: DesignRun, pretty = true): string {
  return JSON.stringify({ kind: DESIGN_RUN_KIND, version: 1, run }, null, pretty ? 2 : 0);
}

/** Parse a run file; null when the text is not one. Shape is trusted beyond the kind check (runs are the app's own output). */
export function parseRun(text: string): DesignRun | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || (raw as { kind?: unknown }).kind !== DESIGN_RUN_KIND) return null;
  const run = (raw as { run?: unknown }).run as DesignRun | undefined;
  if (!run || typeof run !== "object" || !Array.isArray(run.records)) return null;
  return { ...run, seedMolecule: run.seedMolecule ?? null, repeatOf: run.repeatOf ?? null, history: Array.isArray(run.history) ? run.history : [] };
}
