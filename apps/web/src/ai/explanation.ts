import type { Molecule } from "@molecular-cad/molecule-model";
import { validateSuggestion } from "./suggestions";
import type { AnalysisReport, EstimateSummary, Explanation, ExplanationService, Suggestion } from "./types";
import { EXPLANATION_DISCLAIMER } from "./types";

/** Offline explainer: deterministic prose assembled from the report. Works on the iPad without any service. */
export class TemplateExplanationService implements ExplanationService {
  readonly id = "template";
  readonly label = "Built-in explanations (offline, deterministic)";

  async explain(report: AnalysisReport, question?: string): Promise<Explanation> {
    const text = question && question.trim() ? answerQuestion(report, question) : renderTemplate(report);
    return { kind: "explanation", source: "built-in templates", text, suggestions: [], disclaimer: EXPLANATION_DISCLAIMER };
  }
}

const fmt = (v: number | string) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1)) : v);
const est = (r: AnalysisReport, id: string): EstimateSummary | undefined => r.estimates.find((e) => e.id === id);
const estText = (e: EstimateSummary) => `${e.label.toLowerCase()} ${fmt(e.value)}${e.unit ? ` ${e.unit}` : ""}`;

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
  const physical = renderEstimates(r);
  if (physical) parts.push(physical);
  if (r.observations.length) parts.push(`Observations: ${r.observations.join(" ")}`);
  if (r.synthesis && r.synthesis.length) parts.push(`Simplest rule-based synthesis (${r.synthesis.length} step${r.synthesis.length > 1 ? "s" : ""}, class-level, see the Retro tab): ${r.synthesis.join(" ")}`);
  if (r.suggestions.length) parts.push(`Suggested next steps: ${r.suggestions.map((s) => s.title.toLowerCase()).join("; ")}.`);
  return parts.join(" ");
}

/** Prose for the PREDICTED block: what the models say and the reasoning they carry. */
export function renderEstimates(r: AnalysisReport): string | null {
  if (r.estimates.length === 0) return null;
  const parts: string[] = [];
  const tb = est(r, "joback-tb");
  const tm = est(r, "joback-tm");
  const state = est(r, "joback-state");
  if (tb) {
    parts.push(`Predicted (Joback group contributions, not measured): boiling point about ${fmt(tb.value)} °C${tm ? `, melting point about ${fmt(tm.value)} °C` : ""}${state ? `, so probably a ${state.value} at room temperature` : ""}.`);
    if (tb.reasoning[0]) parts.push(tb.reasoning.slice(0, 2).join(" "));
  } else {
    const na = est(r, "joback-na");
    if (na) parts.push(`Boiling and melting points cannot be estimated: ${na.uncertainty}.`);
  }
  const dens = est(r, "girolami-density");
  if (dens) parts.push(`Density about ${fmt(dens.value)} g/cm³ (Girolami).`);
  const sol = est(r, "esol-logs");
  if (sol) {
    const v = Number(sol.value);
    parts.push(`Water solubility is predicted ${v > -1 ? "high" : v > -3 ? "moderate" : v > -5 ? "low" : "very low"} (ESOL log S ${fmt(sol.value)}, ±1 log unit). ${sol.reasoning[0] ?? ""}`.trim());
  }
  const ab = est(r, "acid-base");
  if (ab) parts.push(`In water it should be ${ab.value}; ${ab.reasoning[0] ? ab.reasoning[0][0]!.toLowerCase() + ab.reasoning[0].slice(1) : ""}`.replace(/; $/, "."));
  const qed = est(r, "qed");
  const sa = est(r, "sa-score");
  if (qed || sa) parts.push(`Server models: ${[qed ? `QED drug-likeness ${fmt(qed.value)}` : null, sa ? `synthetic accessibility ${fmt(sa.value)} on a 1–10 scale` : null].filter(Boolean).join(", ")}.`);
  return parts.join(" ");
}

interface Intent {
  id: string;
  patterns: RegExp;
  answer(r: AnalysisReport): string | null;
}

const noData = (what: string) => `The report has no ${what} yet: the chemistry engine may still be loading, or the structure was rejected.`;

