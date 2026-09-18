import type { Atom, Bond, BondStereo, Conformer, MetadataValue, Molecule, Vec3 } from "./types";
import { BOND_ORDERS } from "./molecule";

/**
 * JSON serialisation of the native molecule format ("MCAD-JSON").
 * parseMolecule() performs *shape* validation (types, required fields) and throws on
 * malformed input. Chemical validity is a separate step (validateMolecule).
 */

export class MoleculeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoleculeParseError";
  }
}

export function serializeMolecule(mol: Molecule, pretty = false): string {
  return JSON.stringify(mol, null, pretty ? 2 : undefined);
}

export function parseMolecule(json: string): Molecule {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new MoleculeParseError(`Invalid JSON: ${(e as Error).message}`);
  }
  return moleculeFromObject(raw);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(path: string, expected: string): never {
  throw new MoleculeParseError(`${path}: expected ${expected}`);
}

function readVec3(v: unknown, path: string): Vec3 {
  if (!isRecord(v)) fail(path, "object {x,y,z}");
  const { x, y, z } = v;
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") fail(path, "numeric x, y, z");
  return { x, y, z };
}

function readAtom(v: unknown, path: string): Atom {
  if (!isRecord(v)) fail(path, "atom object");
  if (typeof v.id !== "string" || v.id.length === 0) fail(`${path}.id`, "non-empty string");
  if (typeof v.element !== "string") fail(`${path}.element`, "string");
  const formalCharge = v.formalCharge ?? 0;
  if (typeof formalCharge !== "number") fail(`${path}.formalCharge`, "number");
  const atom: Atom = {
    id: v.id,
    element: v.element,
    formalCharge,
    position: readVec3(v.position, `${path}.position`),
  };
  if (v.isotope !== undefined) {
    if (typeof v.isotope !== "number") fail(`${path}.isotope`, "number");
    atom.isotope = v.isotope;
  }
  if (v.chirality !== undefined) {
    if (v.chirality !== "clockwise" && v.chirality !== "counterclockwise" && v.chirality !== "unspecified") {
      fail(`${path}.chirality`, "clockwise | counterclockwise | unspecified");
    }
    atom.chirality = v.chirality;
  }
  if (v.implicitHydrogens !== undefined) {
    if (typeof v.implicitHydrogens !== "number") fail(`${path}.implicitHydrogens`, "number");
    atom.implicitHydrogens = v.implicitHydrogens;
  }
  return atom;
}

const BOND_STEREO = new Set(["wedge_up", "wedge_down", "either", "E", "Z"]);

function readBond(v: unknown, path: string): Bond {
  if (!isRecord(v)) fail(path, "bond object");
  if (typeof v.id !== "string" || v.id.length === 0) fail(`${path}.id`, "non-empty string");
  if (typeof v.atomA !== "string") fail(`${path}.atomA`, "string");
  if (typeof v.atomB !== "string") fail(`${path}.atomB`, "string");
  if (typeof v.order !== "string" || !(BOND_ORDERS as readonly string[]).includes(v.order)) {
    fail(`${path}.order`, BOND_ORDERS.join(" | "));
  }
  const bond: Bond = { id: v.id, atomA: v.atomA, atomB: v.atomB, order: v.order as Bond["order"] };
  if (v.stereo !== undefined) {
    if (typeof v.stereo !== "string" || !BOND_STEREO.has(v.stereo)) fail(`${path}.stereo`, [...BOND_STEREO].join(" | "));
    bond.stereo = v.stereo as BondStereo;
  }
  return bond;
}

function readConformer(v: unknown, path: string): Conformer {
  if (!isRecord(v)) fail(path, "conformer object");
  if (typeof v.id !== "string") fail(`${path}.id`, "string");
  if (!isRecord(v.positions)) fail(`${path}.positions`, "object");
  const positions: Record<string, Vec3> = {};
  for (const [k, p] of Object.entries(v.positions)) positions[k] = readVec3(p, `${path}.positions.${k}`);
  const c: Conformer = { id: v.id, positions };
  if (v.name !== undefined) {
    if (typeof v.name !== "string") fail(`${path}.name`, "string");
    c.name = v.name;
  }
  if (v.energy !== undefined) {
    if (typeof v.energy !== "number") fail(`${path}.energy`, "number");
    c.energy = v.energy;
  }
  return c;
}

export function moleculeFromObject(raw: unknown): Molecule {
  if (!isRecord(raw)) fail("$", "object");
  if (raw.schemaVersion !== 1) fail("$.schemaVersion", "1");
  if (typeof raw.id !== "string" || raw.id.length === 0) fail("$.id", "non-empty string");
  if (!Array.isArray(raw.atoms)) fail("$.atoms", "array");
  if (!Array.isArray(raw.bonds)) fail("$.bonds", "array");

  const metadata: Record<string, MetadataValue> = {};
  if (raw.metadata !== undefined) {
    if (!isRecord(raw.metadata)) fail("$.metadata", "object");
    for (const [k, val] of Object.entries(raw.metadata)) {
      if (typeof val !== "string" && typeof val !== "number" && typeof val !== "boolean") {
        fail(`$.metadata.${k}`, "string | number | boolean");
      }
      metadata[k] = val;
    }
  }

  const mol: Molecule = {
    schemaVersion: 1,
    id: raw.id,
    atoms: raw.atoms.map((a, i) => readAtom(a, `$.atoms[${i}]`)),
    bonds: raw.bonds.map((b, i) => readBond(b, `$.bonds[${i}]`)),
    metadata,
  };
  if (raw.name !== undefined) {
    if (typeof raw.name !== "string") fail("$.name", "string");
    mol.name = raw.name;
  }
  if (raw.conformers !== undefined) {
    if (!Array.isArray(raw.conformers)) fail("$.conformers", "array");
    mol.conformers = raw.conformers.map((c, i) => readConformer(c, `$.conformers[${i}]`));
  }
  return mol;
}
