/**
 * Chemistry engine backed by services/api (FastAPI + Python chem-core).
 */
import { moleculeFromObject } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { ChemistryEngine, ComputedProperties, Descriptor, EngineValidation, FromSmilesOptions, FromSmilesResult, OptimizedGeometry } from "./engine";
import { EngineError } from "./engine";

export class RemoteRdkitEngine implements ChemistryEngine {
  readonly id = "rdkit-server";
  readonly label = "RDKit server (FastAPI)";
  readonly capabilities = { validate: true, properties: true, optimizeGeometry: true, smiles: true };

  constructor(
    public readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  private url(path: string): string {
    return this.baseUrl.replace(/\/+$/, "") + path;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(path), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) {
      throw new EngineError(`Server unreachable at ${this.baseUrl}: ${(e as Error).message}`);
    }
    const data = (await res.json().catch(() => ({}))) as { detail?: unknown };
    if (!res.ok) {
      const detail = data.detail;
      if (detail && typeof detail === "object" && "validation" in detail) {
        const d = detail as { message: string; validation: EngineValidation };
        throw new EngineError(d.message, d.validation);
      }
      throw new EngineError(typeof detail === "string" ? detail : `Server error ${res.status}`);
    }
    return data as T;
  }

  async ready(): Promise<{ version: string }> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url("/health"));
    } catch (e) {
      throw new EngineError(`Server unreachable at ${this.baseUrl}: ${(e as Error).message}`);
    }
    if (!res.ok) throw new EngineError(`Server health check failed (${res.status})`);
    const data = (await res.json()) as { rdkitVersion?: string };
    return { version: data.rdkitVersion ?? "unknown" };
  }

  async validate(mol: Molecule): Promise<EngineValidation> {
    if (mol.atoms.length === 0) return { valid: true, issues: [] };
    return this.post<EngineValidation>("/validate", { molecule: mol });
  }

  async properties(mol: Molecule): Promise<ComputedProperties> {
    if (mol.atoms.length === 0) throw new EngineError("Empty molecule.");
    const r = await this.post<{
      source: string;
      canonicalSmiles: string;
      inchi?: string;
      inchiKey?: string;
      molecularWeight: number;
      exactMass: number;
      descriptors: Record<string, Descriptor>;
    }>("/properties", { molecule: mol });
    const out: ComputedProperties = {
      kind: "computed",
      source: `${r.source} (server)`,
      canonicalSmiles: r.canonicalSmiles,
      molecularWeight: r.molecularWeight,
      exactMass: r.exactMass,
      descriptors: r.descriptors,
    };
    if (r.inchi) out.inchi = r.inchi;
    if (r.inchiKey) out.inchiKey = r.inchiKey;
    return out;
  }

  async optimizeGeometry(mol: Molecule, opts: { embed?: boolean } = {}): Promise<OptimizedGeometry> {
    const r = await this.post<{ source: string; molecule: unknown; forceField: string; converged: boolean; energy: number; energyUnit: string }>("/optimize", {
      molecule: mol,
      embed: opts.embed ?? false,
    });
    const optimized = moleculeFromObject(r.molecule);
    // Keep the caller's identity/metadata; only coordinates come from the engine.
    const positions = new Map(optimized.atoms.map((a) => [a.id, a.position]));
    const molecule: Molecule = { ...mol, atoms: mol.atoms.map((a) => ({ ...a, position: positions.get(a.id) ?? a.position })) };
    return { kind: "computed", source: `${r.source} (server)`, molecule, forceField: r.forceField, converged: r.converged, energy: r.energy, energyUnit: r.energyUnit };
  }

  async fromSmiles(smiles: string, opts: FromSmilesOptions = {}): Promise<FromSmilesResult> {
    const r = await this.post<{ source: string; molecule: unknown }>("/from_smiles", { smiles: smiles.trim(), add_hydrogens: opts.addHydrogens ?? true, name: opts.name ?? null });
    const molecule = moleculeFromObject(r.molecule);
    return { kind: "computed", source: `${r.source} (server)`, molecule, coordinateNote: "3D conformer from ETKDG + force-field relaxation; stereochemistry in the SMILES is honoured." };
  }

  async toSmiles(mol: Molecule): Promise<string> {
    if (mol.atoms.length === 0) throw new EngineError("Empty molecule.");
    const r = await this.post<{ smiles: string }>("/to_smiles", { molecule: mol });
    return r.smiles;
  }
}
