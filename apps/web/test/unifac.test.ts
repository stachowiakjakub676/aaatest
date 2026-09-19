import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { getSampleMolecule } from "@molecular-cad/molecule-model";
import { WasmRdkitEngine } from "../src/chemistry/wasmEngine";
import type { RDKitModule } from "../src/chemistry/wasmEngine";

const require = createRequire(import.meta.url);
const initRDKitModule = require("@rdkit/rdkit") as () => Promise<RDKitModule>;
const engine = new WasmRdkitEngine(() => initRDKitModule());

interface Fixture {
  thermo: string;
  assignments: Array<{ name: string; smiles: string; success: boolean; groups: Record<string, number>; status: string }>;
}
const fixture = JSON.parse(readFileSync(new URL("../../../packages/molecule-model/test/fixtures/unifac.json", import.meta.url), "utf8")) as Fixture;
const toGroups = (g: Record<string, number>) => Object.fromEntries(Object.entries(g).map(([k, v]) => [Number(k), v]));

describe("UNIFAC fragmentation on RDKit WebAssembly", () => {
  it(`assigns the same subgroups as the reference implementation (thermo ${fixture.thermo}) for every solvent and test molecule`, async () => {
    for (const a of fixture.assignments) {
      const mol = (await engine.fromSmiles(a.smiles, { name: a.name })).molecule;
      const r = await engine.unifacGroups(mol);
      expect(r.success, `${a.name}: ${r.status}`).toBe(a.success);
      if (a.success) expect(r.groups, a.name).toEqual(toGroups(a.groups));
    }
  }, 120_000);

  it("works on the built-in 3D samples with explicit hydrogens", async () => {
    expect((await engine.unifacGroups(getSampleMolecule("ethanol")!)).groups).toEqual({ 1: 1, 2: 1, 14: 1 });
    expect((await engine.unifacGroups(getSampleMolecule("aspirin")!)).groups).toEqual({ 9: 4, 10: 2, 21: 1, 42: 1 });
    expect((await engine.unifacGroups(getSampleMolecule("benzene")!)).groups).toEqual({ 9: 6 });
    const caffeine = await engine.unifacGroups(getSampleMolecule("caffeine")!);
    expect(caffeine.success).toBe(false);
    expect(caffeine.status).toMatch(/Did not match/);
  }, 60_000);
});
