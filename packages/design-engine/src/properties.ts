/**
 * Property catalogue: every quantity a specification may constrain, with its provenance class,
 * the method that produces it and its typical uncertainty. Keys are stable identifiers used in
 * specifications and candidate profiles; the web adapter maps engine descriptors and predictions
 * onto them. Nothing here computes a value.
 */

/** Provenance class of a value. Predictions are never presented as measurements. */
export type ValueKind = "computed" | "predicted" | "estimated" | "experimental" | "database";

export type PropertyDomain = "molecular" | "thermodynamic" | "phase" | "solubility" | "materials" | "drug-likeness";

export interface PropertyDefinition {
  key: string;
  label: string;
  domain: PropertyDomain;
  /** Numeric or categorical. */
  type: "number" | "category";
  unit: string | null;
  /** Allowed values for categorical properties. */
  categories?: string[];
  /** Provenance class of the value the current tools supply. */
  kind: ValueKind;
  /** Method or model that produces it (shown as provenance). */
  method: string;
  /** Typical error of that method, as a sentence. */
  uncertainty: string | null;
  /** Typical absolute error in the property's unit, used for margin-aware filtering. */
  errorAbs?: number;
  /** Typical relative error (fraction), for quantities that scale (e.g. vapour pressure). */
  errorRel?: number;
  /** Which engine supplies the value; "server" values are unknown with the in-browser engine. */
  requires?: "server";
}

interface Extra {
  errorAbs?: number;
  errorRel?: number;
  requires?: "server";
  categories?: string[];
}
const P = (key: string, label: string, domain: PropertyDomain, unit: string | null, kind: ValueKind, method: string, uncertainty: string | null = null, extra: Extra = {}): PropertyDefinition => {
  const { categories, ...rest } = extra;
  const base = categories ? { key, label, domain, type: "category" as const, unit, categories, kind, method, uncertainty } : { key, label, domain, type: "number" as const, unit, kind, method, uncertainty };
  return { ...base, ...rest };
};

export const PROPERTY_CATALOGUE: readonly PropertyDefinition[] = [
  P("mw", "Molecular weight", "molecular", "g/mol", "computed", "RDKit, average atomic weights", null),
  P("exactMass", "Exact mass", "molecular", "Da", "computed", "RDKit, monoisotopic", null),
  P("heavyAtomCount", "Heavy atoms", "molecular", null, "computed", "RDKit", null),
  P("ringCount", "Rings", "molecular", null, "computed", "RDKit SSSR", null),
  P("aromaticRingCount", "Aromatic rings", "molecular", null, "computed", "RDKit", null),
  P("rotatableBonds", "Rotatable bonds", "molecular", null, "computed", "RDKit", null),
  P("hBondDonors", "H-bond donors", "molecular", null, "computed", "RDKit, Lipinski NH + OH", null),
  P("hBondAcceptors", "H-bond acceptors", "molecular", null, "computed", "RDKit, Lipinski N + O", null),
  P("tpsa", "Topological polar surface area", "molecular", "Å²", "computed", "RDKit (Ertl)", null),
  P("cLogP", "Lipophilicity, cLogP", "molecular", null, "computed", "RDKit, Crippen atom contributions", "typical error ≈ 0.5–1 log unit versus measured logP", { errorAbs: 0.7 }),
  P("fractionCsp3", "Fraction Csp3", "molecular", null, "computed", "RDKit", null),
  P("stereoCenters", "Stereocentres", "molecular", null, "computed", "RDKit", null),
  P("tb", "Normal boiling point", "thermodynamic", "°C", "predicted", "Joback & Reid group contributions (1987)", "average absolute error ≈ 13 K, larger for polyfunctional molecules", { errorAbs: 13 }),
  P("tm", "Melting point", "thermodynamic", "°C", "predicted", "Joback & Reid group contributions (1987)", "average absolute error ≈ 23 K, often much worse", { errorAbs: 23 }),
  P("tbVac20", "Boiling point at 20 mbar", "phase", "°C", "predicted", "Lee–Kesler on the Joback constants", "inherits the Tb error; 10–20 K less certain than Tb", { errorAbs: 20 }),
  P("vp25", "Vapour pressure at 25 °C", "phase", "kPa", "predicted", "Lee–Kesler on the Joback constants", "order of magnitude: 10 K in Tb ≈ factor 1.5–2", { errorRel: 1.0 }),
  P("hvapTb", "Enthalpy of vaporisation at Tb", "thermodynamic", "kJ/mol", "predicted", "Joback & Reid group contributions (1987)", "average absolute error ≈ 1.3 kJ/mol", { errorAbs: 1.3 }),
  P("density", "Density (liquid or solid, 25 °C)", "materials", "g/cm³", "predicted", "Girolami scaled-volume method (1994)", "typical error 0.02–0.1 g/cm³", { errorAbs: 0.06 }),
  P("logS", "Aqueous solubility, log S", "solubility", "log(mol/L)", "predicted", "ESOL (Delaney 2004)", "±1 log unit", { errorAbs: 1.0 }),
  P("hansenDd", "Hansen δd (dispersion)", "materials", "MPa½", "predicted", "Hoftyzer–Van Krevelen group contributions", "1–2 MPa½", { errorAbs: 1.5 }),
  P("hansenDp", "Hansen δp (polar)", "materials", "MPa½", "predicted", "Hoftyzer–Van Krevelen group contributions", "1–2 MPa½", { errorAbs: 1.5 }),
  P("hansenDh", "Hansen δh (hydrogen bonding)", "materials", "MPa½", "predicted", "Hoftyzer–Van Krevelen group contributions", "1–2 MPa½, the least reliable component", { errorAbs: 2.0 }),
  P("hansenDt", "Hansen δt (total)", "materials", "MPa½", "predicted", "Hoftyzer–Van Krevelen group contributions", "1–2 MPa½", { errorAbs: 1.5 }),
  P("acidBase", "Acid/base character", "solubility", null, "predicted", "Class-typical pKa ranges for the recognised groups", "substituent effects shift pKa by several units", { categories: ["neutral", "acidic", "basic", "amphoteric"] }),
  P("qed", "Drug-likeness, QED", "drug-likeness", null, "predicted", "QED (Bickerton 2012), server engine", "a desirability score, not a measurement", { requires: "server" }),
  P("saScore", "Synthetic accessibility score", "drug-likeness", null, "predicted", "SA score (Ertl & Schuffenhauer 2009), server engine", "1 easy – 10 hard; a heuristic", { requires: "server" }),
];

export const PROPERTY_BY_KEY: ReadonlyMap<string, PropertyDefinition> = new Map(PROPERTY_CATALOGUE.map((p) => [p.key, p]));

export function propertyDefinition(key: string): PropertyDefinition | undefined {
  return PROPERTY_BY_KEY.get(key);
}

export const DOMAIN_LABELS: Record<PropertyDomain, string> = {
  molecular: "Molecular (computed)",
  thermodynamic: "Thermodynamic (predicted)",
  phase: "Phase behaviour (predicted)",
  solubility: "Solubility and acid/base (predicted)",
  materials: "Materials (predicted)",
  "drug-likeness": "Drug-likeness (server models)",
};
