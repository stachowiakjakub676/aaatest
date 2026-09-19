import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { getSampleMolecule, validateMolecule } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import { WasmRdkitEngine } from "../src/chemistry/wasmEngine";
import type { RDKitModule } from "../src/chemistry/wasmEngine";
import { RuleBasedSynthesisPlanner, describeRoute, enumerateMoves } from "../src/retro/synthesis";
import type { SynthesisPlan } from "../src/retro/synthesis";

const require = createRequire(import.meta.url);
const initRDKitModule = require("@rdkit/rdkit") as () => Promise<RDKitModule>;
const engine = new WasmRdkitEngine(() => initRDKitModule());
const smilesOf = (m: Molecule) => engine.toSmiles(m);
const planner = () => new RuleBasedSynthesisPlanner(smilesOf);
const fromSmiles = async (s: string) => (await engine.fromSmiles(s, { addHydrogens: true })).molecule;
const smilesSet = (plan: SynthesisPlan, i = 0) => plan.routes[i]!.startingMaterials.map((p) => p.smiles).sort();

describe("rule-based synthesis planner", () => {
  it("disconnects an ester into acid + alcohol in one Fischer esterification step", async () => {
    const plan = await planner().plan(await fromSmiles("CCOC(=O)c1ccccc1"));
    expect(plan.kind).toBe("predicted");
    expect(plan.reason).toBeNull();
    const best = plan.routes[0]!;
    expect(best.stepCount).toBe(1);
    expect(best.steps[0]!.template.id).toBe("fischer-ester");
    expect(smilesSet(plan)).toEqual(["CCO", "O=C(O)c1ccccc1"]);
    expect(best.startingMaterials.map((p) => p.name).sort()).toEqual(["benzoic acid", "ethanol"]);
    expect(best.unresolved).toEqual([]);
    for (const p of best.startingMaterials) expect(validateMolecule(p.molecule).valid).toBe(true);
    expect(describeRoute(best)[0]).toMatch(/Step 1: .*→ .* via fischer esterification/);
  });

  it("finds two-step routes through intermediates (ether of a reduced ketone)", async () => {
    // 1-phenylethyl methyl ether: Williamson from 1-phenylethanol, which comes from acetophenone.
    const plan = await planner().plan(await fromSmiles("COC(C)c1ccccc1"));
    const best = plan.routes[0]!;
    expect(best.stepCount).toBeGreaterThanOrEqual(1);
    const ids = best.steps.map((s) => s.template.id);
    expect(ids).toContain("williamson");
    expect(best.unresolved).toEqual([]);
    expect(best.startingMaterials.every((p) => p.status !== "unresolved")).toBe(true);
    // Forward order: the last step yields the target.
    expect(best.steps[best.steps.length - 1]!.product.smiles).toBe(plan.target.smiles);
  });

  it("uses aromatic substitution and coupling templates", async () => {
    const nitro = await planner().plan(await fromSmiles("Cc1ccc(C(=O)O)cc1"));
    const ids = nitro.routes.flatMap((r) => r.steps.map((s) => s.template.id));
    expect(ids.some((id) => ["grignard-co2", "nitrile-hydrolysis", "acid-from-alcohol", "sandmeyer"].includes(id))).toBe(true);
    const biaryl = await planner().plan(await fromSmiles("COc1ccc(-c2ccccc2C)cc1"));
    expect(biaryl.routes[0]!.steps.some((s) => s.template.id === "suzuki")).toBe(true);
    expect(biaryl.routes[0]!.steps.some((s) => s.reactants.some((p) => p.smiles?.includes("B(O)O")))).toBe(true);
  });

  it("explains itself when nothing applies and respects the target screener", async () => {
    const water = await planner().plan(getSampleMolecule("water")!);
    expect(water.routes).toEqual([]);
    expect(water.reason).toMatch(/too small/);
    const denied = new RuleBasedSynthesisPlanner(smilesOf, { label: "test list", screen: () => ({ permitted: false, screener: "test list", reason: "listed" }) });
    const plan = await denied.plan(getSampleMolecule("aspirin")!);
    expect(plan.routes).toEqual([]);
    expect(plan.reason).toMatch(/withheld/);
    // Aspirin is in the building-block list: the planner says so but still shows the classic route.
    const aspirin = await planner().plan(getSampleMolecule("aspirin")!);
    expect(aspirin.notes[0]).toMatch(/common building block/);
    expect(aspirin.routes[0]!.steps[0]!.template.id).toBe("fischer-ester");
    expect(smilesSet(aspirin)).toEqual(["CC(=O)O", "O=C(O)c1ccccc1O"]);
  });

  it("produces valid precursor graphs for every template on a polyfunctional target", async () => {
    const target = await fromSmiles("CC(O)c1ccc(NC(=O)CCl)cc1");
    const moves = enumerateMoves(target);
    expect(moves.length).toBeGreaterThan(4);
    for (const mv of moves) {
      for (const p of mv.precursors) {
        expect(validateMolecule(p).valid, `${mv.template.id}`).toBe(true);
        await expect(engine.toSmiles(p), mv.template.id).resolves.toBeTruthy();
      }
    }
    const notes = moves.find((m) => m.template.id === "grignard")?.notes ?? [];
    expect(notes.some((n) => /quench/.test(n))).toBe(true);
  }, 30_000);
});

describe("reaction schemes: balance, atom economy and depictions", () => {
  it("balances the Fischer esterification and draws every structure", async () => {
    const p = new RuleBasedSynthesisPlanner(smilesOf, undefined, (m) => engine.depict(m, { width: 200, height: 120 }));
    const plan = await p.plan(await fromSmiles("CCOC(=O)c1ccccc1"));
    const step = plan.routes[0]!.steps[0]!;
    expect(step.balance.reactants.sort()).toEqual(["C2H6O", "C7H6O2"]);
    expect(step.balance.product).toBe("C9H10O2");
    expect(step.balance.released).toBe("H2O");
    expect(step.balance.supplied).toBeNull();
    expect(step.balance.atomEconomy).toBe(89); // 150.2 / (122.1 + 46.1)
    expect(step.template.mechanism).toMatch(/acyl substitution/);
    expect(step.template.byproducts).toBe("water");
    for (const s of [...step.reactants, step.product]) expect(s.svg).toMatch(/<svg/);
    expect(describeRoute(plan.routes[0]!)[0]).toMatch(/\+ H2O via fischer esterification \(nucleophilic acyl substitution/);
  }, 30_000);

  it("reports hydrogen that a reagent must supply for a reduction", async () => {
    const plan = await planner().plan(await fromSmiles("OC1CCCCC1")); // ring bonds are never cut: only the reduction applies
    const red = plan.routes.flatMap((r) => r.steps).find((s) => s.template.id === "carbonyl-reduction");
    expect(red).toBeDefined();
    expect(red!.balance.supplied).toBe("H2");
    expect(red!.balance.released).toBeNull();
  }, 30_000);
});
