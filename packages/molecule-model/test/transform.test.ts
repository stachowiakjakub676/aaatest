import { describe, expect, it } from "vitest";
import { addAtom, addBond, branchFrom, createMolecule, dihedralAngle, distance, getSampleMolecule, invertCentre, mirrorMolecule, rotateAroundBond, v3 } from "../src";
import type { Molecule } from "../src";

const s = (id: string) => getSampleMolecule(id)!;

function bondLengths(m: Molecule): number[] {
  return m.bonds.map((b) => distance(m.atoms.find((a) => a.id === b.atomA)!.position, m.atoms.find((a) => a.id === b.atomB)!.position));
}

describe("mirrorMolecule", () => {
  it("reflects coordinates and keeps all distances", () => {
    const g = s("glucose");
    const m = mirrorMolecule(g);
    expect(m.atoms[0]!.position.x).toBeCloseTo(-g.atoms[0]!.position.x);
    expect(bondLengths(m).map((x) => x.toFixed(4))).toEqual(bondLengths(g).map((x) => x.toFixed(4)));
    // Handedness flips: the signed volume of any four atoms changes sign.
    const [a, b, c, d] = g.atoms.slice(0, 4).map((x) => x.position);
    const [a2, b2, c2, d2] = m.atoms.slice(0, 4).map((x) => x.position);
    const vol = (p: typeof a, q: typeof a, r: typeof a, t: typeof a) => v3.dot(v3.sub(q!, p!), v3.cross(v3.sub(r!, p!), v3.sub(t!, p!)));
    expect(Math.sign(vol(a2, b2, c2, d2))).toBe(-Math.sign(vol(a, b, c, d)));
  });
});

describe("rotateAroundBond", () => {
  it("rotates one branch rigidly and changes the dihedral by the requested angle", () => {
    const e = s("ethanol");
    const cc = e.bonds.find((b) => e.atoms.find((a) => a.id === b.atomA)!.element === "C" && e.atoms.find((a) => a.id === b.atomB)!.element === "C")!;
    const branch = branchFrom(e, cc.atomB, cc.atomA);
    // pick a dihedral H-C-C-O style: neighbour of A (not B), A, B, neighbour of B (not A)
    const nA = e.bonds.map((b) => (b.atomA === cc.atomA ? b.atomB : b.atomB === cc.atomA ? b.atomA : null)).find((x) => x && x !== cc.atomB)!;
    const nB = e.bonds.map((b) => (b.atomA === cc.atomB ? b.atomB : b.atomB === cc.atomB ? b.atomA : null)).find((x) => x && x !== cc.atomA)!;
    const pos = (m: Molecule, id: string) => m.atoms.find((a) => a.id === id)!.position;
    const before = dihedralAngle(pos(e, nA), pos(e, cc.atomA), pos(e, cc.atomB), pos(e, nB));
    const rotated = rotateAroundBond(e, cc.id, Math.PI / 3);
    const after = dihedralAngle(pos(rotated, nA), pos(rotated, cc.atomA), pos(rotated, cc.atomB), pos(rotated, nB));
    let delta = after - before;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    expect(Math.abs(delta)).toBeCloseTo(Math.PI / 3, 3);
    expect(bondLengths(rotated).map((x) => x.toFixed(3))).toEqual(bondLengths(e).map((x) => x.toFixed(3)));
    // Atoms on the fixed side did not move.
    for (const a of e.atoms) if (!branch.has(a.id)) expect(pos(rotated, a.id)).toEqual(a.position);
  });

  it("refuses ring bonds and unknown bonds", () => {
    const bz = s("benzene");
    const ring = bz.bonds.find((b) => bz.atoms.find((a) => a.id === b.atomA)!.element === "C" && bz.atoms.find((a) => a.id === b.atomB)!.element === "C")!;
    expect(() => rotateAroundBond(bz, ring.id, 1)).toThrow(/ring bond/);
    expect(() => rotateAroundBond(bz, "nope", 1)).toThrow(/Unknown bond/);
  });
});

describe("invertCentre", () => {
  it("swaps two substituent branches around a tetrahedral centre, changing handedness", () => {
    // Bromochlorofluoromethane: C with F, Cl, Br, H.
    let m = createMolecule({ id: "chiral" });
    m = addAtom(m, { id: "c", element: "C", position: { x: 0, y: 0, z: 0 } }).molecule;
    const subs: Array<[string, string, [number, number, number]]> = [
      ["f", "F", [1.0, 1.0, 1.0]],
      ["cl", "Cl", [-1.0, -1.0, 1.0]],
      ["br", "Br", [-1.0, 1.0, -1.0]],
      ["h", "H", [1.0, -1.0, -1.0]],
    ];
    for (const [id, el, [x, y, z]] of subs) {
      m = addAtom(m, { id, element: el, position: { x, y, z } }).molecule;
      m = addBond(m, { atomA: "c", atomB: id }).molecule;
    }
    const pos = (mol: Molecule, id: string) => mol.atoms.find((a) => a.id === id)!.position;
    const chir = (mol: Molecule) => Math.sign(v3.dot(v3.sub(pos(mol, "f"), pos(mol, "c")), v3.cross(v3.sub(pos(mol, "cl"), pos(mol, "c")), v3.sub(pos(mol, "br"), pos(mol, "c")))));
    const inverted = invertCentre(m, "c");
    expect(inverted).not.toBeNull();
    expect(chir(inverted!)).toBe(-chir(m));
    expect(bondLengths(inverted!).map((x) => x.toFixed(3)).sort()).toEqual(bondLengths(m).map((x) => x.toFixed(3)).sort());
  });

  it("returns null for centres without two independent branches", () => {
    const bz = s("benzene");
    const c = bz.atoms.find((a) => a.element === "C")!;
    expect(invertCentre(bz, c.id)).toBeNull();
    expect(() => invertCentre(bz, "ghost")).toThrow(/Unknown atom/);
  });
});
