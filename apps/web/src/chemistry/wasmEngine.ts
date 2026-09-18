/**
 * RDKit in the browser via the official @rdkit/rdkit WebAssembly build (RDKit MinimalLib).
 * Molecules travel as MOL V2000 blocks written by molecule-model. The MinimalLib has no force
 * fields or 3D embedding, so optimizeGeometry is reported as unsupported.
 */
import { cleanupGeometry, molecularWeight, parseMolfile, writeMolfile } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { ChemistryEngine, ComputedProperties, Descriptor, EngineIssue, EngineValidation, FromSmilesOptions, FromSmilesResult, OptimizedGeometry, Prediction, StereoInfo } from "./engine";
import { EngineError } from "./engine";

// Minimal structural typing of the parts of the RDKit JS API we use.
export interface RDKitMol {
  is_valid(): boolean;
  get_smiles(): string;
  get_inchi(): string;
  get_descriptors(): string;
  get_molblock(details?: string): string;
  get_stereo_tags(): string;
  get_num_atoms(): number;
  add_hs_in_place(): boolean;
  remove_hs_in_place(): boolean;
  set_new_coords(): boolean;
  delete(): void;
}
export interface RDKitLog {
  get_buffer(): string;
  clear_buffer(): void;
  delete(): void;
}
export interface RDKitModule {
  version(): string;
  get_mol(input: string, details?: string): RDKitMol | null;
  get_inchikey_for_inchi(inchi: string): string;
  set_log_capture?(name: string): RDKitLog | null;
  enable_logging?(): void;
}

export type RDKitLoader = () => Promise<RDKitModule>;

declare global {
  interface Window {
    initRDKitModule?: (opts?: Record<string, unknown>) => Promise<RDKitModule>;
    /** Set by the single-file build so the WASM needs no network fetch. */
    __RDKIT_WASM_BASE64?: string;
  }
}

/** Curated descriptor subset, aligned with the Python engine's keys and labels. */
const DESCRIPTOR_MAP: Array<[rdkitKey: string, key: string, label: string, unit: string]> = [
  ["exactmw", "exactMass", "Exact mass", "Da"],
  ["NumHeavyAtoms", "heavyAtomCount", "Heavy atoms", ""],
  ["NumRings", "ringCount", "Rings", ""],
  ["NumAromaticRings", "aromaticRingCount", "Aromatic rings", ""],
  ["NumRotatableBonds", "rotatableBonds", "Rotatable bonds", ""],
  ["lipinskiHBD", "hBondDonors", "H-bond donors (Lipinski NH+OH)", ""],
  ["lipinskiHBA", "hBondAcceptors", "H-bond acceptors (Lipinski N+O)", ""],
  ["tpsa", "tpsa", "Topological polar surface area", "Å²"],
  ["CrippenClogP", "cLogP", "Crippen cLogP", ""],
  ["FractionCSP3", "fractionCsp3", "Fraction Csp3", ""],
  ["NumAtomStereoCenters", "stereoCenters", "Stereocentres", ""],
];

/** Browser loader: reuses a preloaded module, otherwise injects the glue script next to the page. */
export function browserRDKitLoader(baseUrl = "./rdkit/"): RDKitLoader {
  return async () => {
    if (!window.initRDKitModule) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = new URL(`${baseUrl}RDKit_minimal.js`, document.baseURI).href;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Could not load RDKit_minimal.js"));
        document.head.appendChild(s);
      });
    }
    const init = window.initRDKitModule;
    if (!init) throw new Error("RDKit loader did not register initRDKitModule");
    const opts: Record<string, unknown> = {};
    if (window.__RDKIT_WASM_BASE64) {
      // Embedded build: instantiate from bytes via Emscripten's instantiateWasm hook. No fetch at
      // all, so this works from file:// and under strict content-security policies.
      const bin = atob(window.__RDKIT_WASM_BASE64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      opts.instantiateWasm = (imports: WebAssembly.Imports, done: (instance: WebAssembly.Instance, module?: WebAssembly.Module) => void) => {
        WebAssembly.instantiate(bytes, imports).then((r) => done(r.instance, r.module)).catch((e) => console.error("RDKit wasm instantiation failed", e));
        return {};
      };
    } else {
      opts.locateFile = (file: string) => new URL(`${baseUrl}${file}`, document.baseURI).href;
    }
    return init(opts);
  };
}

