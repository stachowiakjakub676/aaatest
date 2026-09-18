import { allowedValences, getElement } from "./elements";
import { explicitValence } from "./molecule";
import type { Molecule } from "./types";

/**
 * Molecular formula (Hill system) and molecular weight from the explicit graph.
 *
 * COMPUTED values only: they follow deterministically from the atoms present.
 * Implicit hydrogens are counted only when `includeImplicitHydrogens` is set and the element
 * has a client-side valence rule; otherwise the formula reflects explicit atoms exactly.
 */

export interface FormulaOptions {
  includeImplicitHydrogens?: boolean;
}

/**
 * Implicit hydrogen count for one atom: the explicit value if the user set it, otherwise the
 * smallest allowed valence that accommodates the explicit bonds, minus those bonds. Returns 0
 * for elements without a valence rule (metals etc.).
 */
export function implicitHydrogenCount(mol: Molecule, atomId: string): number {
  const atom = mol.atoms.find((a) => a.id === atomId);
  if (!atom) throw new Error(`Unknown atom: ${atomId}`);
  if (atom.implicitHydrogens !== undefined) return atom.implicitHydrogens;
  const allowed = allowedValences(atom.element, atom.formalCharge);
  if (!allowed || allowed.length === 0) return 0;
  const explicit = explicitValence(mol, atomId);
  const target = allowed.find((v) => v >= explicit - 1e-9);
  if (target === undefined) return 0; // over-valent; validator reports it
  return Math.max(0, Math.round(target - explicit));
}

export function elementCounts(mol: Molecule, opts: FormulaOptions = {}): Map<string, number> {
  const counts = new Map<string, number>();
  for (const atom of mol.atoms) {
    counts.set(atom.element, (counts.get(atom.element) ?? 0) + 1);
    if (opts.includeImplicitHydrogens) {
      const h = implicitHydrogenCount(mol, atom.id);
      if (h > 0) counts.set("H", (counts.get("H") ?? 0) + h);
    }
  }
  return counts;
}

/** Hill order: C first, then H, then alphabetical. Without carbon: everything alphabetical. */
export function hillOrder(symbols: Iterable<string>): string[] {
  const list = [...symbols];
  const hasC = list.includes("C");
  return list.sort((a, b) => {
    if (hasC) {
      if (a === "C") return -1;
      if (b === "C") return 1;
      if (a === "H") return -1;
      if (b === "H") return 1;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

export function molecularFormula(mol: Molecule, opts: FormulaOptions = {}): string {
  const counts = elementCounts(mol, opts);
  let formula = hillOrder(counts.keys())
    .map((sym) => (counts.get(sym)! > 1 ? `${sym}${counts.get(sym)}` : sym))
    .join("");
  const charge = mol.atoms.reduce((s, a) => s + a.formalCharge, 0);
  if (charge !== 0) {
    const mag = Math.abs(charge) === 1 ? "" : String(Math.abs(charge));
    formula += `${mag}${charge > 0 ? "+" : "-"}`;
  }
  return formula;
}

export interface MolecularWeightResult {
  /** g/mol; undefined if any element is unknown. */
  value?: number;
  /** True when any contributing element only has a mass-number placeholder or an isotope label. */
  approximate: boolean;
}

export function molecularWeight(mol: Molecule, opts: FormulaOptions = {}): MolecularWeightResult {
  let total = 0;
  let approximate = false;
  for (const [sym, n] of elementCounts(mol, opts)) {
    const el = getElement(sym);
    if (!el) return { approximate: false };
    if (el.weightIsMassNumber) approximate = true;
    total += el.atomicWeight * n;
  }
  // Isotopes: replace the standard weight with the mass number for labelled atoms.
  // (Exact isotopic masses belong to the chemistry engine; the mass number is an honest approximation.)
  for (const atom of mol.atoms) {
    if (atom.isotope !== undefined) {
      const el = getElement(atom.element);
      if (el) {
        total += atom.isotope - el.atomicWeight;
        approximate = true;
      }
    }
  }
  return { value: total, approximate };
}
