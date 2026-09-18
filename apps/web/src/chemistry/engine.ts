/**
 * ChemistryEngine: the client's contract with a deterministic chemistry backend.
 *
 * Two implementations exist: RDKit compiled to WebAssembly (runs in the browser, works offline
 * on an iPad) and the FastAPI service wrapping the Python chem-core (more capable: geometry
 * optimisation). Everything an engine returns is COMPUTED: it follows deterministically from
 * the structure. Model predictions (phase 7) go through the separate PredictionService and are
 * always labelled PREDICTED.
 */
import type { Molecule } from "@molecular-cad/molecule-model";

export type ResultKind = "computed" | "predicted";

export interface EngineIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  atomIds?: string[];
}

export interface EngineValidation {
  valid: boolean;
  issues: EngineIssue[];
}

export interface Descriptor {
  label: string;
  unit: string;
  value: number;
}

export interface ComputedProperties {
  kind: "computed";
  /** e.g. "rdkit-wasm 2026.03.6" or "rdkit 2026.03.6 (server)" */
  source: string;
  canonicalSmiles: string;
  inchi?: string;
  inchiKey?: string;
  molecularWeight?: number;
  exactMass?: number;
  descriptors: Record<string, Descriptor>;
}

export interface OptimizedGeometry {
  kind: "computed";
  source: string;
  molecule: Molecule;
  forceField: string;
  converged: boolean;
  energy: number;
  energyUnit: string;
}

export interface EngineCapabilities {
  validate: boolean;
  properties: boolean;
  optimizeGeometry: boolean;
  /** SMILES import produces stereo-correct 3D (server) or a 3D sketch (WASM). */
  smiles: boolean;
  /** CIP stereo labels perceived from 3D coordinates. */
  stereo: boolean;
  /** Model-based estimates (QED, synthetic accessibility) beyond descriptor regressions. */
  estimates: boolean;
}

export interface StereoInfo {
  kind: "computed";
  source: string;
  /** "?" marks a stereocentre whose configuration could not be assigned. */
  atoms: Array<{ atomId: string; label: "R" | "S" | "r" | "s" | "?" }>;
  bonds: Array<{ bondId: string; label: "E" | "Z" }>;
}

export interface FromSmilesOptions {
  addHydrogens?: boolean;
  name?: string;
}

export interface FromSmilesResult {
  kind: "computed";
  source: string;
  molecule: Molecule;
  /** Honest statement of what the coordinates are (e.g. "ETKDG 3D" vs "2D layout + sketch clean-up"). */
  coordinateNote: string;
}

export interface ChemistryEngine {
  readonly id: string;
  readonly label: string;
  readonly capabilities: EngineCapabilities;
  /** Resolves once the engine can accept requests (loads WASM / checks the server). */
  ready(): Promise<{ version: string }>;
  validate(mol: Molecule): Promise<EngineValidation>;
  properties(mol: Molecule): Promise<ComputedProperties>;
  optimizeGeometry(mol: Molecule, opts?: { embed?: boolean }): Promise<OptimizedGeometry>;
  fromSmiles(smiles: string, opts?: FromSmilesOptions): Promise<FromSmilesResult>;
  toSmiles(mol: Molecule): Promise<string>;
  stereo(mol: Molecule): Promise<StereoInfo>;
  /** PREDICTED items from the engine's models (empty when the engine has none). */
  estimates(mol: Molecule): Promise<Prediction[]>;
}

export class EngineError extends Error {
  constructor(
    message: string,
    public readonly validation?: EngineValidation,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

/**
 * Placeholder for phase 7. A prediction service returns model outputs that must be shown as
 * PREDICTED with their provenance and uncertainty, never as measurements.
 */
export interface Prediction {
  kind: "predicted";
  id: string;
  /** Model name with citation, e.g. "ESOL (Delaney, J. Chem. Inf. Comput. Sci. 2004)". */
  model: string;
  label: string;
  value: number | string;
  unit?: string;
  /** Plain statement of the model's known error or scale. */
  uncertainty?: string;
}

export interface PredictionService {
  readonly label: string;
  predict(mol: Molecule): Promise<Prediction[]>;
}

/** No models are configured in this prototype; the UI states that explicitly. */
export const NO_PREDICTIONS: PredictionService = {
  label: "No prediction models configured",
  async predict() {
    return [];
  },
};
