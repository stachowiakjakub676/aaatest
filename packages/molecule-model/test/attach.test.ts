import { describe, expect, it } from "vitest";
import { FRAGMENTS, attachFragment, getSampleMolecule, molecularFormula, validateMolecule } from "../src";

describe("attachFragment", () => {
  it("replaces one hydrogen on each side with the new bond and keeps the structure valid", () => {
    const ethanol = getSampleMolecule("ethanol")!;
    const methyl = FRAGMENTS.find((f) => f.id === "methyl")!;
    const carbon = ethanol.atoms.find((a) => a.element === "C")!;
    const r = attachFragment(ethanol, carbon.id, methyl);
    expect(molecularFormula(r.molecule, { includeImplicitHydrogens: true })).toBe("C3H8O");
    expect(validateMolecule(r.molecule).valid).toBe(true);
    expect(r.molecule.bonds.some((b) => (b.atomA === carbon.id && b.atomB === r.attachedAtomId) || (b.atomB === carbon.id && b.atomA === r.attachedAtomId))).toBe(true);
    expect(ethanol.atoms.length).toBe(9); // input untouched
    expect(() => attachFragment(ethanol, "nope", methyl)).toThrow(/Anchor atom/);
  });
});
