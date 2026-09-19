/**
 * Attach a library fragment to an atom: one hydrogen on the anchor (if any) and one on the
 * fragment's attachment atom are replaced by the new bond. The fragment is placed at the ideal
 * bond length, oriented so its attachment direction points at the anchor; a clean-up pass relaxes
 * the geometry afterwards. Pure: returns a new molecule.
 */
import { addAtom, addBond, getAtom, neighborsOf, removeAtom } from "./molecule";
import { placeBondedAtom } from "./placement";
import type { FragmentTemplate } from "./samples/fragments";
import type { AtomId, Molecule, Vec3 } from "./types";
import { v3 } from "./vec3";

export interface AttachResult {
  molecule: Molecule;
  /** Id of the fragment's attachment atom in the new molecule. */
  attachedAtomId: AtomId;
}

function covalentSum(a: string, b: string): number {
  // Ideal single-bond length via the placement helper's rule (sum of covalent radii).
  return placeBondedAtom({ schemaVersion: 1, id: "t", atoms: [{ id: "x", element: a, formalCharge: 0, position: { x: 0, y: 0, z: 0 } }], bonds: [], metadata: {} }, "x", b).x;
}

export function attachFragment(mol: Molecule, anchorId: AtomId, fragment: FragmentTemplate): AttachResult {
  const anchor = getAtom(mol, anchorId);
  if (!anchor) throw new Error("Anchor atom no longer exists.");
  const frag = fragment.molecule;
  const attach = getAtom(frag, fragment.attachAtomId);
  if (!attach) throw new Error("Fragment template is malformed.");

  // 1. Remove one hydrogen from the anchor (the one whose direction we will reuse), if present.
  let m = mol;
  let direction: Vec3 | null = null;
  const anchorHs = neighborsOf(m, anchorId).filter((n) => getAtom(m, n)?.element === "H");
  if (anchorHs.length > 0) {
    const h = getAtom(m, anchorHs[0]!)!;
    direction = v3.normalize(v3.sub(h.position, anchor.position));
    m = removeAtom(m, h.id);
  }
  // 2. Target position for the fragment's attachment atom.
  const target = direction ? v3.add(anchor.position, v3.scale(direction, covalentSum(anchor.element, attach.element))) : placeBondedAtom(m, anchorId, attach.element);
  const toAnchor = v3.normalize(v3.sub(anchor.position, target));

  // 3. Fragment frame: drop one hydrogen on the attachment atom, use its direction as the "bond out" axis.
  const fragHs = neighborsOf(frag, attach.id).filter((n) => getAtom(frag, n)?.element === "H");
  if (fragHs.length === 0) throw new Error("Fragment attachment atom has no hydrogen to replace.");
  const hOut = getAtom(frag, fragHs[0]!)!;
  const outDir = v3.normalize(v3.sub(hOut.position, attach.position));
  const axis = v3.cross(outDir, toAnchor);
  const angle = v3.angle(outDir, toAnchor);
  const rotate = (p: Vec3): Vec3 => {
    const rel = v3.sub(p, attach.position);
    const r = v3.length(axis) < 1e-6 ? (angle > Math.PI / 2 ? v3.scale(rel, -1) : rel) : v3.rotate(rel, axis, angle);
    return v3.add(target, r);
  };

  // 4. Copy fragment atoms/bonds with fresh ids.
  const idMap = new Map<AtomId, AtomId>();
  for (const a of frag.atoms) {
    if (a.id === hOut.id) continue;
    const added = addAtom(m, { element: a.element, position: rotate(a.position), formalCharge: a.formalCharge });
    m = added.molecule;
    idMap.set(a.id, added.atom.id);
  }
  for (const b of frag.bonds) {
    const a1 = idMap.get(b.atomA);
    const a2 = idMap.get(b.atomB);
    if (!a1 || !a2) continue;
    m = addBond(m, { atomA: a1, atomB: a2, order: b.order }).molecule;
  }
  const newAttach = idMap.get(attach.id)!;
  m = addBond(m, { atomA: anchorId, atomB: newAttach }).molecule;
  return { molecule: m, attachedAtomId: newAttach };
}
