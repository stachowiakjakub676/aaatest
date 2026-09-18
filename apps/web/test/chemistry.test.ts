import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { getSampleMolecule, createMolecule, molecularFormula } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import { WasmRdkitEngine, issuesFromLog } from "../src/chemistry/wasmEngine";
import type { RDKitModule } from "../src/chemistry/wasmEngine";
import { RemoteRdkitEngine } from "../src/chemistry/remoteEngine";
import { EngineError } from "../src/chemistry/engine";

const require = createRequire(import.meta.url);
// The RDKit glue is a UMD/CommonJS module that also runs under Node (reads the .wasm from disk).
const initRDKitModule = require("@rdkit/rdkit") as () => Promise<RDKitModule>;
const engine = new WasmRdkitEngine(() => initRDKitModule());

function sample(id: string): Molecule {
  const m = getSampleMolecule(id);
  if (!m) throw new Error(id);
  return m;
}

function pentavalentCarbon(): Molecule {
  return createMolecule({
    id: "bad",
    atoms: [{ id: "c", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } }, ...[1, 2, 3, 4, 5].map((i) => ({ id: `h${i}`, element: "H", formalCharge: 0, position: { x: i, y: 0, z: 0 } }))],
    bonds: [1, 2, 3, 4, 5].map((i) => ({ id: `b${i}`, atomA: "c", atomB: `h${i}`, order: "single" as const })),
  });
}

describe("WasmRdkitEngine (RDKit WebAssembly in node)", () => {
  it("loads and reports its version", async () => {
    const { version } = await engine.ready();
    expect(version).toMatch(/^\d{4}\.\d{2}/);
    expect(engine.capabilities.optimizeGeometry).toBe(false);
  }, 30000);

  it("validates sane structures and reports RDKit valence errors with atom ids", async () => {
    expect(await engine.validate(sample("caffeine"))).toEqual({ valid: true, issues: [] });
    expect(await engine.validate(createMolecule({ id: "e" }))).toEqual({ valid: true, issues: [] });
    const bad = await engine.validate(pentavalentCarbon());
    expect(bad.valid).toBe(false);
    expect(bad.issues[0]).toMatchObject({ code: "RDKIT_VALENCE", severity: "error", atomIds: ["c"] });
    expect(bad.issues[0]!.message).toMatch(/valence/i);
  }, 30000);

  it("computes descriptors, SMILES and InChI for caffeine", async () => {
    const p = await engine.properties(sample("caffeine"));
    expect(p.kind).toBe("computed");
    expect(p.source).toMatch(/^rdkit-wasm/);
    expect(p.canonicalSmiles.replace(/\[H\]/g, "")).toContain("n");
    expect(p.descriptors.aromaticRingCount?.value).toBe(2);
    expect(p.descriptors.hBondAcceptors?.value).toBe(6);
    expect(p.descriptors.tpsa?.value).toBeCloseTo(61.82, 1);
    expect(p.molecularWeight).toBeCloseTo(194.194, 2);
    expect(p.exactMass).toBeCloseTo(194.0804, 3);
    expect(p.inchiKey).toBe("RYYVLZVUVIJVGH-UHFFFAOYSA-N");
  }, 30000);

  it("counts implicit hydrogens for heavy-atom sketches", async () => {
    const ethanol = createMolecule({
      id: "etoh",
      atoms: [
        { id: "c1", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } },
        { id: "c2", element: "C", formalCharge: 0, position: { x: 1.5, y: 0, z: 0 } },
        { id: "o", element: "O", formalCharge: 0, position: { x: 3, y: 0, z: 0 } },
      ],
      bonds: [
        { id: "b1", atomA: "c1", atomB: "c2", order: "single" },
        { id: "b2", atomA: "c2", atomB: "o", order: "single" },
      ],
    });
    const p = await engine.properties(ethanol);
    expect(p.canonicalSmiles).toBe("CCO");
    expect(p.molecularWeight).toBeCloseTo(46.069, 2);
    expect(molecularFormula(ethanol, { includeImplicitHydrogens: true })).toBe("C2H6O");
  }, 30000);

  it("refuses properties for unsanitisable structures with the validation attached", async () => {
    await expect(engine.properties(pentavalentCarbon())).rejects.toBeInstanceOf(EngineError);
    try {
      await engine.properties(pentavalentCarbon());
    } catch (e) {
      expect((e as EngineError).validation?.valid).toBe(false);
    }
    await expect(engine.optimizeGeometry()).rejects.toThrow(/server engine/);
  }, 30000);
});

