import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { FRAGMENTS, bondAnglesAt, cleanupGeometry, createMolecule, getSampleMolecule, molecularFormula, validateMolecule } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import { WasmRdkitEngine } from "../src/chemistry/wasmEngine";
import type { RDKitModule } from "../src/chemistry/wasmEngine";
import { RemoteRdkitEngine } from "../src/chemistry/remoteEngine";
import { CompositePredictionService, aromaticProportion, esolLogS } from "../src/chemistry/predictions";
import { attachFragment, flipDoubleBond, invertStereocentre, mirror, rotateBond, addFreeAtom, addBondedAtom } from "../src/editor/commands";
import { RULE_ANALYSIS } from "../src/ai/analysis";

const require = createRequire(import.meta.url);
const initRDKitModule = require("@rdkit/rdkit") as () => Promise<RDKitModule>;
const engine = new WasmRdkitEngine(() => initRDKitModule());
const sample = (id: string) => getSampleMolecule(id)!;

describe("fragment library", () => {
  it("ships valid, hydrogen-saturated 3D fragments with a replaceable hydrogen on the attachment atom", () => {
    expect(FRAGMENTS.length).toBeGreaterThan(30);
    for (const f of FRAGMENTS) {
      expect(validateMolecule(f.molecule).valid, f.id).toBe(true);
      const attach = f.molecule.atoms.find((a) => a.id === f.attachAtomId)!;
      expect(attach, f.id).toBeDefined();
      const hasH = f.molecule.bonds.some((b) => (b.atomA === attach.id || b.atomB === attach.id) && f.molecule.atoms.find((a) => a.id === (b.atomA === attach.id ? b.atomB : b.atomA))!.element === "H");
      expect(hasH, f.id).toBe(true);
      expect(new Set(FRAGMENTS.map((x) => x.id)).size).toBe(FRAGMENTS.length);
    }
  });

  it("attaches a phenyl to methane replacing one hydrogen on each side (toluene)", () => {
    const methane = sample("methane");
    const phenyl = FRAGMENTS.find((f) => f.id === "phenyl")!;
    const c = methane.atoms.find((a) => a.element === "C")!;
    const r = attachFragment(methane, c.id, phenyl);
    expect(molecularFormula(r.molecule)).toBe("C7H8");
    expect(validateMolecule(r.molecule).valid).toBe(true);
    expect(r.tidy).toBe(true);
    expect(r.selection?.atoms).toHaveLength(1);
    const tidy = cleanupGeometry(r.molecule, { maxIterations: 400 });
    for (const angle of bondAnglesAt(tidy.molecule, c.id)) expect(angle).toBeGreaterThan(100);
  }, 20000);

  it("attaches to a heavy-atom sketch without hydrogens and to a fresh atom", () => {
    const c = addFreeAtom(createMolecule({ id: "n" }), "C", { x: 0, y: 0, z: 0 });
    const cf3 = FRAGMENTS.find((f) => f.id === "trifluoromethyl")!;
    const r = attachFragment(c.molecule, c.selection!.atoms[0]!, cf3);
    expect(molecularFormula(r.molecule)).toBe("C2F3"); // implicit H on the first carbon
    expect(molecularFormula(r.molecule, { includeImplicitHydrogens: true })).toBe("C2H3F3");
    expect(() => attachFragment(r.molecule, "ghost", cf3)).toThrow(/no longer exists/);
  });
});

describe("stereochemistry commands", () => {
  it("mirror gives the enantiomer: every CIP label flips (RDKit WASM on 3D coordinates)", async () => {
    const g = sample("glucose");
    const before = await engine.stereo(g);
    expect(before.atoms.map((a) => a.label).sort()).toEqual(["R", "R", "R", "S", "S"]);
    const after = await engine.stereo(mirror(g).molecule);
    const flip = (l: string) => (l === "R" ? "S" : l === "S" ? "R" : l);
    for (const a of before.atoms) expect(after.atoms.find((x) => x.atomId === a.atomId)?.label).toBe(flip(a.label));
  }, 30000);

  it("inverting one centre flips only that label", async () => {
    const g = sample("glucose");
    const before = await engine.stereo(g);
    const target = before.atoms[0]!;
    const r = invertStereocentre(g, target.atomId);
    const after = await engine.stereo(cleanupGeometry(r.molecule, { maxIterations: 300 }).molecule);
    expect(after.atoms.find((a) => a.atomId === target.atomId)?.label).not.toBe(target.label);
    const others = before.atoms.filter((a) => a.atomId !== target.atomId);
    for (const a of others) expect(after.atoms.find((x) => x.atomId === a.atomId)?.label).toBe(a.label);
  }, 30000);

  it("flip E/Z rotates one side of a double bond and RDKit reports the new configuration", async () => {
    // Build 2-butene from a fresh sketch: C=C with methyls, tidy, then flip.
    let r = addFreeAtom(createMolecule({ id: "b" }), "C", { x: 0, y: 0, z: 0 });
    const c1 = r.selection!.atoms[0]!;
    r = addBondedAtom(r.molecule, c1, "C", "double");
    const c2 = r.selection!.atoms[0]!;
    r = addBondedAtom(r.molecule, c1, "C");
    r = addBondedAtom(r.molecule, c2, "C");
    const mol: Molecule = cleanupGeometry(r.molecule, { maxIterations: 400 }).molecule;
    const dbl = mol.bonds.find((b) => b.order === "double")!;
    const s1 = await engine.stereo(mol);
    expect(s1.bonds).toHaveLength(1);
    const flipped = cleanupGeometry(flipDoubleBond(mol, dbl.id).molecule, { maxIterations: 400 }).molecule;
    const s2 = await engine.stereo(flipped);
    expect(s2.bonds[0]?.label).not.toBe(s1.bonds[0]?.label);
    expect(() => rotateBond(sample("benzene"), sample("benzene").bonds[0]!.id, 30)).toThrow(/Ring/);
  }, 30000);

  it("reports unassigned stereocentres from the WASM engine", async () => {
    // Bromochlorofluoromethane drawn flat: RDKit marks the centre as unassigned ("?").
    const flat = createMolecule({
      id: "flat",
      atoms: [
        { id: "c", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } },
        { id: "f", element: "F", formalCharge: 0, position: { x: 1.35, y: 0, z: 0 } },
        { id: "cl", element: "Cl", formalCharge: 0, position: { x: -0.9, y: 1.5, z: 0 } },
        { id: "br", element: "Br", formalCharge: 0, position: { x: -0.9, y: -1.6, z: 0 } },
      ],
      bonds: [
        { id: "b1", atomA: "c", atomB: "f", order: "single" },
        { id: "b2", atomA: "c", atomB: "cl", order: "single" },
        { id: "b3", atomA: "c", atomB: "br", order: "single" },
      ],
    });
    const s = await engine.stereo(flat);
    expect(s.atoms).toEqual([{ atomId: "c", label: "?" }]);
  }, 30000);
});

