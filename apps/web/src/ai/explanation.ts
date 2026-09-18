import type { Molecule } from "@molecular-cad/molecule-model";
import { validateSuggestion } from "./suggestions";
import type { AnalysisReport, Explanation, ExplanationService, Suggestion } from "./types";
import { EXPLANATION_DISCLAIMER } from "./types";

/** Offline explainer: deterministic prose assembled from the report. Works on the iPad without any service. */
export class TemplateExplanationService implements ExplanationService {
  readonly id = "template";
  readonly label = "Built-in explanations (offline, deterministic)";

  async explain(report: AnalysisReport): Promise<Explanation> {
    return { kind: "explanation", source: "built-in templates", text: renderTemplate(report), suggestions: [], disclaimer: EXPLANATION_DISCLAIMER };
  }
}

export function renderTemplate(r: AnalysisReport): string {
  const m = r.molecule;
  if (m.atomCount === 0) return "The canvas is empty. Add atoms to get an analysis.";
  const parts: string[] = [];
  const heavy = m.heavyAtomCount;
  parts.push(`${m.name} has ${m.atomCount} atoms (${heavy} heavy) and ${m.bondCount} bonds; explicit formula ${m.formulaExplicit}${m.formulaWithImplicitH !== m.formulaExplicit ? `, ${m.formulaWithImplicitH} once implicit hydrogens are counted` : ""}.`);
  if (m.molecularWeight !== null) parts.push(`Molecular weight ${m.molecularWeight.toFixed(2)} g/mol.`);
  if (m.netCharge !== 0) parts.push(`Net formal charge ${m.netCharge > 0 ? "+" : ""}${m.netCharge}.`);
  parts.push(m.ringCount === 0 ? "It is acyclic." : `It contains ${m.ringCount} ring${m.ringCount > 1 ? "s" : ""}.`);
  if (m.functionalGroups.length) {
    const counted = new Map<string, number>();
    for (const g of m.functionalGroups) counted.set(g, (counted.get(g) ?? 0) + 1);
    parts.push(`Recognised groups: ${[...counted].map(([g, n]) => (n > 1 ? `${g} ×${n}` : g)).join(", ")}.`);
  }
  if (!r.validation.valid) parts.push(`The structure has ${r.validation.errors.length} validation error${r.validation.errors.length > 1 ? "s" : ""}: ${r.validation.errors.join(" ")}`);
  else if (r.validation.warnings.length) parts.push(`Warnings: ${r.validation.warnings.join(" ")}`);
  if (r.engineValidation && !r.engineValidation.valid) parts.push(`The chemistry engine rejected it: ${r.engineValidation.issues.join(" ")}`);
  if (r.engine) {
    const d = r.engine.descriptors;
    const bits: string[] = [];
    if (d.tpsa) bits.push(`a topological polar surface area of ${d.tpsa.value.toFixed(1)} Å²`);
    if (d.cLogP) bits.push(`an estimated cLogP of ${d.cLogP.value.toFixed(2)} (Crippen fragment method, computed not measured)`);
    if (d.hBondDonors && d.hBondAcceptors) bits.push(`${d.hBondDonors.value} hydrogen-bond donor${d.hBondDonors.value === 1 ? "" : "s"} and ${d.hBondAcceptors.value} acceptor${d.hBondAcceptors.value === 1 ? "" : "s"} (Lipinski counts)`);
    if (d.rotatableBonds) bits.push(`${d.rotatableBonds.value} rotatable bond${d.rotatableBonds.value === 1 ? "" : "s"}`);
    if (bits.length) parts.push(`From ${r.engine.source}: ${bits.join(", ")}.`);
    if (r.ruleChecks.length) {
      const failed = r.ruleChecks.filter((c) => !c.passed);
      parts.push(failed.length === 0 ? "All four Lipinski rule-of-five criteria are met; this is a rule evaluation on computed descriptors, not a prediction of bioavailability." : `Lipinski rule-of-five: ${failed.length} criterion${failed.length > 1 ? "s" : ""} not met (${failed.map((c) => c.detail).join("; ")}).`);
    }
  } else if (r.validation.valid) {
    parts.push("Engine descriptors are not available yet (engine loading or structure rejected).");
  }
  if (r.suggestions.length) parts.push(`Suggested next steps: ${r.suggestions.map((s) => s.title.toLowerCase()).join("; ")}.`);
  return parts.join(" ");
}

/**
 * Server-backed explainer (services/api `POST /ai/explain`, which may call a language model).
 * The reply is untrusted: text is shown as text, suggestions are validated against the molecule.
 */
export class RemoteExplanationService implements ExplanationService {
  readonly id = "remote";
  readonly label = "Language model via server";

  constructor(
    private readonly baseUrl: string,
    private readonly moleculeRef: () => Molecule,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async explain(report: AnalysisReport): Promise<Explanation> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.baseUrl.replace(/\/+$/, "") + "/ai/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ report }) });
    } catch (e) {
      throw new Error(`Server unreachable at ${this.baseUrl}: ${(e as Error).message}`);
    }
    const data = (await res.json().catch(() => ({}))) as { detail?: unknown; text?: unknown; model?: unknown; suggestions?: unknown };
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Server error ${res.status}`);
    if (typeof data.text !== "string") throw new Error("Malformed explanation from server");
    const mol = this.moleculeRef();
    const suggestions: Suggestion[] = [];
    if (Array.isArray(data.suggestions)) {
      data.suggestions.forEach((raw, i) => {
        const s = validateSuggestion(mol, raw, "llm", i);
        if (s) suggestions.push(s);
      });
    }
    return { kind: "explanation", source: `${typeof data.model === "string" ? data.model : "language model"} via server`, text: data.text, suggestions, disclaimer: EXPLANATION_DISCLAIMER };
  }
}