describe("issuesFromLog", () => {
  it("maps RDKit atom indices to atom ids and classifies messages", () => {
    const mol = pentavalentCarbon();
    const issues = issuesFromLog("[12:00:00] Explicit valence for atom # 0 C, 5, is greater than permitted\n[12:00:01] Can't kekulize mol.", mol);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ code: "RDKIT_VALENCE", atomIds: ["c"] });
    expect(issues[1]).toMatchObject({ code: "RDKIT_KEKULIZE" });
    expect(issuesFromLog("", mol)[0]!.code).toBe("RDKIT_SANITIZE");
  });
});

describe("RemoteRdkitEngine", () => {
  const water = sample("water");

  function fakeFetch(routes: Record<string, { status: number; body: unknown }>): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const path = new URL(url).pathname;
      const route = routes[path];
      if (!route) return new Response("not found", { status: 404 });
      if (init?.body) JSON.parse(String(init.body)); // must be valid JSON
      return new Response(JSON.stringify(route.body), { status: route.status, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
  }

  it("talks to the API and applies optimised coordinates while keeping identity", async () => {
    const moved = { ...water, atoms: water.atoms.map((a) => ({ ...a, position: { x: 9, y: 9, z: 9 } })) };
    const eng = new RemoteRdkitEngine(
      "http://localhost:8000/",
      fakeFetch({
        "/health": { status: 200, body: { status: "ok", rdkitVersion: "2026.03.6" } },
        "/validate": { status: 200, body: { valid: true, issues: [] } },
        "/properties": { status: 200, body: { source: "rdkit 2026.03.6", canonicalSmiles: "O", molecularWeight: 18.015, exactMass: 18.0106, descriptors: { tpsa: { label: "TPSA", unit: "Å²", value: 20.23 } }, inchi: "InChI=1S/H2O/h1H2", inchiKey: "XLYOFNOQVPJJNP-UHFFFAOYSA-N" } },
        "/optimize": { status: 200, body: { source: "rdkit MMFF94", molecule: moved, forceField: "MMFF94", converged: true, energy: -1.2, energyUnit: "kcal/mol" } },
      }),
    );
    expect((await eng.ready()).version).toBe("2026.03.6");
    expect((await eng.validate(water)).valid).toBe(true);
    const p = await eng.properties(water);
    expect(p.source).toBe("rdkit 2026.03.6 (server)");
    expect(p.descriptors.tpsa?.value).toBe(20.23);
    const o = await eng.optimizeGeometry(water);
    expect(o.molecule.id).toBe(water.id);
    expect(o.molecule.atoms.every((a) => a.position.x === 9)).toBe(true);
    expect(o.forceField).toBe("MMFF94");
  });

  it("surfaces server validation and connectivity errors", async () => {
    const eng = new RemoteRdkitEngine(
      "http://localhost:8000",
      fakeFetch({ "/properties": { status: 409, body: { detail: { message: "Structure does not sanitise", validation: { valid: false, issues: [{ code: "X", severity: "error", message: "bad" }] } } } } }),
    );
    try {
      await eng.properties(water);
      throw new Error("expected failure");
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      expect((e as EngineError).validation?.issues[0]?.code).toBe("X");
    }
    const down = new RemoteRdkitEngine("http://localhost:1", async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(down.ready()).rejects.toThrow(/unreachable/);
  });
});
