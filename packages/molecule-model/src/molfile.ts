/**
 * MDL MOL V2000 reader/writer (the interchange format used to talk to RDKit and to export SDF).
 *
 * Coverage: atoms with 3D coordinates, element symbols, bonds with order 1/2/3/aromatic (type 4),
 * formal charges (M  CHG), isotopes (M  ISO). Bond stereo flags (wedge/hash) are written for
 * single bonds with `wedge_up` / `wedge_down`. Everything else in the spec (atom lists, S-groups,
 * query features, V3000) is out of scope and V3000 input is rejected with a clear error.
 */
import type { Atom, Bond, BondOrder, Molecule } from "./types";
import { createMolecule } from "./molecule";

export class MolfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MolfileError";
  }
}

const ORDER_TO_TYPE: Record<BondOrder, number> = { single: 1, double: 2, triple: 3, aromatic: 4 };
const TYPE_TO_ORDER: Record<number, BondOrder> = { 1: "single", 2: "double", 3: "triple", 4: "aromatic" };

function fixed(n: number, width: number, decimals: number): string {
  return n.toFixed(decimals).padStart(width, " ");
}
function int(n: number, width: number): string {
  return String(n).padStart(width, " ");
}

/** Serialise a molecule as a MOL V2000 block (ends with "M  END\n"). */
export function writeMolfile(mol: Molecule, opts: { programLine?: string } = {}): string {
  if (mol.atoms.length > 999 || mol.bonds.length > 999) {
    throw new MolfileError("V2000 molfiles support at most 999 atoms and 999 bonds.");
  }
  const index = new Map<string, number>();
  mol.atoms.forEach((a, i) => index.set(a.id, i + 1));

  const lines: string[] = [];
  lines.push((mol.name ?? mol.id).replace(/[\r\n]/g, " ").slice(0, 80));
  lines.push(opts.programLine ?? "  MolCAD            3D"); // cols 21-22 = dimension code
  lines.push("");
  lines.push(`${int(mol.atoms.length, 3)}${int(mol.bonds.length, 3)}  0  0  0  0  0  0  0  0999 V2000`);

  for (const a of mol.atoms) {
    // xxxxx.xxxxyyyyy.yyyyzzzzz.zzzz aaaddcccssshhhbbbvvvHHHrrriiimmmnnneee
    lines.push(`${fixed(a.position.x, 10, 4)}${fixed(a.position.y, 10, 4)}${fixed(a.position.z, 10, 4)} ${a.element.padEnd(3, " ")} 0  0  0  0  0  0  0  0  0  0  0  0`);
  }
  for (const b of mol.bonds) {
    const ia = index.get(b.atomA);
    const ib = index.get(b.atomB);
    if (ia === undefined || ib === undefined) throw new MolfileError(`Bond ${b.id} references an unknown atom.`);
    const stereo = b.order === "single" && b.stereo === "wedge_up" ? 1 : b.order === "single" && b.stereo === "wedge_down" ? 6 : b.stereo === "either" ? (b.order === "double" ? 3 : 4) : 0;
    lines.push(`${int(ia, 3)}${int(ib, 3)}${int(ORDER_TO_TYPE[b.order], 3)}${int(stereo, 3)}`);
  }

  const charged = mol.atoms.filter((a) => a.formalCharge !== 0);
  for (let i = 0; i < charged.length; i += 8) {
    const chunk = charged.slice(i, i + 8);
    lines.push(`M  CHG${int(chunk.length, 3)}` + chunk.map((a) => `${int(index.get(a.id)!, 4)}${int(a.formalCharge, 4)}`).join(""));
  }
  const isotopes = mol.atoms.filter((a) => a.isotope !== undefined);
  for (let i = 0; i < isotopes.length; i += 8) {
    const chunk = isotopes.slice(i, i + 8);
    lines.push(`M  ISO${int(chunk.length, 3)}` + chunk.map((a) => `${int(index.get(a.id)!, 4)}${int(a.isotope!, 4)}`).join(""));
  }
  lines.push("M  END");
  return lines.join("\n") + "\n";
}

export interface ParseMolfileOptions {
  /** Molecule id to assign (default: derived from the header name or "imported"). */
  id?: string;
  /** Prefix for generated atom/bond ids (default "a" / "b"). */
  atomIdPrefix?: string;
  bondIdPrefix?: string;
}

