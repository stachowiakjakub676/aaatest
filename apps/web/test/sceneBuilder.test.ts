import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createMolecule, getSampleMolecule } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import {
  applySelection,
  atomRadius,
  buildMoleculeScene,
  labelText,
  lineCountForOrder,
  materialFor,
  moleculeBoundingSphere,
  pickFromObject,
  SELECTION_COLOR,
} from "../src/viewer/sceneBuilder";
import { applyPick, pruneSelection, EMPTY_SELECTION } from "../src/state/selection";
import { angleDeg, measureSelection } from "../src/state/measure";

function sample(id: string): Molecule {
  const m = getSampleMolecule(id);
  if (!m) throw new Error(id);
  return m;
}

describe("buildMoleculeScene keeps the scene synchronised with the graph", () => {
  it("creates one sphere per atom and two half-cylinders per drawn bond line", () => {
    const mol = sample("ethylene"); // C2H4: 1 double + 4 single bonds
    const scene = buildMoleculeScene(mol);
    expect(scene.atomMeshes.size).toBe(mol.atoms.length);
    expect(scene.bondSegments.size).toBe(mol.bonds.length);
    const totalLines = mol.bonds.reduce((s, b) => s + lineCountForOrder(b.order), 0);
    expect(totalLines).toBe(6); // 2 (double) + 4 (single)
    const segments = [...scene.bondSegments.values()].flat();
    expect(segments).toHaveLength(totalLines * 2);
    expect(scene.group.children).toHaveLength(mol.atoms.length + totalLines * 2);
  });

  it("tags every mesh with the id it represents", () => {
    const mol = sample("water");
    const scene = buildMoleculeScene(mol);
    for (const atom of mol.atoms) {
      const mesh = scene.atomMeshes.get(atom.id)!;
      expect(pickFromObject(mesh)).toEqual({ kind: "atom", id: atom.id });
      expect(mesh.position.toArray()).toEqual([atom.position.x, atom.position.y, atom.position.z]);
    }
    for (const bond of mol.bonds) {
      for (const seg of scene.bondSegments.get(bond.id)!) expect(pickFromObject(seg)).toEqual({ kind: "bond", id: bond.id });
    }
    expect(pickFromObject(new THREE.Group())).toBeNull();
    expect(pickFromObject(undefined)).toBeNull();
  });

  it("places bond cylinders between the two atoms", () => {
    const mol = sample("water");
    const scene = buildMoleculeScene(mol);
    const bond = mol.bonds[0]!;
    const a = scene.atomMeshes.get(bond.atomA)!.position;
    const b = scene.atomMeshes.get(bond.atomB)!.position;
    const [halfA, halfB] = scene.bondSegments.get(bond.id)! as [THREE.Mesh, THREE.Mesh];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    expect(halfA.position.distanceTo(a.clone().add(mid).multiplyScalar(0.5))).toBeLessThan(1e-6);
    expect(halfB.position.distanceTo(b.clone().add(mid).multiplyScalar(0.5))).toBeLessThan(1e-6);
    expect(halfA.scale.y + halfB.scale.y).toBeCloseTo(a.distanceTo(b), 6);
  });

  it("skips bonds whose atoms are missing instead of throwing", () => {
    const mol = createMolecule({
      id: "broken",
      atoms: [{ id: "a", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } }],
      bonds: [{ id: "b", atomA: "a", atomB: "ghost", order: "single" }],
    });
    const scene = buildMoleculeScene(mol);
    expect(scene.atomMeshes.size).toBe(1);
    expect(scene.bondSegments.size).toBe(0);
  });

  it("uses element sizes and colours from the periodic table", () => {
    expect(atomRadius("H")).toBeLessThan(atomRadius("C"));
    expect(atomRadius("H")).toBeGreaterThanOrEqual(0.16);
    const scene = buildMoleculeScene(sample("water"));
    const o = scene.atomMeshes.get("a1")!; // RDKit puts the oxygen first for "O"
    expect((o.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0d0d);
  });

  it("draws three lines for triple bonds and two for aromatic", () => {
    expect(lineCountForOrder("single")).toBe(1);
    expect(lineCountForOrder("double")).toBe(2);
    expect(lineCountForOrder("triple")).toBe(3);
    expect(lineCountForOrder("aromatic")).toBe(2);
    const acetylene = buildMoleculeScene(sample("acetylene"));
    const triple = sample("acetylene").bonds.find((b) => b.order === "triple")!;
    expect(acetylene.bondSegments.get(triple.id)).toHaveLength(6);
  });

  it("formats labels with isotope and charge", () => {
    expect(labelText("C", 0)).toBe("C");
    expect(labelText("N", 1)).toBe("N+");
    expect(labelText("O", -2)).toBe("O2-");
    expect(labelText("C", 0, 13)).toBe("13C");
  });
});

