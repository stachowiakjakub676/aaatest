/**
 * Candidate evaluator for the design engine: the same chemistry engine and prediction models the
 * Chemistry tab uses, applied to any molecule and mapped onto the property catalogue. Values
 * carry their provenance; nothing the tools do not supply is invented.
 */
import type { Molecule } from "@molecular-cad/molecule-model";
import type { CandidateEvaluator, CandidateProfile } from "@molecular-cad/design-engine";
import type { ChemistryEngine } from "../chemistry/engine";
import { CompositePredictionService } from "../chemistry/predictions";
import { profileFromChemistry } from "./profile";

export function candidateEvaluator(engine: ChemistryEngine): CandidateEvaluator {
  return {
    models: [`descriptors: ${engine.label}`, "Joback & Reid (1987)", "Lee–Kesler (1975) / Watson (1943)", "Girolami (1994)", "ESOL (Delaney 2004)", "Hoftyzer–Van Krevelen Hansen parameters", "class-typical pKa ranges", ...(engine.capabilities.estimates ? ["QED (Bickerton 2012)", "SA score (Ertl & Schuffenhauer 2009)"] : [])],
    async profile(molecule: Molecule): Promise<CandidateProfile> {
      const properties = await engine.properties(molecule);
      const predictions = await new CompositePredictionService(engine, () => properties).predict(molecule);
      return profileFromChemistry(molecule, { properties, predictions });
    },
  };
}
