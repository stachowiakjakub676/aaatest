/**
 * Adapter from what the chemistry layer already knows about a molecule (engine descriptors and
 * the PREDICTED list) to a design-engine candidate profile. Every value keeps its provenance:
 * the engine's source string for computed descriptors, the model citation and error statement
 * for predictions. Nothing is invented here; a property the tools did not supply is absent.
 */
import { girolamiDensity, hansenParameters, molecularWeight } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { CandidateProfile, PropertyValue } from "@molecular-cad/design-engine";
import type { ComputedProperties, Prediction } from "../chemistry/engine";

/** What the adapter needs: the engine's computed properties and the PREDICTED list (a subset of ChemistryState). */
export interface ProfileSource {
  properties: ComputedProperties | null;
  predictions: Prediction[];
}

const DESCRIPTOR_KEYS = ["exactMass", "heavyAtomCount", "ringCount", "aromaticRingCount", "rotatableBonds", "hBondDonors", "hBondAcceptors", "tpsa", "cLogP", "fractionCsp3", "stereoCenters"] as const;

/** Prediction id → catalogue key for numeric predictions. */
const PREDICTION_KEYS: Record<string, string> = {
  "joback-tb": "tb",
  "joback-tm": "tm",
  "lk-tb-vac": "tbVac20",
  "lk-vp": "vp25",
  "joback-hvap": "hvapTb",
  "girolami-density": "density",
  "esol-logs": "logS",
  qed: "qed",
  "sa-score": "saScore",
};

function fromPrediction(key: string, p: Prediction, value: number | string): PropertyValue {
  return { key, value, kind: "predicted", method: p.model, uncertainty: p.uncertainty ?? null };
}

export function profileFromChemistry(molecule: Molecule, state: ProfileSource): CandidateProfile {
  const profile: CandidateProfile = {};
  const props = state.properties;
  if (props) {
    const method = `RDKit (${props.source})`;
    if (props.molecularWeight !== undefined) profile.mw = { key: "mw", value: props.molecularWeight, kind: "computed", method, uncertainty: null };
    for (const key of DESCRIPTOR_KEYS) {
      const d = props.descriptors[key];
      if (d) profile[key] = { key, value: d.value, kind: "computed", method, uncertainty: null };
    }
  }
  for (const p of state.predictions) {
    const key = PREDICTION_KEYS[p.id];
    if (key && typeof p.value === "number") profile[key] = fromPrediction(key, p, p.value);
    if (p.id === "acid-base" && typeof p.value === "string") {
      const cat = /^amphoteric/.test(p.value) ? "amphoteric" : /^acidic/.test(p.value) ? "acidic" : /^basic/.test(p.value) ? "basic" : "neutral";
      profile.acidBase = fromPrediction("acidBase", p, cat);
    }
  }
  // Hansen parameters straight from the model (the prediction list carries them as one string).
  const mw = props?.molecularWeight ?? molecularWeight(molecule, { includeImplicitHydrogens: true }).value;
  if (mw !== undefined && molecule.atoms.some((a) => a.element !== "H")) {
    const dens = girolamiDensity(molecule, mw);
    const h = dens ? hansenParameters(molecule, mw / dens.density) : null;
    if (h) {
      const method = "Hoftyzer–Van Krevelen group contributions with the Girolami molar volume";
      const unc = "typically 1–2 MPa½ per component";
      profile.hansenDd = { key: "hansenDd", value: h.dd, kind: "predicted", method, uncertainty: unc };
      profile.hansenDp = { key: "hansenDp", value: h.dp, kind: "predicted", method, uncertainty: unc };
      profile.hansenDh = { key: "hansenDh", value: h.dh, kind: "predicted", method, uncertainty: `${unc}; δh the least reliable` };
      profile.hansenDt = { key: "hansenDt", value: h.dt, kind: "predicted", method, uncertainty: unc };
    }
  }
  return profile;
}
