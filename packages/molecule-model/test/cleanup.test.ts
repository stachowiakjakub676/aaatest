import { describe, expect, it } from "vitest";
import { addAtom, addBond, bondAnglesAt, cleanupGeometry, createMolecule, distance, getSampleMolecule, idealBondLength, placeBondedAtom, v3 } from "../src";
import type { Molecule, Vec3 } from "../src";

function chain(elements: string[], positions: Vec3[], orders: Array<"single" | "double" | "triple"> = []): Molecule {
  let m = createMolecule({ id: "t" });
  elements.forEach((el, i) => {
    m = addAtom(m, { id: `a${i}`, element: el, position: positions[i]! }).molecule;
    if (i > 0) m = addBond(m, { id: `b${i}`, atomA: `a${i - 1}`, atomB: `a${i}`, order: orders[i - 1] ?? "single" }).molecule;
  });
  return m;
}

function bondLengths(m: Molecule): number[] {
  return m.bonds.map((b) => distance(m.atoms.find((a) => a.id === b.atomA)!.position, m.atoms.find((a) => a.id === b.atomB)!.position));
}

/** Max distance of any atom from the best-fit plane through the first three atoms. */
function planarity(m: Molecule): number {
  const [p, q, r] = m.atoms.slice(0, 3).map((a) => a.position) as [Vec3, Vec3, Vec3];
  const n = v3.normalize(v3.cross(v3.sub(q, p), v3.sub(r, p)));
  return Math.max(...m.atoms.map((a) => Math.abs(v3.dot(v3.sub(a.position, p), n))));
}

