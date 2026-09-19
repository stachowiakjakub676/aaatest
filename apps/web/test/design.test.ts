import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { FRAGMENTS, getSampleMolecule } from "@molecular-cad/molecule-model";
import { DERIVATIVE_GENERATOR, createRun, createSpecification, validateCandidates } from "@molecular-cad/design-engine";
import { WasmRdkitEngine } from "../src/chemistry/wasmEngine";
import type { RDKitModule } from "../src/chemistry/wasmEngine";
import { structureTools } from "../src/design/structureTools";
import { profileFromChemistry } from "../src/design/profile";
import type { ChemistryState } from "../src/chemistry/useChemistry";

const require = createRequire(import.meta.url);
const initRDKitModule = require("@rdkit/rdkit") as () => Promise<RDKitModule>;
const engine = new WasmRdkitEngine(() => initRDKitModule());
const tools = structureTools(engine);

describe("structure tools on RDKit WebAssembly", () => {
  it("answers substructure questions and reports unparsable patterns", async () => {
    const ethanol = getSampleMolecule("ethanol")!;
    expect(await tools.hasSubstructure(ethanol, "[OX2H]")).toBe(true);
    expect(await tools.hasSubstructure(ethanol, "c1ccccc1")).toBe(false);
    expect(await tools.hasSubstructure(ethanol, "bad(")).toBeNull();
    expect(await tools.canonicalSmiles(ethanol)).toBe("CCO");
    expect((await tools.validate(ethanol)).valid).toBe(true);
  }, 30_000);

  it("validates generated derivatives: duplicates collapse by canonical SMILES, SMARTS rules apply", async () => {
    const seed = getSampleMolecule("ethanol")!;
    const spec = { ...createSpecification("t"), structural: { allowedElements: ["C", "H", "O"], minHeavyAtoms: null, maxHeavyAtoms: 6, neutral: true, requiredSubstructures: ["[OX2H]"], forbiddenSubstructures: ["C(=O)O"] } };
    const cands = await DERIVATIVE_GENERATOR.generate({ spec, seed, limit: 100, fragments: FRAGMENTS, libraries: [], parseSmiles: async () => null }, { ...DERIVATIVE_GENERATOR.defaults, categories: "alkyl,group" });
    const run = await validateCandidates(createRun(spec, DERIVATIVE_GENERATOR, {}, seed, { app: "test", engine: "wasm", models: [] }), cands, tools);
    expect(run.summary.valid).toBeGreaterThan(0);
    const valid = run.records.filter((r) => r.status === "valid");
    expect(new Set(valid.map((r) => r.canonicalSmiles)).size).toBe(valid.length);
    // Methyl at the OH oxygen gives methoxyethane: no O–H left → rejected by the required pattern.
    const ether = run.records.find((r) => /Methyl @ O/.test(r.candidate.name))!;
    expect(ether.status).toBe("rejected");
    expect(ether.rejection!.stage).toBe("substructure");
    expect(ether.rejection!.reason).toMatch(/lacks required substructure/);
    // Acetyl on a carbon keeps the OH but carries an ester/acid-like C(=O)O? No: an acetyl ketone passes; a carboxyl fragment is forbidden.
    const carboxyl = run.records.find((r) => /Carboxyl/.test(r.candidate.name));
    if (carboxyl) expect(carboxyl.rejection?.reason ?? "").toMatch(/forbidden substructure|lacks required/);
    // Structural scope: anything beyond 6 heavy atoms is rejected before the engine sees it.
    expect(run.rejectionsByStage.structural).toBeGreaterThan(0);
  }, 60_000);
});

describe("profile adapter", () => {
  it("maps descriptors and predictions onto the catalogue with provenance", () => {
    const ethanol = getSampleMolecule("ethanol")!;
    const state: ChemistryState = {
      status: "ready",
      version: "x",
      error: null,
      computing: false,
      validation: null,
      stereo: null,
      predictionSource: "",
      properties: { kind: "computed", source: "rdkit-wasm x", canonicalSmiles: "CCO", molecularWeight: 46.07, descriptors: { tpsa: { label: "TPSA", unit: "Å²", value: 20.23 }, cLogP: { label: "cLogP", unit: "", value: -0.0014 } } },
      predictions: [
        { kind: "predicted", id: "joback-tb", model: "Joback", label: "Tb", value: 64.4, unit: "°C", uncertainty: "≈ 13 K" },
        { kind: "predicted", id: "acid-base", model: "class pKa", label: "acid/base", value: "neutral (no ionisable group recognised)" },
      ],
    };
    const p = profileFromChemistry(ethanol, state);
    expect(p.mw).toEqual({ key: "mw", value: 46.07, kind: "computed", method: "RDKit (rdkit-wasm x)", uncertainty: null });
    expect(p.tpsa!.value).toBe(20.23);
    expect(p.tb).toEqual({ key: "tb", value: 64.4, kind: "predicted", method: "Joback", uncertainty: "≈ 13 K" });
    expect(p.acidBase!.value).toBe("neutral");
    expect(p.hansenDh!.kind).toBe("predicted");
    expect(p.hansenDh!.value).toBeGreaterThan(15);
    expect(p.logS).toBeUndefined();
  });
});
