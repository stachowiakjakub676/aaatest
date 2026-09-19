/**
 * Candidate generation. A generator produces molecules inside a controlled chemical space and
 * records, for every candidate, exactly how it was made (generator, strategy, parent, operations),
 * so a run can be reproduced. Generators are deterministic; nothing here evaluates properties.
 *
 * Two strategies ship: derivatives of a seed molecule by fragment substitution from the fragment
 * library, and a screen of a named library (building blocks, solvents) supplied by the caller.
 * Further generators (ring systems, scaffold hopping, models) implement the same interface.
 */
import { attachFragment, createMolecule, getAtom, implicitHydrogenCount, neighborsOf, totalFormalCharge } from "@molecular-cad/molecule-model";
import type { FragmentTemplate, Molecule } from "@molecular-cad/molecule-model";
import { newId } from "./specification";
import type { Specification, StructuralConstraints } from "./specification";

export interface CandidateOrigin {
  generator: string;
  strategy: string;
  /** Molecule the candidate was derived from (id and name), if any. */
  parent: { id: string; name: string } | null;
  /** Human-readable steps that produced the candidate, in order. */
  operations: string[];
  /** Library entry the candidate came from, if any. */
  libraryEntry?: { library: string; name: string; smiles: string };
}

export interface Candidate {
  id: string;
  name: string;
  molecule: Molecule;
  origin: CandidateOrigin;
}

export interface LibraryEntry {
  name: string;
  smiles: string;
}

export interface GenerationInput {
  spec: Specification;
  /** Molecule open in the editor (derivative strategies need one). */
  seed: Molecule | null;
  /** Upper bound on generated candidates. */
  limit: number;
  fragments: readonly FragmentTemplate[];
  /** Named libraries the library screen may draw from. */
  libraries: Array<{ name: string; entries: readonly LibraryEntry[] }>;
  /** SMILES → molecule through the chemistry engine (null when it does not parse). */
  parseSmiles(smiles: string, name: string): Promise<Molecule | null>;
}

export interface GeneratorParams {
  [key: string]: string | number | boolean;
}

export interface CandidateGenerator {
  id: string;
  label: string;
  description: string;
  /** Parameters the generator reads from `params`, with defaults (recorded in the run). */
  defaults: GeneratorParams;
  generate(input: GenerationInput, params: GeneratorParams, onProgress?: (done: number, total: number) => void): Promise<Candidate[]>;
}

/** Cheap structural pre-filter on the graph alone; returns the reason a molecule is out of scope, or null. */
export function structuralRejection(st: StructuralConstraints, mol: Molecule): string | null {
  const heavy = mol.atoms.filter((a) => a.element !== "H");
  if (st.allowedElements.length) {
    const bad = [...new Set(heavy.map((a) => a.element))].filter((e) => !st.allowedElements.includes(e));
    if (bad.length) return `contains ${bad.join(", ")} (allowed: ${st.allowedElements.join(", ")})`;
  }
  if (st.minHeavyAtoms !== null && heavy.length < st.minHeavyAtoms) return `${heavy.length} heavy atoms, fewer than ${st.minHeavyAtoms}`;
  if (st.maxHeavyAtoms !== null && heavy.length > st.maxHeavyAtoms) return `${heavy.length} heavy atoms, more than ${st.maxHeavyAtoms}`;
  if (st.neutral && totalFormalCharge(mol) !== 0) return `net charge ${totalFormalCharge(mol)}`;
  return null;
}

/** Heavy atoms that carry at least one hydrogen (explicit or implicit): the substitution sites. */
export function substitutionSites(mol: Molecule, elements: readonly string[] = ["C", "N", "O"]): string[] {
  return mol.atoms
    .filter((a) => elements.includes(a.element))
    .filter((a) => neighborsOf(mol, a.id).some((n) => getAtom(mol, n)?.element === "H") || implicitHydrogenCount(mol, a.id) > 0)
    .map((a) => a.id);
}

function fragmentAllowed(f: FragmentTemplate, st: StructuralConstraints): boolean {
  if (!st.allowedElements.length) return true;
  return f.molecule.atoms.every((a) => a.element === "H" || st.allowedElements.includes(a.element));
}

