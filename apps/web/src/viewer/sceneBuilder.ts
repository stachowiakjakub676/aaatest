/**
 * Builds Three.js objects from a Molecule. Pure with respect to the DOM (usable in node tests).
 *
 * The molecular graph is the source of truth: every mesh carries `userData` pointing back at
 * the atom/bond id it represents, and the scene is rebuilt whenever the molecule changes.
 */
import * as THREE from "three";
import { bondOrderValue, covalentRadius, elementColor, neighborsOf, vdwRadius } from "@molecular-cad/molecule-model";
import type { AtomId, Bond, BondId, Molecule, Vec3 } from "@molecular-cad/molecule-model";

export interface SceneStyle {
  id: "ball-and-stick" | "sticks" | "spacefill";
  /** Multiplier applied to the covalent (or van der Waals, for spacefill) radius for the atom sphere. */
  atomRadiusScale: number;
  minAtomRadius: number;
  bondRadius: number;
  /** Centre-to-centre spacing between the cylinders of a multiple bond (Å). */
  multiBondOffset: number;
  /** Spacefill: spheres use van der Waals radii and bonds are not drawn. */
  useVdw: boolean;
  drawBonds: boolean;
  /** Skip hydrogen atoms (and their bonds); the graph itself is untouched. */
  hideHydrogens: boolean;
}

export const BALL_AND_STICK: SceneStyle = {
  id: "ball-and-stick",
  atomRadiusScale: 0.32,
  minAtomRadius: 0.16,
  bondRadius: 0.075,
  multiBondOffset: 0.19,
  useVdw: false,
  drawBonds: true,
  hideHydrogens: false,
};

export const STICKS: SceneStyle = {
  id: "sticks",
  atomRadiusScale: 0.16,
  minAtomRadius: 0.12,
  bondRadius: 0.12,
  multiBondOffset: 0.22,
  useVdw: false,
  drawBonds: true,
  hideHydrogens: false,
};

export const SPACEFILL: SceneStyle = {
  id: "spacefill",
  atomRadiusScale: 1,
  minAtomRadius: 0.8,
  bondRadius: 0.075,
  multiBondOffset: 0.19,
  useVdw: true,
  drawBonds: false,
  hideHydrogens: false,
};

export const STYLES: Record<SceneStyle["id"], SceneStyle> = { "ball-and-stick": BALL_AND_STICK, sticks: STICKS, spacefill: SPACEFILL };

export type PickData = { kind: "atom"; id: AtomId } | { kind: "bond"; id: BondId };

export interface LabelAnchor {
  atomId: AtomId;
  text: string;
  position: Vec3;
  /** Sphere radius, so labels can be offset outside the atom. */
  radius: number;
}

export interface MoleculeSceneObjects {
  group: THREE.Group;
  atomMeshes: Map<AtomId, THREE.Mesh>;
  /** All cylinder segments of a bond (2 per drawn line: one half per atom colour). */
  bondSegments: Map<BondId, THREE.Mesh[]>;
  labels: LabelAnchor[];
  dispose(): void;
}

const SPHERE = new THREE.SphereGeometry(1, 32, 24);
const CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 18, 1, false);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export const SELECTION_COLOR = 0xffb454;
/** Colour for the "first atom picked" state of the bond tool. */
export const PENDING_COLOR = 0x4fb3bf;

