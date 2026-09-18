/**
 * PREDICTED properties: outputs of published models, never measurements. Each item names its
 * model and states its error. The client-side ESOL regression only needs descriptors the
 * in-browser engine already computes, so it works offline; QED and synthetic accessibility come
 * from the server engine when it is available.
 */
import { findCycles, getAtom } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { ChemistryEngine, ComputedProperties, Prediction, PredictionService } from "./engine";

/** Fraction of heavy atoms that sit in an aromatic six-membered ring (ESOL's "aromatic proportion"). */
export function aromaticProportion(mol: Molecule): number {
  const heavy = mol.atoms.filter((a) => a.element !== "H");
  if (heavy.length === 0) return 0;
  const aromatic = new Set<string>();
  for (const cycle of findCycles(mol, 6)) {
    const bonds = cycle.map((id, i) => mol.bonds.find((b) => (b.atomA === id && b.atomB === cycle[(i + 1) % 6]) || (b.atomB === id && b.atomA === cycle[(i + 1) % 6]))!);
    const arom = bonds.every((b) => b.order === "aromatic");
    const kekule = bonds.filter((b) => b.order === "double").length === 3 && bonds.every((b, i) => b.order !== "double" || bonds[(i + 1) % 6]!.order !== "double");
    if (arom || kekule) for (const id of cycle) if (getAtom(mol, id)?.element !== "H") aromatic.add(id);
  }
  return aromatic.size / heavy.length;
}

/**
 * ESOL (Delaney, J. Chem. Inf. Comput. Sci. 2004, 44, 1000):
 * log S = 0.16 − 0.63·cLogP − 0.0062·MW + 0.066·RB − 0.74·AP, with S in mol/L.
 * Reported error on the training set: about 1 log unit (RMSE ~0.97).
 */
export function esolLogS(props: ComputedProperties, mol: Molecule): Prediction | null {
  const logP = props.descriptors.cLogP?.value;
  const rb = props.descriptors.rotatableBonds?.value;
  const mw = props.molecularWeight;
  if (logP === undefined || rb === undefined || mw === undefined) return null;
  const ap = aromaticProportion(mol);
  const logS = 0.16 - 0.63 * logP - 0.0062 * mw + 0.066 * rb - 0.74 * ap;
  return {
    kind: "predicted",
    id: "esol-logs",
    model: "ESOL (Delaney, J. Chem. Inf. Comput. Sci. 2004)",
    label: "Aqueous solubility, log S",
    value: Math.round(logS * 100) / 100,
    unit: "log(mol/L)",
    uncertainty: "±1 log unit (model RMSE ≈ 0.97 on its training set); linear regression on cLogP, MW, rotatable bonds and aromatic proportion",
  };
}

export class CompositePredictionService implements PredictionService {
  readonly label: string;
  constructor(
    private readonly engine: ChemistryEngine,
    private readonly propsRef: () => ComputedProperties | null,
  ) {
    this.label = engine.capabilities.estimates ? "ESOL (client) + QED and SA score (server)" : "ESOL (client); QED and SA score need the server engine";
  }

  async predict(mol: Molecule): Promise<Prediction[]> {
    const out: Prediction[] = [];
    const props = this.propsRef();
    if (props) {
      const esol = esolLogS(props, mol);
      if (esol) out.push(esol);
    }
    if (this.engine.capabilities.estimates) {
      try {
        out.push(...(await this.engine.estimates(mol)));
      } catch {
        /* server estimates are optional */
      }
    }
    return out;
  }
}
