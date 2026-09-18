import { detectFunctionalGroups, distance, elementCounts, getAtom, idealBondLength, implicitHydrogenCount, molecularFormula, molecularWeight, neighborsOf, ringCount, totalFormalCharge } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { AnalysisInput, AnalysisReport, MoleculeAnalysisService, RuleCheck, Suggestion } from "./types";

/** A tidy is suggested when some bond deviates this much (relative) from its ideal length, or atoms overlap. */
const UNTIDY_BOND_DEVIATION = 0.2;

function lipinski(report: Pick<AnalysisReport, "engine" | "molecule">): RuleCheck[] {
  const d = report.engine?.descriptors;
  const mw = report.engine ? report.molecule.molecularWeight : null;
  if (!d || mw === null) return [];
  const checks: RuleCheck[] = [];
  const rule = (id: string, label: string, value: number | undefined, limit: number, unit = "") => {
    if (value === undefined) return;
    checks.push({ id, label, passed: value <= limit, detail: `${label}: ${Number.isInteger(value) ? value : value.toFixed(2)}${unit} (limit ${limit}${unit})` });
  };
  rule("ro5-mw", "Molecular weight ≤ 500", mw, 500, " g/mol");
  rule("ro5-logp", "cLogP ≤ 5", d.cLogP?.value, 5);
  rule("ro5-hbd", "H-bond donors ≤ 5", d.hBondDonors?.value, 5);
  rule("ro5-hba", "H-bond acceptors ≤ 10", d.hBondAcceptors?.value, 10);
  return checks;
}

/** Deterministic, rule-based suggestions. Each one is an ordinary editor operation list. */
export function ruleSuggestions(mol: Molecule, input: AnalysisInput): Suggestion[] {
  const out: Suggestion[] = [];
  if (mol.atoms.length === 0) return out;

  // 1. Over-valent atoms that carry hydrogens: removing one hydrogen is a safe, local fix.
  for (const issue of input.validation.issues) {
    if (issue.code !== "VALENCE_EXCEEDED" || !issue.atomIds?.[0]) continue;
    const atomId = issue.atomIds[0];
    const h = neighborsOf(mol, atomId).find((n) => getAtom(mol, n)?.element === "H");
    if (h) {
      out.push({ id: `fix-valence-${atomId}`, title: `Remove a hydrogen from ${getAtom(mol, atomId)?.element}${atomId}`, rationale: issue.message, source: "rule", operations: [{ op: "removeAtom", atomId: h }] });
    }
  }

  // 2. Heavy-atom sketches: offer explicit hydrogens.
  const missingH = mol.atoms.reduce((s, a) => s + implicitHydrogenCount(mol, a.id), 0);
  if (missingH > 0 && input.validation.valid) {
    out.push({ id: "add-hydrogens", title: `Add ${missingH} explicit hydrogen${missingH > 1 ? "s" : ""}`, rationale: "Valence rules imply implicit hydrogens; making them explicit lets the 3D geometry and the engine see the complete molecule.", source: "rule", operations: [{ op: "addHydrogens" }] });
  }

  // 3. Gross geometry defects: badly stretched/compressed bonds or overlapping atoms.
  if (mol.atoms.length >= 2 && mol.atoms.length <= 300) {
    let worst = 0;
    for (const b of mol.bonds) {
      const p = getAtom(mol, b.atomA);
      const q = getAtom(mol, b.atomB);
      if (!p || !q) continue;
      const ideal = idealBondLength(p.element, q.element, b.order);
      worst = Math.max(worst, Math.abs(distance(p.position, q.position) - ideal) / ideal);
    }
    const overlap = input.validation.issues.some((i) => i.code === "ATOMS_OVERLAP");
    if (worst > UNTIDY_BOND_DEVIATION || overlap) {
      out.push({ id: "tidy", title: "Tidy the geometry", rationale: overlap ? "Some atoms overlap; relaxing the sketch will separate them." : `A bond deviates ${(worst * 100).toFixed(0)}% from its ideal length; relaxing bond lengths and angles will make the sketch look like the intended structure.`, source: "rule", operations: [{ op: "tidy" }] });
    }
  }
  return out;
}

export const RULE_ANALYSIS: MoleculeAnalysisService = {
  label: "Deterministic analysis (rules + chemistry engine)",
  analyze(input: AnalysisInput): AnalysisReport {
    const mol = input.molecule;
    const counts = Object.fromEntries([...elementCounts(mol)].sort());
    const mw = input.properties?.molecularWeight ?? molecularWeight(mol, { includeImplicitHydrogens: true }).value ?? null;
    const partial = {
      molecule: {
        name: mol.name ?? mol.id,
        formulaExplicit: molecularFormula(mol),
        formulaWithImplicitH: molecularFormula(mol, { includeImplicitHydrogens: true }),
        molecularWeight: mw,
        atomCount: mol.atoms.length,
        heavyAtomCount: mol.atoms.filter((a) => a.element !== "H").length,
        bondCount: mol.bonds.length,
        netCharge: totalFormalCharge(mol),
        ringCount: ringCount(mol),
        elementCounts: counts,
        functionalGroups: detectFunctionalGroups(mol).map((g) => g.name),
      },
      engine: input.properties
        ? {
            source: input.properties.source,
            canonicalSmiles: input.properties.canonicalSmiles,
            inchiKey: input.properties.inchiKey ?? null,
            descriptors: input.properties.descriptors,
          }
        : null,
    };
    return {
      kind: "computed",
      ...partial,
      validation: {
        valid: input.validation.valid,
        errors: input.validation.issues.filter((i) => i.severity === "error").map((i) => i.message),
        warnings: input.validation.issues.filter((i) => i.severity === "warning").map((i) => i.message),
      },
      engineValidation: input.engineValidation ? { valid: input.engineValidation.valid, issues: input.engineValidation.issues.map((i) => i.message) } : null,
      ruleChecks: lipinski(partial),
      suggestions: ruleSuggestions(mol, input),
    };
  },
};
