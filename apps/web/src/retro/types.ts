/**
 * Retrosynthesis abstraction (phase 8).
 *
 * This is a research-oriented interface for *conceptual* disconnection analysis. It exists so a
 * future module can plug in without rewriting the application. The bundled implementation is a
 * mock: it proposes which bonds one might disconnect and what fragments result, and nothing
 * else. No reagents, conditions, quantities, yields or procedures exist anywhere in this data
 * model, and the SafetyPolicy strips such fields from any future implementation's output.
 */
import type { FunctionalGroup, Molecule } from "@molecular-cad/molecule-model";

export interface TargetAnalysis {
  kind: "computed";
  heavyAtomCount: number;
  ringCount: number;
  functionalGroups: FunctionalGroup[];
  /** Acyclic bonds between heavy atoms: the only bonds the mock considers. */
  disconnectableBondCount: number;
  notes: string[];
}

export interface Fragment {
  atomIds: string[];
  heavyAtomCount: number;
  /** Canonical SMILES of the H-capped fragment, when the chemistry engine could produce one. */
  smiles: string | null;
}

export interface DisconnectionCandidate {
  id: string;
  bondId: string;
  /** Conceptual strategy label, e.g. "Ester C(=O)–O disconnection". */
  strategy: string;
  description: string;
  fragments: Fragment[];
  /** Heuristic score (mock). Higher = preferred. */
  score: number;
  rank: number;
  rationale: string[];
}

export interface RetrosynthesisService {
  readonly id: string;
  readonly label: string;
  /** Plain-language statement of what this implementation does and does not produce. */
  readonly disclaimer: string;
  analyzeTarget(target: Molecule): Promise<TargetAnalysis>;
  generateCandidates(target: Molecule, analysis: TargetAnalysis): Promise<DisconnectionCandidate[]>;
  rankCandidates(candidates: DisconnectionCandidate[]): Promise<DisconnectionCandidate[]>;
}

export interface SafetyDecision {
  allowed: boolean;
  reason?: string;
}

/** Gate every candidate before it reaches the UI. */
export interface SafetyPolicy {
  readonly label: string;
  screen(candidate: DisconnectionCandidate): SafetyDecision;
}

/** Keys that must never appear in candidate data, whatever implementation produced it. */
export const FORBIDDEN_CANDIDATE_KEYS = ["reagents", "conditions", "procedure", "protocol", "temperature", "solvent", "yield", "quantity", "steps"] as const;

export const NO_OPERATIONAL_DETAILS_POLICY: SafetyPolicy = {
  label: "No operational details",
  screen(candidate) {
    const found = Object.keys(candidate as unknown as Record<string, unknown>).filter((k) => (FORBIDDEN_CANDIDATE_KEYS as readonly string[]).includes(k));
    return found.length ? { allowed: false, reason: `candidate carries operational fields (${found.join(", ")})` } : { allowed: true };
  },
};
