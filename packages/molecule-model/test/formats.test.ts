import { describe, expect, it } from "vitest";
import { SAMPLE_MOLECULES, detectFormat, getSampleMolecule, molecularFormula, parseSdf, parseStructureText, serializeMolecule, validateMolecule, writeMolfile, writeSdf } from "../src";

describe("detectFormat", () => {
  it("recognises the supported text formats", () => {
    const water = getSampleMolecule("water")!;
    expect(detectFormat(serializeMolecule(water))).toBe("mcad-json");
    expect(detectFormat(writeMolfile(water))).toBe("molfile");
    expect(detectFormat(writeSdf([water]))).toBe("sdf");
    expect(detectFormat("CC(=O)Oc1ccccc1C(=O)O")).toBe("smiles");
    expect(detectFormat("C[C@H](N)C(=O)O aspirin-like name")).toBe("smiles");
    expect(detectFormat("")).toBe("unknown");
    expect(detectFormat("{not json")).toBe("unknown");
    expect(detectFormat('{"foo": 1}')).toBe("unknown");
    expect(detectFormat("hello world\nsecond line")).toBe("unknown");
  });
});

describe("SDF round trip", () => {
  it("writes and reads multi-record files with data items", () => {
    const mols = SAMPLE_MOLECULES.slice(0, 3).map((m) => ({ ...m, metadata: { ...m.metadata, mw: 12.5, note: "hello world" } }));
    const text = writeSdf(mols);
    expect((text.match(/\$\$\$\$/g) ?? []).length).toBe(3);
    const back = parseSdf(text, { id: "batch" });
    expect(back).toHaveLength(3);
    back.forEach((m, i) => {
      expect(m.id).toBe(`batch-${i + 1}`);
      expect(m.name).toBe(mols[i]!.name);
      expect(m.atoms).toHaveLength(mols[i]!.atoms.length);
      expect(m.bonds).toHaveLength(mols[i]!.bonds.length);
      expect(m.metadata.mw).toBe(12.5);
      expect(m.metadata.note).toBe("hello world");
      expect(m.metadata.smiles).toBe((mols[i]!.metadata as Record<string, unknown>).smiles);
      expect(validateMolecule(m).valid).toBe(true);
      expect(molecularFormula(m)).toBe(molecularFormula(mols[i]!));
    });
  });

  it("parses a single record without a trailing terminator", () => {
    const text = writeMolfile(getSampleMolecule("methane")!) + ">  <rank>\n3\n";
    const [m] = parseSdf(text);
    expect(m!.atoms).toHaveLength(5);
    expect(m!.metadata.rank).toBe(3);
  });
});

describe("parseStructureText", () => {
  it("dispatches on format and leaves SMILES to the engine", () => {
    const water = getSampleMolecule("water")!;
    expect(parseStructureText(serializeMolecule(water)).molecules[0]).toEqual(water);
    expect(parseStructureText(writeMolfile(water)).format).toBe("molfile");
    expect(parseStructureText(writeSdf([water, water])).molecules).toHaveLength(2);
    expect(parseStructureText("CCO")).toEqual({ format: "smiles", molecules: [] });
    expect(parseStructureText("???").format).toBe("unknown");
  });
});