const INTENTS: Intent[] = [
  {
    id: "boiling",
    patterns: /boil|\bbp\b|volatil|evaporat|vapou?r|wrzen|lotn|paruj/i,
    answer(r) {
      const tb = est(r, "joback-tb");
      const na = est(r, "joback-na");
      if (!tb) return na ? `No boiling-point estimate: ${na.uncertainty}.` : noData("boiling-point estimate");
      const vp = est(r, "cc-vp");
      return [`Predicted boiling point about ${fmt(tb.value)} °C (Joback group contributions, typical error ±13 K; a model, not a measurement).`, ...tb.reasoning, vp ? `Vapour pressure at 25 °C roughly ${fmt(vp.value)} ${vp.unit} (order of magnitude).` : null].filter(Boolean).join(" ");
    },
  },
  {
    id: "melting",
    patterns: /melt|\bmp\b|fusion|topnien|solid|crystal|krystal/i,
    answer(r) {
      const tm = est(r, "joback-tm");
      if (!tm) return noData("melting-point estimate");
      return [`Predicted melting point about ${fmt(tm.value)} °C (Joback; this is the least reliable Joback property).`, ...tm.reasoning].join(" ");
    },
  },
  {
    id: "state",
    patterns: /state|phase|liquid|gas\b|room temperature|stan skupienia|ciecz|ciekł/i,
    answer(r) {
      const st = est(r, "joback-state");
      return st ? `Probably a ${st.value} at 25 °C. ${st.reasoning.join(" ")} This follows from the Joback estimates and inherits their errors.` : noData("phase estimate");
    },
  },
  {
    id: "solubility",
    patterns: /solub|dissolv|water|aqueous|hydrophil|rozpuszcz|wod/i,
    answer(r) {
      const s = est(r, "esol-logs");
      if (!s) return noData("solubility estimate (needs cLogP and molecular weight from the engine)");
      return [`Predicted aqueous solubility log S ${fmt(s.value)} mol/L (ESOL, Delaney 2004, ±1 log unit).`, ...s.reasoning].join(" ");
    },
  },
  {
    id: "density",
    patterns: /densit|gęsto|gesto|heavy|float|sink/i,
    answer(r) {
      const d = est(r, "girolami-density");
      return d ? [`Estimated density ${fmt(d.value)} g/cm³ (Girolami scaled volumes, ±0.05 typical).`, ...d.reasoning].join(" ") : noData("density estimate");
    },
  },
  {
    id: "acid-base",
    patterns: /acid|base|basic|pka|\bph\b|proton|ioni[sz]|kwas|zasad/i,
    answer(r) {
      const ab = est(r, "acid-base");
      return ab ? [`${String(ab.value)[0]!.toUpperCase()}${String(ab.value).slice(1)}.`, ...ab.reasoning, "These are textbook ranges for the functional-group class, not values computed for this exact molecule."].join(" ") : noData("acid/base analysis");
    },
  },
  {
    id: "lipophilicity",
    patterns: /logp|lipophil|hydrophob|partition|oil|fat|membrane|lipofil/i,
    answer(r) {
      const d = r.engine?.descriptors.cLogP;
      if (!d) return noData("cLogP");
      const v = d.value;
      return `Computed cLogP ${v.toFixed(2)} (Crippen atom contributions, RDKit). ${v > 5 ? "Very lipophilic: partitions into fat and membranes, poorly soluble in water." : v > 3 ? "Lipophilic: prefers oil over water." : v > 1 ? "Moderately lipophilic, a common range for orally absorbed drugs." : v > -1 ? "Balanced between water and oil." : "Hydrophilic: prefers water, unlikely to cross membranes passively."}`;
    },
  },
  {
    id: "polarity",
    patterns: /polar|tpsa|surface|hydrogen bond|h-bond|donor|acceptor|dipole|biegun/i,
    answer(r) {
      const d = r.engine?.descriptors;
      if (!d?.tpsa) return noData("polar-surface descriptors");
      return `Topological polar surface area ${d.tpsa.value.toFixed(1)} Å² with ${d.hBondDonors?.value ?? "?"} hydrogen-bond donor(s) and ${d.hBondAcceptors?.value ?? "?"} acceptor(s). ${d.tpsa.value < 40 ? "A small polar surface: the molecule is mostly non-polar." : d.tpsa.value < 90 ? "A moderate polar surface, typical of molecules that are both soluble and membrane-permeable." : d.tpsa.value < 140 ? "A large polar surface: good water interactions, weaker passive permeability." : "A very large polar surface (Veber limit 140 Å² exceeded)."}`;
    },
  },
  {
    id: "drug",
    patterns: /drug|lipinski|rule of five|ro5|veber|egan|bioavail|oral|qed|lek/i,
    answer(r) {
      if (!r.ruleChecks.length) return noData("rule checks (they need engine descriptors)");
      const failed = r.ruleChecks.filter((c) => !c.passed);
      const qed = est(r, "qed");
      return `${failed.length === 0 ? "All Lipinski, Veber and Egan criteria pass" : `${failed.length} rule criterion${failed.length > 1 ? "s" : ""} fail: ${failed.map((c) => c.detail).join("; ")}`}. ${qed ? `QED drug-likeness ${fmt(qed.value)} (0–1, Bickerton 2012). ` : ""}These are heuristics on computed descriptors, not predictions of activity or safety.`;
    },
  },
  {
    id: "synthesis",
    patterns: /synth|make|prepar|route|retro|disconnect|reaction|otrzym|synte/i,
    answer(r) {
      if (!r.synthesis) return "No synthesis plan is attached: open the Retro tab and press “Plan synthesis”. The planner uses textbook reaction templates and names reaction classes only.";
      if (r.synthesis.length === 0) return "The rule-based planner found no route: no reaction template applies to this target, or the molecule is already a simple building block.";
      return `Simplest rule-based route (${r.synthesis.length} step${r.synthesis.length > 1 ? "s" : ""}): ${r.synthesis.join(" ")} These are class-level textbook reactions with no conditions or quantities; regiochemistry and protecting groups are not verified.`;
    },
  },
  {
    id: "stereo",
    patterns: /stereo|chiral|enantiom|r\/s|cip|e\/z|isomer|stereochem/i,
    answer(r) {
      const lines = r.observations.filter((o) => /stereocentre|Double-bond geometry/.test(o));
      return lines.length ? lines.join(" ") : "No stereocentres or stereogenic double bonds were perceived from the 3D coordinates (or the engine has not reported stereo yet).";
    },
  },
  {
    id: "groups",
    patterns: /group|functional|what is it|what kind|class|type of compound|grup/i,
    answer(r) {
      return r.molecule.functionalGroups.length ? `Recognised functional groups: ${r.molecule.functionalGroups.join(", ")}. Detection is by local graph patterns (RDKit remains the authority for full perception).` : "No functional groups from the built-in catalogue (acids, esters, amides, ketones, aldehydes, alcohols, ethers, amines, nitriles, halides, aromatic rings) were found.";
    },
  },
  {
    id: "formula",
    patterns: /formula|weight|mass|\bmw\b|how many|atoms|masa|wzór|wzor/i,
    answer(r) {
      const m = r.molecule;
      return `${m.name}: ${m.formulaWithImplicitH}, ${m.atomCount} atoms (${m.heavyAtomCount} heavy), ${m.bondCount} bonds, ${m.ringCount} ring(s)${m.molecularWeight !== null ? `, molecular weight ${m.molecularWeight.toFixed(2)} g/mol` : ""}.`;
    },
  },
  {
    id: "valid",
    patterns: /valid|error|wrong|correct|valence|stable|exist|real|możliw|popraw/i,
    answer(r) {
      if (!r.validation.valid) return `The structure fails validation: ${r.validation.errors.join(" ")}`;
      if (r.engineValidation && !r.engineValidation.valid) return `The chemistry engine rejects it: ${r.engineValidation.issues.join(" ")}`;
      return "Valence rules and the chemistry engine accept the structure. That means it is a well-formed molecule on paper; it says nothing about whether it can be made or how stable it would be.";
    },
  },
  {
    id: "new",
    patterns: /new|novel|known|exist|database|pubchem|nowy|znany/i,
    answer(r) {
      return r.engine?.inchiKey ? `The InChIKey is ${r.engine.inchiKey}. Novelty can only be checked against databases: use the PubChem link in the Chemistry tab. No hit is a hint, not proof, that the compound is unreported.` : noData("InChIKey");
    },
  },
];

/** Offline question answering: keyword intents over the structured report. Never invents numbers. */
export function answerQuestion(r: AnalysisReport, question: string): string {
  if (r.molecule.atomCount === 0) return "The canvas is empty. Add atoms first.";
  const q = question.trim();
  const hits = INTENTS.filter((i) => i.patterns.test(q));
  const answers = hits.map((i) => i.answer(r)).filter((a): a is string => a !== null);
  if (answers.length === 0) {
    return `I can answer from the report about: boiling and melting point, physical state, solubility, density, acid/base character, lipophilicity (logP), polarity, drug-likeness rules, stereochemistry, functional groups, formula and weight, validity, novelty, and the rule-based synthesis plan. Try for example “why is the boiling point high?” or “is it soluble in water?”.`;
  }
  return answers.slice(0, 3).join("\n\n");
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

  async explain(report: AnalysisReport, question?: string): Promise<Explanation> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.baseUrl.replace(/\/+$/, "") + "/ai/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ report, question: question?.trim() || null }) });
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