export class WasmRdkitEngine implements ChemistryEngine {
  readonly id = "rdkit-wasm";
  readonly label = "RDKit in browser (WebAssembly)";
  readonly capabilities = { validate: true, properties: true, optimizeGeometry: false, smiles: true, stereo: true, estimates: false };
  private modulePromise: Promise<RDKitModule> | null = null;
  private version = "";
  private log: RDKitLog | null = null;

  constructor(private readonly loader: RDKitLoader) {}

  private module(): Promise<RDKitModule> {
    if (!this.modulePromise) {
      this.modulePromise = this.loader().then((m) => {
        this.version = m.version();
        this.log = m.set_log_capture?.("rdApp.error") ?? null;
        return m;
      });
    }
    return this.modulePromise;
  }

  async ready(): Promise<{ version: string }> {
    await this.module();
    return { version: this.version };
  }

  private takeLog(): string {
    if (!this.log) return "";
    const text = this.log.get_buffer();
    this.log.clear_buffer();
    return text;
  }

  /** Parse (sanitising) a molecule; returns null plus the RDKit error text on failure. */
  private async parse(mol: Molecule): Promise<{ rd: RDKitMol | null; error: string }> {
    const RDKit = await this.module();
    this.takeLog();
    const rd = RDKit.get_mol(writeMolfile(mol), JSON.stringify({ removeHs: false }));
    const error = this.takeLog().trim();
    if (rd && !rd.is_valid()) {
      rd.delete();
      return { rd: null, error: error || "RDKit rejected the structure." };
    }
    return { rd, error };
  }

  async validate(mol: Molecule): Promise<EngineValidation> {
    if (mol.atoms.length === 0) return { valid: true, issues: [] };
    const { rd, error } = await this.parse(mol);
    if (rd) {
      rd.delete();
      return { valid: true, issues: [] };
    }
    return { valid: false, issues: issuesFromLog(error, mol) };
  }

  async properties(mol: Molecule): Promise<ComputedProperties> {
    if (mol.atoms.length === 0) throw new EngineError("Empty molecule.");
    const RDKit = await this.module();
    const { rd, error } = await this.parse(mol);
    if (!rd) throw new EngineError("Structure does not sanitise; fix validation errors first.", { valid: false, issues: issuesFromLog(error, mol) });
    try {
      const raw = JSON.parse(rd.get_descriptors()) as Record<string, number>;
      const descriptors: Record<string, Descriptor> = {};
      for (const [rdKey, key, label, unit] of DESCRIPTOR_MAP) {
        const v = raw[rdKey];
        if (typeof v === "number" && Number.isFinite(v)) descriptors[key] = { label, unit, value: Math.round(v * 10000) / 10000 };
      }
      let inchi = "";
      let inchiKey = "";
      try {
        inchi = rd.get_inchi();
        inchiKey = inchi ? RDKit.get_inchikey_for_inchi(inchi) : "";
      } catch {
        /* InChI is optional */
      }
      const mw = molecularWeight(mol, { includeImplicitHydrogens: true });
      // Descriptors and InChI were computed with explicit hydrogens; the SMILES is reported
      // heavy-atom only, matching the server engine and common practice.
      rd.remove_hs_in_place();
      const out: ComputedProperties = {
        kind: "computed",
        source: `rdkit-wasm ${this.version}`,
        canonicalSmiles: rd.get_smiles(),
        descriptors,
      };
      if (inchi) out.inchi = inchi;
      if (inchiKey) out.inchiKey = inchiKey;
      if (mw.value !== undefined) out.molecularWeight = Math.round(mw.value * 10000) / 10000;
      if (typeof raw.exactmw === "number") out.exactMass = Math.round(raw.exactmw * 1e6) / 1e6;
      return out;
    } finally {
      rd.delete();
    }
  }

  async optimizeGeometry(): Promise<OptimizedGeometry> {
    throw new EngineError("Geometry optimisation needs the server engine (RDKit force fields are not part of the WebAssembly build).");
  }

