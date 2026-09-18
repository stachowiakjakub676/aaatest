import type { Molecule } from "../types";
import { GENERATED_SAMPLES } from "./generated";

/** Built-in sample molecules (3D coordinates generated deterministically with RDKit). */
export const SAMPLE_MOLECULES: readonly Molecule[] = GENERATED_SAMPLES;

export function getSampleMolecule(id: string): Molecule | undefined {
  return SAMPLE_MOLECULES.find((m) => m.id === id);
}
