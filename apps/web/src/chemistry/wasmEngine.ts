/**
 * RDKit in the browser via the official @rdkit/rdkit WebAssembly build (RDKit MinimalLib).
 * Molecules travel as MOL V2000 blocks written by molecule-model. The MinimalLib has no force
 * fields or 3D embedding, so optimizeGeometry is reported as unsupported.
 */
import { molecularWeight, writeMolfile } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { ChemistryEngine, ComputedProperties, Descriptor, EngineIssue, EngineValidation, OptimizedGeometry } from "./engine";
import { EngineError } from "./engine";

// Minimal structural typing of the parts of the RDKit JS API we use.
export interface RDKitMol {
  is_valid(): boolean;
  get_smiles(): string;
  get_inchi(): string;
  get_descriptors(): string;
  get_num_atoms(): number;
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
  readonly capabilities = { validate: true, properties: true, optimizeGeometry: false };
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
