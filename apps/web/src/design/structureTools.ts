/** The design engine's view of the chemistry engine: validation, canonical SMILES and substructure tests. */
import type { Molecule } from "@molecular-cad/molecule-model";
import type { StructureTools } from "@molecular-cad/design-engine";
import type { WasmRdkitEngine } from "../chemistry/wasmEngine";

export function structureTools(engine: WasmRdkitEngine): StructureTools {
  return {
    async validate(mol: Molecule) {
      const v = await engine.validate(mol);
      return { valid: v.valid, issues: v.issues.filter((i) => i.severity === "error").map((i) => i.message) };
    },
    canonicalSmiles: (mol: Molecule) => engine.toSmiles(mol),
    hasSubstructure: (mol: Molecule, smarts: string) => engine.hasSubstructure(mol, smarts),
  };
}