/** Parse a MOL V2000 block (the first molecule if given an SDF record). */
export function parseMolfile(text: string, opts: ParseMolfileOptions = {}): Molecule {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length < 4) throw new MolfileError("Molfile is too short.");
  const name = (lines[0] ?? "").trim();
  const counts = lines[3] ?? "";
  if (/V3000/.test(counts)) throw new MolfileError("V3000 molfiles are not supported yet.");
  const nAtoms = parseInt(counts.slice(0, 3), 10);
  const nBonds = parseInt(counts.slice(3, 6), 10);
  if (!Number.isFinite(nAtoms) || !Number.isFinite(nBonds) || nAtoms < 0 || nBonds < 0) {
    throw new MolfileError("Malformed counts line (line 4).");
  }
  if (lines.length < 4 + nAtoms + nBonds) throw new MolfileError("Molfile ends before all atoms/bonds are listed.");

  const ap = opts.atomIdPrefix ?? "a";
  const bp = opts.bondIdPrefix ?? "b";
  const atoms: Atom[] = [];
  for (let i = 0; i < nAtoms; i++) {
    const line = lines[4 + i] ?? "";
    const x = parseFloat(line.slice(0, 10));
    const y = parseFloat(line.slice(10, 20));
    const z = parseFloat(line.slice(20, 30));
    const element = line.slice(31, 34).trim();
    if (![x, y, z].every(Number.isFinite) || element === "") {
      throw new MolfileError(`Malformed atom line ${5 + i}.`);
    }
    const atom: Atom = { id: `${ap}${i + 1}`, element, formalCharge: 0, position: { x, y, z } };
    // Legacy charge column (ccc): 1=+3, 2=+2, 3=+1, 5=-1, 6=-2, 7=-3. Overridden by M CHG if present.
    const ccc = parseInt(line.slice(36, 39), 10);
    if (ccc >= 1 && ccc <= 7 && ccc !== 4) atom.formalCharge = ccc <= 3 ? 4 - ccc : 4 - ccc;
    atoms.push(atom);
  }

  const bonds: Bond[] = [];
  for (let i = 0; i < nBonds; i++) {
    const line = lines[4 + nAtoms + i] ?? "";
    const ia = parseInt(line.slice(0, 3), 10);
    const ib = parseInt(line.slice(3, 6), 10);
    const type = parseInt(line.slice(6, 9), 10);
    const stereo = parseInt(line.slice(9, 12), 10) || 0;
    const order = TYPE_TO_ORDER[type];
    if (!order || ia < 1 || ib < 1 || ia > nAtoms || ib > nAtoms) {
      throw new MolfileError(`Unsupported or malformed bond line ${5 + nAtoms + i}.`);
    }
    const bond: Bond = { id: `${bp}${i + 1}`, atomA: `${ap}${ia}`, atomB: `${ap}${ib}`, order };
    if (stereo === 1) bond.stereo = "wedge_up";
    else if (stereo === 6) bond.stereo = "wedge_down";
    else if (stereo === 3 || stereo === 4) bond.stereo = "either";
    bonds.push(bond);
  }

  let sawChg = false;
  for (let i = 4 + nAtoms + nBonds; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.startsWith("M  END") || line.startsWith("$$$$")) break;
    if (line.startsWith("M  CHG") || line.startsWith("M  ISO")) {
      const isChg = line.startsWith("M  CHG");
      if (isChg && !sawChg) {
        sawChg = true;
        for (const a of atoms) a.formalCharge = 0; // M CHG supersedes the legacy column entirely
      }
      const n = parseInt(line.slice(6, 9), 10);
      for (let k = 0; k < n; k++) {
        const idx = parseInt(line.slice(9 + k * 8, 13 + k * 8), 10);
        const val = parseInt(line.slice(13 + k * 8, 17 + k * 8), 10);
        const atom = atoms[idx - 1];
        if (!atom || !Number.isFinite(val)) throw new MolfileError(`Malformed property line ${i + 1}.`);
        if (isChg) atom.formalCharge = val;
        else atom.isotope = val;
      }
    }
  }

  const init: Parameters<typeof createMolecule>[0] = {
    id: opts.id ?? (name || "imported"),
    atoms,
    bonds,
    metadata: { source: "molfile" },
  };
  if (name) init.name = name;
  return createMolecule(init);
}