  /**
   * SMILES -> molecule. The WASM build has no 3D embedding, so RDKit lays the structure out in
   * 2D and the sketch clean-up lifts it into 3D. Stereocentres are therefore not guaranteed.
   */
  async fromSmiles(smiles: string, opts: FromSmilesOptions = {}): Promise<FromSmilesResult> {
    const RDKit = await this.module();
    this.takeLog();
    const rd = RDKit.get_mol(smiles.trim());
    const error = this.takeLog().trim();
    if (!rd || !rd.is_valid()) {
      rd?.delete();
      throw new EngineError(`RDKit could not parse this SMILES${error ? `: ${error.replace(/^\[[^\]]*\]\s*/gm, "")}` : "."}`);
    }
    try {
      if (opts.addHydrogens ?? true) rd.add_hs_in_place();
      rd.set_new_coords();
      const molblock = rd.get_molblock();
      const parsed = parseMolfile(molblock, { id: "imported" });
      const cleaned = cleanupGeometry(parsed, { jitter: 0.6, maxIterations: 600 });
      const molecule: Molecule = {
        ...cleaned.molecule,
        metadata: { source: "smiles", smiles: smiles.trim(), coordinates: "rdkit-wasm 2D layout + sketch clean-up" },
      };
      if (opts.name) molecule.name = opts.name;
      else delete molecule.name;
      return { kind: "computed", source: `rdkit-wasm ${this.version}`, molecule, coordinateNote: "2D layout lifted into 3D by the sketch clean-up; stereocentres are not guaranteed. Use the server engine for ETKDG 3D." };
    } finally {
      rd.delete();
    }
  }

  async toSmiles(mol: Molecule): Promise<string> {
    if (mol.atoms.length === 0) throw new EngineError("Empty molecule.");
    const { rd, error } = await this.parse(mol);
    if (!rd) throw new EngineError("Structure does not sanitise; fix validation errors first.", { valid: false, issues: issuesFromLog(error, mol) });
    try {
      rd.remove_hs_in_place();
      return rd.get_smiles();
    } finally {
      rd.delete();
    }
  }

  /** CIP labels: RDKit perceives them from the 3D molblock we send. */
  async stereo(mol: Molecule): Promise<StereoInfo> {
    const empty: StereoInfo = { kind: "computed", source: `rdkit-wasm ${this.version}`, atoms: [], bonds: [] };
    if (mol.atoms.length === 0) return empty;
    const { rd, error } = await this.parse(mol);
    if (!rd) throw new EngineError("Structure does not sanitise; fix validation errors first.", { valid: false, issues: issuesFromLog(error, mol) });
    try {
      const tags = JSON.parse(rd.get_stereo_tags()) as { CIP_atoms?: Array<[number, string]>; CIP_bonds?: Array<[number, number, string]> };
      const atomIds = mol.atoms.map((a) => a.id);
      const bondIdBetween = (i: number, j: number) => mol.bonds.find((b) => (b.atomA === atomIds[i] && b.atomB === atomIds[j]) || (b.atomA === atomIds[j] && b.atomB === atomIds[i]))?.id;
      const atoms: StereoInfo["atoms"] = [];
      for (const [idx, raw] of tags.CIP_atoms ?? []) {
        const label = raw.replace(/[()]/g, "");
        const id = atomIds[idx];
        if (id && (label === "R" || label === "S" || label === "r" || label === "s" || label === "?")) atoms.push({ atomId: id, label });
      }
      const bonds: StereoInfo["bonds"] = [];
      for (const [i, j, raw] of tags.CIP_bonds ?? []) {
        const label = raw.replace(/[()]/g, "");
        const id = bondIdBetween(i, j);
        if (id && (label === "E" || label === "Z")) bonds.push({ bondId: id, label });
      }
      return { ...empty, atoms, bonds };
    } finally {
      rd.delete();
    }
  }

  async estimates(): Promise<Prediction[]> {
    return []; // QED / SA score need the server engine; ESOL runs client-side in predictions.ts
  }
}

/** Turn RDKit's error log into structured issues, mapping "atom # N" back to the client's atom ids. */
export function issuesFromLog(log: string, mol: Molecule): EngineIssue[] {
  const lines = log
    .split("\n")
    .map((l) => l.replace(/^\[[^\]]*\]\s*/, "").trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [{ code: "RDKIT_SANITIZE", severity: "error", message: "RDKit could not sanitise the structure." }];
  return lines.map((message) => {
    const m = /atom\s*#\s*(\d+)/i.exec(message);
    const issue: EngineIssue = {
      code: /valence/i.test(message) ? "RDKIT_VALENCE" : /kekul/i.test(message) ? "RDKIT_KEKULIZE" : "RDKIT_SANITIZE",
      severity: "error",
      message,
    };
    if (m) {
      const atom = mol.atoms[parseInt(m[1]!, 10)];
      if (atom) issue.atomIds = [atom.id];
    }
    return issue;
  });
}
