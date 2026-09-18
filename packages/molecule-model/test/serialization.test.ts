import { describe, expect, it } from "vitest";
import { MoleculeParseError, SAMPLE_MOLECULES, createMolecule, moleculeFromObject, parseMolecule, serializeMolecule } from "../src";

describe("serialization round trip", () => {
  it("round-trips every sample molecule losslessly", () => {
    for (const sample of SAMPLE_MOLECULES) {
      const json = serializeMolecule(sample);
      expect(parseMolecule(json)).toEqual(sample);
      expect(parseMolecule(serializeMolecule(sample, true))).toEqual(sample);
    }
  });

  it("round-trips optional fields", () => {
    const mol = createMolecule({
      id: "opt",
      name: "optional fields",
      atoms: [
        { id: "a", element: "C", formalCharge: -1, position: { x: 0.5, y: -1, z: 2 }, isotope: 13, chirality: "clockwise", implicitHydrogens: 1 },
        { id: "b", element: "C", formalCharge: 0, position: { x: 1.5, y: 0, z: 0 } },
      ],
      bonds: [{ id: "ab", atomA: "a", atomB: "b", order: "double", stereo: "E" }],
      conformers: [{ id: "c2", name: "alt", energy: -1.5, positions: { a: { x: 0, y: 0, z: 0 }, b: { x: 1, y: 1, z: 1 } } }],
      metadata: { source: "test", version: 2, draft: true },
    });
    expect(parseMolecule(serializeMolecule(mol))).toEqual(mol);
  });

  it("defaults formalCharge to 0 and metadata to {} when absent", () => {
    const mol = moleculeFromObject({
      schemaVersion: 1,
      id: "min",
      atoms: [{ id: "a", element: "H", position: { x: 0, y: 0, z: 0 } }],
      bonds: [],
    });
    expect(mol.atoms[0]!.formalCharge).toBe(0);
    expect(mol.metadata).toEqual({});
  });
});

describe("parseMolecule rejects malformed input", () => {
  const valid = {
    schemaVersion: 1,
    id: "m",
    atoms: [{ id: "a", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } }],
    bonds: [{ id: "b", atomA: "a", atomB: "a", order: "single" }],
  };

  it.each<[string, unknown, RegExp]>([
    ["non-JSON", "{not json", /Invalid JSON/],
    ["non-object", [], /\$: expected object/],
    ["wrong schema version", { ...valid, schemaVersion: 2 }, /schemaVersion/],
    ["missing id", { ...valid, id: "" }, /\$\.id/],
    ["atoms not array", { ...valid, atoms: {} }, /\$\.atoms/],
    ["atom without position", { ...valid, atoms: [{ id: "a", element: "C" }] }, /atoms\[0\]\.position/],
    ["atom with string coordinate", { ...valid, atoms: [{ id: "a", element: "C", position: { x: "0", y: 0, z: 0 } }] }, /numeric x, y, z/],
    ["atom with bad chirality", { ...valid, atoms: [{ ...valid.atoms[0], chirality: "R" }] }, /chirality/],
    ["bond with bad order", { ...valid, bonds: [{ id: "b", atomA: "a", atomB: "a", order: 2 }] }, /bonds\[0\]\.order/],
    ["bond with bad stereo", { ...valid, bonds: [{ ...valid.bonds[0], stereo: "cis" }] }, /stereo/],
    ["metadata with nested object", { ...valid, metadata: { nested: {} } }, /metadata\.nested/],
    ["conformer without positions", { ...valid, conformers: [{ id: "c" }] }, /conformers\[0\]\.positions/],
  ])("%s", (_label, input, pattern) => {
    const json = typeof input === "string" ? input : JSON.stringify(input);
    expect(() => parseMolecule(json)).toThrow(MoleculeParseError);
    expect(() => parseMolecule(json)).toThrow(pattern);
  });
});
