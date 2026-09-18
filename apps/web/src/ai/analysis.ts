import { connectedComponents, detectFunctionalGroups, distance, elementCounts, getAtom, idealBondLength, implicitHydrogenCount, molecularFormula, molecularWeight, neighborsOf, ringCount, totalFormalCharge } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { AnalysisInput, AnalysisReport, EstimateSummary, MoleculeAnalysisService, RuleCheck, Suggestion } from "./types";

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
  rule("ro5-mw", "Lipinski: molecular weight ≤ 500", mw, 500, " g/mol");
  rule("ro5-logp", "Lipinski: cLogP ≤ 5", d.cLogP?.value, 5);
  rule("ro5-hbd", "Lipinski: H-bond donors ≤ 5", d.hBondDonors?.value, 5);
  rule("ro5-hba", "Lipinski: H-bond acceptors ≤ 10", d.hBondAcceptors?.value, 10);
  rule("veber-rb", "Veber: rotatable bonds ≤ 10", d.rotatableBonds?.value, 10);
  rule("veber-tpsa", "Veber: TPSA ≤ 140", d.tpsa?.value, 140, " Å²");
  rule("egan-tpsa", "Egan: TPSA ≤ 131.6", d.tpsa?.value, 131.6, " Å²");
  rule("egan-logp", "Egan: cLogP ≤ 5.88", d.cLogP?.value, 5.88);
  return checks;
}

/** Deterministic observations: facts about the structure worth pointing out, no operations attached. */
export function observations(input: AnalysisInput): string[] {
  const mol = input.molecule;
  const out: string[] = [];
  if (mol.atoms.length === 0) return out;
  const comps = connectedComponents(mol);
  if (comps.length > 1) out.push(`The canvas holds ${comps.length} separate fragments (${comps.map((c) => c.filter((id) => getAtom(mol, id)?.element !== "H").length).join(" + ")} heavy atoms); properties are computed for the whole set, not for one compound.`);
  const charged = mol.atoms.filter((a) => a.formalCharge !== 0);
  const net = totalFormalCharge(mol);
  if (charged.length) out.push(net === 0 ? `${charged.length} charged atoms with zero net charge (zwitterion or charge-separated form).` : `Net charge ${net > 0 ? "+" : ""}${net}: the descriptors describe this ion, not the neutral compound.`);
  const stereo = input.stereo;
  if (stereo) {
    const unassigned = stereo.atoms.filter((a) => a.label === "?").length;
    const assigned = stereo.atoms.length - unassigned;
    if (assigned) out.push(`${assigned} stereocentre${assigned > 1 ? "s" : ""} with a defined configuration (${stereo.atoms.filter((a) => a.label !== "?").map((a) => `${a.atomId}: ${a.label}`).join(", ")}); the mirror image is a different compound.`);
    if (unassigned) out.push(`${unassigned} stereocentre${unassigned > 1 ? "s are" : " is"} flat or ambiguous in 3D: decide the configuration (Invert or Tidy) before comparing with a database entry.`);
    if (stereo.bonds.length) out.push(`Double-bond geometry: ${stereo.bonds.map((b) => `${b.bondId} ${b.label}`).join(", ")}.`);
  }
  const d = input.properties?.descriptors;
  if (d) {
    const rb = d.rotatableBonds?.value;
    if (rb !== undefined && rb >= 8) out.push(`${rb} rotatable bonds: a very flexible molecule; the single 3D conformer on screen is one of many.`);
    const logP = d.cLogP?.value;
    if (logP !== undefined && logP > 5) out.push(`cLogP ${logP.toFixed(1)}: very lipophilic, expect poor water solubility and strong binding to fats and plastics.`);
    if (logP !== undefined && logP < -1) out.push(`cLogP ${logP.toFixed(1)}: very hydrophilic; unlikely to cross membranes passively.`);
    const tpsa = d.tpsa?.value;
    if (tpsa !== undefined && tpsa > 140) out.push(`TPSA ${tpsa.toFixed(0)} Å²: highly polar surface, typical of poorly absorbed compounds (Veber).`);
  }
  const heavy = mol.atoms.filter((a) => a.element !== "H").length;
  if (heavy > 0 && heavy <= 3) out.push("A very small molecule: group-contribution estimates are least reliable at this size.");
  const exotic = [...new Set(mol.atoms.map((a) => a.element))].filter((e) => !["C", "H", "N", "O", "S", "P", "F", "Cl", "Br", "I", "B", "Si"].includes(e));
  if (exotic.length) out.push(`Contains ${exotic.join(", ")}: outside organic chemistry rules; valence checks, descriptors and estimates are unreliable for these atoms.`);
  return out;
}

export function summarizeEstimates(preds: AnalysisInput["predictions"]): EstimateSummary[] {
  return (preds ?? []).map((p) => ({ kind: "predicted" as const, id: p.id, label: p.label, value: p.value, unit: p.unit ?? null, model: p.model, uncertainty: p.uncertainty ?? null, reasoning: p.reasoning ?? [] }));
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
      observations: observations(input),
      estimates: summarizeEstimates(input.predictions),
      synthesis: input.synthesis ?? null,
      suggestions: ruleSuggestions(mol, input),
    };
  },
};