/** Derivatives of the seed: every substitution site × every library fragment (one attachment). */
export const DERIVATIVE_GENERATOR: CandidateGenerator = {
  id: "derivatives",
  label: "Derivatives of the editor molecule",
  description: "Attaches each library fragment at each hydrogen-bearing C, N or O of the seed; one substitution per candidate. Deterministic order: fragments in library order, each tried at every site (molecule order) before the next fragment. Out-of-scope results are kept and rejected with the reason, not hidden.",
  defaults: { sites: "C,N,O", categories: "alkyl,ring,hetero,group,halogen" },
  async generate(input, params, onProgress) {
    const seed = input.seed;
    if (!seed || seed.atoms.length === 0) return [];
    const st = input.spec.structural;
    const elements = String(params.sites ?? this.defaults.sites).split(",").map((s) => s.trim()).filter(Boolean);
    const categories = new Set(String(params.categories ?? this.defaults.categories).split(",").map((s) => s.trim()).filter(Boolean));
    const fragments = input.fragments.filter((f) => categories.has(f.category) && fragmentAllowed(f, st));
    const sites = substitutionSites(seed, elements);
    const total = sites.length * fragments.length;
    const out: Candidate[] = [];
    const seedName = seed.name ?? seed.id;
    let done = 0;
    // Fragment-major order: the first fragments are tried at every site before the next fragment,
    // so a small limit still yields substitutions at every position of the seed.
    for (const f of fragments) {
      for (const site of sites) {
        done += 1;
        if (out.length >= input.limit) break;
        const anchor = getAtom(seed, site)!;
        let mol: Molecule;
        try {
          mol = attachFragment(seed, site, f).molecule;
        } catch {
          continue;
        }
        const name = `${seedName} + ${f.name} @ ${anchor.element}${site}`;
        out.push({
          id: newId("cand"),
          name,
          molecule: createMolecule({ ...mol, id: `cand-${out.length + 1}`, name, metadata: { ...mol.metadata, source: "design-engine:derivatives" } }),
          origin: { generator: this.id, strategy: "fragment substitution", parent: { id: seed.id, name: seedName }, operations: [`attach ${f.name} (${f.smiles}) at ${anchor.element}${site}, replacing one hydrogen`] },
        });
      }
      onProgress?.(done, total);
      if (out.length >= input.limit) break;
    }
    return out;
  },
};

/** Screen of a named library: every entry becomes a candidate (parsed through the engine). */
export const LIBRARY_GENERATOR: CandidateGenerator = {
  id: "library",
  label: "Library screen",
  description: "Takes every entry of the chosen libraries (building blocks, solvents) as a candidate. Nothing is invented: this asks which known compounds meet the specification.",
  defaults: { libraries: "building blocks,solvents" },
  async generate(input, params, onProgress) {
    const wanted = new Set(String(params.libraries ?? this.defaults.libraries).split(",").map((s) => s.trim()).filter(Boolean));
    const libs = input.libraries.filter((l) => wanted.has(l.name));
    const entries = libs.flatMap((l) => l.entries.map((e) => ({ library: l.name, ...e })));
    const out: Candidate[] = [];
    let done = 0;
    for (const e of entries) {
      done += 1;
      if (out.length >= input.limit) break;
      const mol = await input.parseSmiles(e.smiles, e.name);
      onProgress?.(done, entries.length);
      if (!mol) continue;
      out.push({
        id: newId("cand"),
        name: e.name,
        molecule: createMolecule({ ...mol, id: `cand-${out.length + 1}`, name: e.name, metadata: { ...mol.metadata, source: `design-engine:library:${e.library}` } }),
        origin: { generator: this.id, strategy: "library screen", parent: null, operations: [`library "${e.library}" entry ${e.name} (${e.smiles})`], libraryEntry: { library: e.library, name: e.name, smiles: e.smiles } },
      });
    }
    return out;
  },
};

export const GENERATORS: readonly CandidateGenerator[] = [DERIVATIVE_GENERATOR, LIBRARY_GENERATOR];

export function generatorById(id: string): CandidateGenerator | undefined {
  return GENERATORS.find((g) => g.id === id);
}