export type Highlight = boolean | "pending";

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
export function materialFor(color: number, selected: Highlight, opacity = 1): THREE.MeshStandardMaterial {
  const key = `${color}:${selected === "pending" ? 2 : selected ? 1 : 0}:${opacity}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.05,
      transparent: opacity < 1,
      opacity,
    });
    if (selected) {
      m.emissive = new THREE.Color(selected === "pending" ? PENDING_COLOR : SELECTION_COLOR);
      m.emissiveIntensity = 0.55;
    }
    materialCache.set(key, m);
  }
  return m;
}

export function atomRadius(element: string, style: SceneStyle = BALL_AND_STICK): number {
  const base = style.useVdw ? vdwRadius(element) : covalentRadius(element);
  return Math.max(style.minAtomRadius, base * style.atomRadiusScale);
}

function toVec(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

/** Direction perpendicular to `dir`, preferably lying in the plane of a neighbouring atom. */
function multiBondPerpendicular(mol: Molecule, bond: Bond, dir: THREE.Vector3): THREE.Vector3 {
  const positions = new Map(mol.atoms.map((a) => [a.id, a.position]));
  const candidates: THREE.Vector3[] = [];
  for (const [self, other] of [
    [bond.atomA, bond.atomB],
    [bond.atomB, bond.atomA],
  ] as const) {
    const selfPos = toVec(positions.get(self)!);
    for (const n of neighborsOf(mol, self)) {
      if (n === other) continue;
      const v = toVec(positions.get(n)!).sub(selfPos);
      const perp = v.sub(dir.clone().multiplyScalar(v.dot(dir)));
      if (perp.lengthSq() > 1e-6) candidates.push(perp.normalize());
    }
  }
  if (candidates[0]) return candidates[0];
  // No neighbours: any perpendicular will do, choose one that is stable for the given axis.
  const helper = Math.abs(dir.y) < 0.9 ? Y_AXIS : new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3().crossVectors(dir, helper).normalize();
}

function cylinderBetween(from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(CYLINDER, material);
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.scale.set(radius, length, radius);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
  return mesh;
}

/** Number of parallel lines drawn for a bond order (aromatic = solid + thin secondary). */
export function lineCountForOrder(order: Bond["order"]): number {
  return order === "aromatic" ? 2 : bondOrderValue(order);
}

export function buildMoleculeScene(mol: Molecule, style: SceneStyle = BALL_AND_STICK): MoleculeSceneObjects {
  const group = new THREE.Group();
  group.name = `molecule:${mol.id}`;
  const atomMeshes = new Map<AtomId, THREE.Mesh>();
  const bondSegments = new Map<BondId, THREE.Mesh[]>();
  const labels: LabelAnchor[] = [];
  const positions = new Map<AtomId, THREE.Vector3>();
  const hidden = new Set<AtomId>(style.hideHydrogens ? mol.atoms.filter((a) => a.element === "H").map((a) => a.id) : []);

  for (const atom of mol.atoms) {
    if (hidden.has(atom.id)) continue;
    const r = atomRadius(atom.element, style);
    const color = elementColor(atom.element);
    const mesh = new THREE.Mesh(SPHERE, materialFor(color, false));
    mesh.position.set(atom.position.x, atom.position.y, atom.position.z);
    mesh.scale.setScalar(r);
    mesh.userData = { kind: "atom", id: atom.id, color } satisfies PickData & { color: number };
    mesh.name = `atom:${atom.id}`;
    group.add(mesh);
    atomMeshes.set(atom.id, mesh);
    positions.set(atom.id, mesh.position.clone());
    labels.push({ atomId: atom.id, text: labelText(atom.element, atom.formalCharge, atom.isotope), position: atom.position, radius: r });
  }

  for (const bond of mol.bonds) {
    if (!style.drawBonds) break;
    const a = positions.get(bond.atomA);
    const b = positions.get(bond.atomB);
    if (!a || !b) continue; // dangling or hidden-hydrogen bond: nothing to draw
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const colorA = elementColor(mol.atoms.find((x) => x.id === bond.atomA)!.element);
    const colorB = elementColor(mol.atoms.find((x) => x.id === bond.atomB)!.element);

    const lines = lineCountForOrder(bond.order);
    const perp = lines > 1 ? multiBondPerpendicular(mol, bond, dir) : new THREE.Vector3();
    const segments: THREE.Mesh[] = [];
    for (let i = 0; i < lines; i++) {
      const offsetAmount = (i - (lines - 1) / 2) * style.multiBondOffset;
      const offset = perp.clone().multiplyScalar(offsetAmount);
      // Aromatic: main line full radius, secondary line thinner and translucent.
      const secondary = bond.order === "aromatic" && i === 1;
      const radius = secondary ? style.bondRadius * 0.55 : lines > 1 ? style.bondRadius * 0.8 : style.bondRadius;
      const opacity = secondary ? 0.6 : 1;
      const from = a.clone().add(offset);
      const to = b.clone().add(offset);
      const centre = mid.clone().add(offset);
      const halfA = cylinderBetween(from, centre, radius, materialFor(colorA, false, opacity));
      const halfB = cylinderBetween(centre, to, radius, materialFor(colorB, false, opacity));
      for (const [half, color] of [
        [halfA, colorA],
        [halfB, colorB],
      ] as const) {
        half.userData = { kind: "bond", id: bond.id, color, opacity } satisfies PickData & { color: number; opacity: number };
        half.name = `bond:${bond.id}`;
        group.add(half);
        segments.push(half);
      }
    }
    bondSegments.set(bond.id, segments);
  }

  return {
    group,
    atomMeshes,
    bondSegments,
    labels,
    dispose() {
      group.clear();
    },
  };
}

export function labelText(element: string, charge: number, isotope?: number): string {
  let text = isotope !== undefined ? `${isotope}${element}` : element;
  if (charge !== 0) text += Math.abs(charge) === 1 ? (charge > 0 ? "+" : "-") : `${Math.abs(charge)}${charge > 0 ? "+" : "-"}`;
  return text;
}

/** Swap materials so selected atoms/bonds glow. Cheap enough to run on every selection change. */
export function applySelection(
  objects: MoleculeSceneObjects,
  selectedAtoms: Iterable<AtomId>,
  selectedBonds: Iterable<BondId>,
  pendingAtoms: Iterable<AtomId> = [],
): void {
  const atomSet = new Set(selectedAtoms);
  const bondSet = new Set(selectedBonds);
  const pendingSet = new Set(pendingAtoms);
  for (const [id, mesh] of objects.atomMeshes) {
    mesh.material = materialFor(mesh.userData.color as number, atomSet.has(id) ? true : pendingSet.has(id) ? "pending" : false);
  }
  for (const [id, segments] of objects.bondSegments) {
    for (const seg of segments) {
      seg.material = materialFor(seg.userData.color as number, bondSet.has(id), seg.userData.opacity as number);
    }
  }
}

export interface BoundingSphere {
  center: THREE.Vector3;
  radius: number;
}

/** Bounding sphere around all atoms (including their drawn radii). Empty molecule -> unit sphere. */
export function moleculeBoundingSphere(mol: Molecule, style: SceneStyle = BALL_AND_STICK): BoundingSphere {
  if (mol.atoms.length === 0) return { center: new THREE.Vector3(), radius: 1 };
  const center = new THREE.Vector3();
  for (const a of mol.atoms) center.add(toVec(a.position));
  center.divideScalar(mol.atoms.length);
  let radius = 0;
  for (const a of mol.atoms) {
    radius = Math.max(radius, toVec(a.position).distanceTo(center) + atomRadius(a.element, style));
  }
  return { center, radius: Math.max(radius, 1) };
}

/** Finds the atom/bond behind a mesh hit (walks userData). */
export function pickFromObject(obj: THREE.Object3D | undefined): PickData | null {
  if (!obj) return null;
  const data = obj.userData as Partial<PickData>;
  if (data.kind === "atom" && typeof data.id === "string") return { kind: "atom", id: data.id };
  if (data.kind === "bond" && typeof data.id === "string") return { kind: "bond", id: data.id };
  return null;
}