describe("cleanupGeometry", () => {
  it("relaxes a crooked methane to tetrahedral angles and ideal C-H lengths", () => {
    const m = chain(["C"], [{ x: 0, y: 0, z: 0 }]);
    // Put four hydrogens in deliberately bad places (all on one side, wrong lengths).
    let mol = m;
    const spots: Vec3[] = [
      { x: 1.3, y: 0.1, z: 0 },
      { x: 0.9, y: 0.9, z: 0.2 },
      { x: 0.2, y: 1.4, z: -0.1 },
      { x: 0.8, y: 0.5, z: 0.9 },
    ];
    spots.forEach((p, i) => {
      mol = addAtom(mol, { id: `h${i}`, element: "H", position: p }).molecule;
      mol = addBond(mol, { atomA: "a0", atomB: `h${i}` }).molecule;
    });
    const r = cleanupGeometry(mol);
    expect(r.converged).toBe(true);
    for (const angle of bondAnglesAt(r.molecule, "a0")) expect(angle).toBeCloseTo(109.47, 0);
    for (const l of bondLengths(r.molecule)) expect(l).toBeCloseTo(idealBondLength("C", "H"), 2);
  });

  it("closes a carbon chain into a clean six-membered ring", () => {
    // Grow a zig-zag chain with the placement heuristic, then bond the ends.
    let mol = addAtom(createMolecule({ id: "ring" }), { id: "a0", element: "C", position: { x: 0, y: 0, z: 0 } }).molecule;
    for (let i = 1; i < 6; i++) {
      const pos = placeBondedAtom(mol, `a${i - 1}`, "C");
      mol = addAtom(mol, { id: `a${i}`, element: "C", position: pos }).molecule;
      mol = addBond(mol, { atomA: `a${i - 1}`, atomB: `a${i}` }).molecule;
    }
    const gap = distance(mol.atoms[0]!.position, mol.atoms[5]!.position);
    expect(gap).toBeGreaterThan(2.5); // the ends start far apart
    mol = addBond(mol, { atomA: "a5", atomB: "a0" }).molecule;
    const r = cleanupGeometry(mol);
    for (const l of bondLengths(r.molecule)) expect(l).toBeCloseTo(idealBondLength("C", "C"), 1);
    for (const a of r.molecule.atoms) for (const angle of bondAnglesAt(r.molecule, a.id)) expect(angle).toBeGreaterThan(105);
    for (const a of r.molecule.atoms) for (const angle of bondAnglesAt(r.molecule, a.id)) expect(angle).toBeLessThan(116);
  });

  it("makes an aromatic ring planar with 120 degree angles", () => {
    const benzene = getSampleMolecule("benzene")!;
    // Start from a badly distorted copy: scale, shear and lift atoms out of plane.
    const distorted: Molecule = {
      ...benzene,
      atoms: benzene.atoms.map((a, i) => ({ ...a, position: { x: a.position.x * 1.3 + 0.2 * i, y: a.position.y * 0.8, z: a.position.z + (i % 2 ? 0.5 : -0.4) } })),
    };
    const r = cleanupGeometry(distorted);
    const ringAtoms = r.molecule.atoms.filter((a) => a.element === "C");
    const ring = { ...r.molecule, atoms: ringAtoms };
    expect(planarity(ring)).toBeLessThan(0.05);
    for (const a of ringAtoms) for (const angle of bondAnglesAt(r.molecule, a.id)) expect(angle).toBeCloseTo(120, 0);
  });

  it("flattens a twisted double bond", () => {
    // Ethene with the two CH2 planes twisted by 90 degrees.
    const mol = createMolecule({
      id: "ethene",
      atoms: [
        { id: "c1", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } },
        { id: "c2", element: "C", formalCharge: 0, position: { x: 1.34, y: 0, z: 0 } },
        { id: "h1", element: "H", formalCharge: 0, position: { x: -0.5, y: 0.9, z: 0 } },
        { id: "h2", element: "H", formalCharge: 0, position: { x: -0.5, y: -0.9, z: 0 } },
        { id: "h3", element: "H", formalCharge: 0, position: { x: 1.84, y: 0, z: 0.9 } },
        { id: "h4", element: "H", formalCharge: 0, position: { x: 1.84, y: 0, z: -0.9 } },
      ],
      bonds: [
        { id: "b1", atomA: "c1", atomB: "c2", order: "double" },
        { id: "b2", atomA: "c1", atomB: "h1", order: "single" },
        { id: "b3", atomA: "c1", atomB: "h2", order: "single" },
        { id: "b4", atomA: "c2", atomB: "h3", order: "single" },
        { id: "b5", atomA: "c2", atomB: "h4", order: "single" },
      ],
    });
    const r = cleanupGeometry(mol, { jitter: 0.1 });
    expect(planarity(r.molecule)).toBeLessThan(0.08);
  });

  it("keeps fixed atoms exactly where they are and is deterministic", () => {
    const mol = chain(["C", "C", "O"], [{ x: 0, y: 0, z: 0 }, { x: 1.2, y: 0.3, z: 0 }, { x: 2.9, y: 0.1, z: 0.4 }]);
    const r1 = cleanupGeometry(mol, { fixedAtomIds: ["a0"] });
    const r2 = cleanupGeometry(mol, { fixedAtomIds: ["a0"] });
    expect(r1.molecule.atoms[0]!.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(r1.molecule).toEqual(r2.molecule);
    expect(bondAnglesAt(r1.molecule, "a1")[0]).toBeCloseTo(109.47, 0);
    expect(r1.energy).toBeLessThan(cleanupGeometry(mol, { maxIterations: 0 }).energy);
  });

  it("lifts a flat (2D) sketch into 3D when jitter is requested", () => {
    // Planar cyclohexane skeleton: without jitter it would stay flat (saddle point).
    const atoms = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, element: "C", formalCharge: 0, position: { x: 1.5 * Math.cos((i * Math.PI) / 3), y: 1.5 * Math.sin((i * Math.PI) / 3), z: 0 } }));
    const bonds = atoms.map((a, i) => ({ id: `b${i}`, atomA: a.id, atomB: atoms[(i + 1) % 6]!.id, order: "single" as const }));
    const flat = createMolecule({ id: "chx", atoms, bonds });
    const lifted = cleanupGeometry(flat, { jitter: 0.5 });
    const zSpread = Math.max(...lifted.molecule.atoms.map((a) => a.position.z)) - Math.min(...lifted.molecule.atoms.map((a) => a.position.z));
    expect(zSpread).toBeGreaterThan(0.3);
    for (const a of lifted.molecule.atoms) for (const angle of bondAnglesAt(lifted.molecule, a.id)) expect(angle).toBeCloseTo(109.47, -1);
  });

  it("handles empty molecules and lone atoms", () => {
    expect(cleanupGeometry(createMolecule({ id: "e" })).iterations).toBe(0);
    const lone = chain(["Fe"], [{ x: 1, y: 2, z: 3 }]);
    expect(cleanupGeometry(lone).molecule.atoms[0]!.position).toEqual({ x: 1, y: 2, z: 3 });
  });
});
