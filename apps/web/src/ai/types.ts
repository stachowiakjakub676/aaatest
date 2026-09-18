/**
 * AI assistant architecture (phase 7).
 *
 * The chain is strictly one-directional:
 *   deterministic chemistry  ->  AnalysisReport (structured facts)  ->  ExplanationService (prose)
 * The assistant never touches the molecule. Anything it wants changed is a Suggestion made of
 * structured EditOperations that the editor validates and applies only after the user confirms
 * (as an ordinary undoable command).
 */
import type { BondOrder, Molecule, ValidationResult } from "@molecular-cad/molecule-model";
import type { ComputedProperties, EngineValidation, Prediction, StereoInfo } from "../chemistry/engine";

export type EditOperation =
  | { op: "setElement"; atomId: string; element: string }
  | { op: "setCharge"; atomId: string; charge: number }
  | { op: "removeAtom"; atomId: string }
  | { op: "removeBond"; bondId: string }
  | { op: "setBondOrder"; bondId: string; order: BondOrder }
  | { op: "addBondedAtom"; anchorId: string; element: string; order?: BondOrder }
  | { op: "addHydrogens"; atomId?: string }
  | { op: "tidy" };

export const EDIT_OPS: ReadonlySet<EditOperation["op"]> = new Set(["setElement", "setCharge", "removeAtom", "removeBond", "setBondOrder", "addBondedAtom", "addHydrogens", "tidy"]);

export interface Suggestion {
  id: string;
  title: string;
  rationale: string;
  /** "rule" = deterministic rule in this app; "llm" = language model (must be validated). */
  source: "rule" | "llm";
  operations: EditOperation[];
}

export interface RuleCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

/** Structured, deterministic input for the explanation layer. Every number is COMPUTED. */
export interface AnalysisReport {
  kind: "computed";
  molecule: {
    name: string;
    formulaExplicit: string;
    formulaWithImplicitH: string;
    molecularWeight: number | null;
    atomCount: number;
    heavyAtomCount: number;
    bondCount: number;
    netCharge: number;
    ringCount: number;
    elementCounts: Record<string, number>;
    functionalGroups: string[];
  };
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  engine: {
    source: string;
    canonicalSmiles: string;
    inchiKey: string | null;
    descriptors: Record<string, { label: string; value: number; unit: string }>;
  } | null;
  engineValidation: { valid: boolean; issues: string[] } | null;
  /** Rule evaluations on computed numbers (e.g. Lipinski's rule of five). Not predictions. */
  ruleChecks: RuleCheck[];
  /** Deterministic observations about the structure (fragments, charges, stereo, flexibility). */
  observations: string[];
  /** Model estimates, each PREDICTED with its model, error statement and reasoning. */
  estimates: EstimateSummary[];
  /** Optional summary of the rule-based synthesis plan (class-level reaction names only). */
  synthesis: string[] | null;
  suggestions: Suggestion[];
}

export interface EstimateSummary {
  kind: "predicted";
  id: string;
  label: string;
  value: number | string;
  unit: string | null;
  model: string;
  uncertainty: string | null;
  reasoning: string[];
}

export interface AnalysisInput {
  molecule: Molecule;
  validation: ValidationResult;
  engineValidation: EngineValidation | null;
  properties: ComputedProperties | null;
  stereo?: StereoInfo | null;
  predictions?: Prediction[];
  /** Forward steps of the best rule-based route, already rendered as sentences. */
  synthesis?: string[] | null;
}

export interface MoleculeAnalysisService {
  readonly label: string;
  analyze(input: AnalysisInput): AnalysisReport;
}

export interface Explanation {
  kind: "explanation";
  /** e.g. "built-in templates" or "claude-opus-5 via server" */
  source: string;
  text: string;
  /** Suggestions proposed by the explainer; already validated against the molecule. */
  suggestions: Suggestion[];
  disclaimer: string;
}

export interface ExplanationService {
  readonly id: string;
  readonly label: string;
  /** Explain the whole report, or answer one question about it. */
  explain(report: AnalysisReport, question?: string): Promise<Explanation>;
}

export const EXPLANATION_DISCLAIMER =
  "The assistant explains numbers produced by the deterministic chemistry layer. It does not measure or predict anything itself, and it cannot change the structure: every suggestion needs your confirmation.";