describe("predictions are labelled and separated from computed values", () => {
  it("computes ESOL solubility from descriptors with citation and error", async () => {
    const asp = sample("aspirin");
    const props = await engine.properties(asp);
    expect(aromaticProportion(asp)).toBeCloseTo(6 / 13, 3);
    const p = esolLogS(props, asp)!;
    expect(p.kind).toBe("predicted");
    expect(p.model).toContain("Delaney");
    expect(p.uncertainty).toMatch(/log unit/);
    expect(p.value).toBeGreaterThan(-4);
    expect(p.value).toBeLessThan(0);
    expect(p.breakdown!.reduce((s, t) => s + t.contribution, 0)).toBeCloseTo(p.value as number, 1);
    expect(p.reasoning!.length).toBeGreaterThan(1);
    const svc = new CompositePredictionService(engine, () => props);
    const items = await svc.predict(asp);
    const ids = items.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["joback-tb", "joback-tm", "joback-state", "girolami-density", "esol-logs", "acid-base"]));
    expect(ids).not.toContain("qed"); // server only
    expect(items.every((i) => i.kind === "predicted" && i.model && i.group)).toBe(true);
    expect(svc.label).toMatch(/server engine/);
    // Aspirin: carboxylic acid → acidic; Joback groups give a solid at room temperature (exp. m.p. 136 °C).
    expect(items.find((i) => i.id === "acid-base")!.value).toMatch(/acidic \(carboxylic acid/);
    expect(items.find((i) => i.id === "joback-state")!.value).toBe("solid");
    const tb = items.find((i) => i.id === "joback-tb")!;
    expect(tb.breakdown!.some((r) => r.label.includes("COOH"))).toBe(true);
    expect(tb.reasoning!.some((r) => /dimer/.test(r))).toBe(true);
  }, 30000);

  it("collects server estimates through the remote engine", async () => {
    const water = sample("water");
    const eng = new RemoteRdkitEngine("http://localhost:8000", (async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === "/estimates") return new Response(JSON.stringify({ kind: "predicted", items: [{ id: "qed", model: "QED", label: "Drug-likeness", value: 0.4 }] }), { status: 200 });
      if (path === "/stereo") return new Response(JSON.stringify({ kind: "computed", source: "rdkit", atoms: [], bonds: [] }), { status: 200 });
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch);
    const items = await new CompositePredictionService(eng, () => null).predict(water);
    expect(items.find((i) => i.id === "qed")).toEqual({ kind: "predicted", group: "Drug-likeness (server)", id: "qed", model: "QED", label: "Drug-likeness", value: 0.4 });
    // Water is outside the Joback table: the method says so instead of guessing.
    expect(items.find((i) => i.id === "joback-na")!.value).toBe("not available");
    expect((await eng.stereo(water)).source).toBe("rdkit (server)");
  });

  it("adds Veber and Egan rule checks to the analysis report", async () => {
    const asp = sample("aspirin");
    const props = await engine.properties(asp);
    const report = RULE_ANALYSIS.analyze({ molecule: asp, validation: validateMolecule(asp), engineValidation: { valid: true, issues: [] }, properties: props });
    expect(report.ruleChecks.map((c) => c.id)).toEqual(["ro5-mw", "ro5-logp", "ro5-hbd", "ro5-hba", "veber-rb", "veber-tpsa", "egan-tpsa", "egan-logp"]);
    expect(report.ruleChecks.every((c) => c.passed)).toBe(true);
  }, 30000);
});