describe("selection highlighting", () => {
  it("swaps materials for selected atoms and bonds only", () => {
    const mol = sample("water");
    const scene = buildMoleculeScene(mol);
    applySelection(scene, ["a1"], [mol.bonds[0]!.id]);
    const selected = scene.atomMeshes.get("a1")!.material as THREE.MeshStandardMaterial;
    const plain = scene.atomMeshes.get("a2")!.material as THREE.MeshStandardMaterial;
    expect(selected.emissive.getHex()).toBe(SELECTION_COLOR);
    expect(plain.emissive.getHex()).toBe(0);
    expect((scene.bondSegments.get(mol.bonds[0]!.id)![0]!.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(SELECTION_COLOR);
    expect((scene.bondSegments.get(mol.bonds[1]!.id)![0]!.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0);
    // Deselecting restores the shared plain material.
    applySelection(scene, [], []);
    expect(scene.atomMeshes.get("a1")!.material).toBe(materialFor(0xff0d0d, false));
  });
});

describe("moleculeBoundingSphere", () => {
  it("encloses every atom", () => {
    const mol = sample("caffeine");
    const { center, radius } = moleculeBoundingSphere(mol);
    for (const a of mol.atoms) {
      expect(new THREE.Vector3(a.position.x, a.position.y, a.position.z).distanceTo(center)).toBeLessThanOrEqual(radius);
    }
    expect(moleculeBoundingSphere(createMolecule({ id: "e" })).radius).toBe(1);
  });
});

describe("selection state", () => {
  it("replaces on plain click and toggles on additive click", () => {
    let sel = applyPick(EMPTY_SELECTION, { kind: "atom", id: "a" }, false);
    expect(sel).toEqual({ atoms: ["a"], bonds: [] });
    sel = applyPick(sel, { kind: "atom", id: "b" }, true);
    expect(sel.atoms).toEqual(["a", "b"]);
    sel = applyPick(sel, { kind: "atom", id: "a" }, true);
    expect(sel.atoms).toEqual(["b"]);
    sel = applyPick(sel, { kind: "bond", id: "x" }, false);
    expect(sel).toEqual({ atoms: [], bonds: ["x"] });
    expect(applyPick(sel, { kind: "bond", id: "x" }, false)).toEqual(EMPTY_SELECTION);
    expect(applyPick(sel, null, false)).toEqual(EMPTY_SELECTION);
    expect(applyPick(sel, null, true)).toBe(sel);
  });

  it("prunes ids that vanished from the molecule", () => {
    const sel = { atoms: ["a", "gone"], bonds: ["b"] };
    expect(pruneSelection(sel, new Set(["a"]), new Set(["b"]))).toEqual({ atoms: ["a"], bonds: ["b"] });
    expect(pruneSelection(sel, new Set(["a", "gone"]), new Set(["b"]))).toBe(sel);
  });
});

describe("measurements", () => {
  it("computes distances and angles from the ordered selection", () => {
    const mol = sample("water");
    const [o, h1, h2] = mol.atoms.map((a) => a.id) as [string, string, string];
    const d = measureSelection(mol, [o, h1]);
    expect(d?.label).toMatch(/Distance/);
    expect(parseFloat(d!.value)).toBeGreaterThan(0.9);
    expect(parseFloat(d!.value)).toBeLessThan(1.05);
    const ang = measureSelection(mol, [h1, o, h2]);
    expect(parseFloat(ang!.value)).toBeGreaterThan(100);
    expect(parseFloat(ang!.value)).toBeLessThan(110);
    expect(measureSelection(mol, [o])).toBeUndefined();
    expect(angleDeg({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(90);
  });
});
