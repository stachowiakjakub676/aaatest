import { allowedValences, isKnownElement } from "./elements";
import { BOND_ORDERS, explicitValence } from "./molecule";
import type { AtomId, BondId, BondOrder, Molecule } from "./types";

/**
 * Deterministic structural validation of the molecular graph.
 *
 * Scope (intentionally limited): graph integrity, data sanity and a documented, small
 * valence rule set for common main-group elements. Full chemical perception
 * (aromaticity, kekulisation, hypervalent species, stereo consistency) is the job of the
 * chemistry core (RDKit) and is reported separately as engine issues.
 */

export type IssueSeverity = "error" | "warning";

export type IssueCode =
  | "DUPLICATE_ATOM_ID"
  | "DUPLICATE_BOND_ID"
  | "UNKNOWN_ELEMENT"
  | "INVALID_CHARGE"
  | "INVALID_ISOTOPE"
  | "INVALID_COORDINATES"
  | "INVALID_IMPLICIT_H"
  | "BOND_UNKNOWN_ATOM"
  | "BOND_SELF"
  | "BOND_DUPLICATE"
  | "INVALID_BOND_ORDER"
  | "VALENCE_EXCEEDED"
  | "ATOMS_OVERLAP"
  | "EMPTY_MOLECULE";

export interface ValidationIssue {
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  atomIds?: AtomId[];
  bondIds?: BondId[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/** Two atoms closer than this (Å) are almost certainly a mistake. */
export const OVERLAP_DISTANCE = 0.4;
export const MAX_ABS_CHARGE = 8;

function isFiniteVec(v: { x: unknown; y: unknown; z: unknown }): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

export function validateMolecule(mol: Molecule): ValidationResult {
  const issues: ValidationIssue[] = [];
  const push = (i: ValidationIssue) => issues.push(i);

  if (mol.atoms.length === 0) {
    push({ code: "EMPTY_MOLECULE", severity: "warning", message: "Molecule has no atoms." });
  }

  // --- atoms ---------------------------------------------------------------
  const atomIds = new Set<AtomId>();
  for (const atom of mol.atoms) {
    if (atomIds.has(atom.id)) {
      push({ code: "DUPLICATE_ATOM_ID", severity: "error", message: `Duplicate atom id "${atom.id}".`, atomIds: [atom.id] });
    }
    atomIds.add(atom.id);

    if (!isKnownElement(atom.element)) {
      push({ code: "UNKNOWN_ELEMENT", severity: "error", message: `Unknown element symbol "${atom.element}" on atom ${atom.id}.`, atomIds: [atom.id] });
    }
    if (!Number.isInteger(atom.formalCharge) || Math.abs(atom.formalCharge) > MAX_ABS_CHARGE) {
      push({ code: "INVALID_CHARGE", severity: "error", message: `Formal charge ${atom.formalCharge} on atom ${atom.id} is not a small integer.`, atomIds: [atom.id] });
    }
    if (atom.isotope !== undefined && (!Number.isInteger(atom.isotope) || atom.isotope <= 0)) {
      push({ code: "INVALID_ISOTOPE", severity: "error", message: `Isotope ${atom.isotope} on atom ${atom.id} must be a positive mass number.`, atomIds: [atom.id] });
    }
    if (!isFiniteVec(atom.position)) {
      push({ code: "INVALID_COORDINATES", severity: "error", message: `Atom ${atom.id} has non-finite coordinates.`, atomIds: [atom.id] });
    }
    if (atom.implicitHydrogens !== undefined && (!Number.isInteger(atom.implicitHydrogens) || atom.implicitHydrogens < 0)) {
      push({ code: "INVALID_IMPLICIT_H", severity: "error", message: `Implicit hydrogen count on atom ${atom.id} must be a non-negative integer.`, atomIds: [atom.id] });
    }
  }

  // --- bonds ---------------------------------------------------------------
  const bondIds = new Set<BondId>();
  const pairs = new Set<string>();
  for (const bond of mol.bonds) {
    if (bondIds.has(bond.id)) {
      push({ code: "DUPLICATE_BOND_ID", severity: "error", message: `Duplicate bond id "${bond.id}".`, bondIds: [bond.id] });
    }
    bondIds.add(bond.id);

    const missing = [bond.atomA, bond.atomB].filter((id) => !atomIds.has(id));
    if (missing.length > 0) {
      push({ code: "BOND_UNKNOWN_ATOM", severity: "error", message: `Bond ${bond.id} references unknown atom(s): ${missing.join(", ")}.`, bondIds: [bond.id] });
    }
    if (bond.atomA === bond.atomB) {
      push({ code: "BOND_SELF", severity: "error", message: `Bond ${bond.id} connects atom ${bond.atomA} to itself.`, bondIds: [bond.id], atomIds: [bond.atomA] });
    }
    const key = JSON.stringify([bond.atomA, bond.atomB].sort());
    if (pairs.has(key)) {
      push({ code: "BOND_DUPLICATE", severity: "error", message: `More than one bond between ${bond.atomA} and ${bond.atomB} (bond ${bond.id}).`, bondIds: [bond.id], atomIds: [bond.atomA, bond.atomB] });
    }
    pairs.add(key);
    if (!BOND_ORDERS.includes(bond.order as BondOrder)) {
      push({ code: "INVALID_BOND_ORDER", severity: "error", message: `Bond ${bond.id} has invalid order "${String(bond.order)}".`, bondIds: [bond.id] });
    }
  }

  // --- valence (only when the graph itself is consistent) --------------------
  const graphOk = !issues.some((i) => i.severity === "error");
  if (graphOk) {
    for (const atom of mol.atoms) {
      const allowed = allowedValences(atom.element, atom.formalCharge);
      if (!allowed || allowed.length === 0) continue; // not checked client-side
      const explicit = explicitValence(mol, atom.id) + (atom.implicitHydrogens ?? 0);
      const max = Math.max(...allowed);
      if (explicit > max + 1e-9) {
        push({
          code: "VALENCE_EXCEEDED",
          severity: "error",
          message: `Atom ${atom.id} (${atom.element}${chargeLabel(atom.formalCharge)}) has valence ${fmt(explicit)}, allowed at most ${max}.`,
          atomIds: [atom.id],
          bondIds: mol.bonds.filter((b) => b.atomA === atom.id || b.atomB === atom.id).map((b) => b.id),
        });
      }
    }

    // --- overlapping atoms (O(n^2); fine for editor-scale molecules) ---------
    for (let i = 0; i < mol.atoms.length; i++) {
      const a = mol.atoms[i]!;
      for (let j = i + 1; j < mol.atoms.length; j++) {
        const b = mol.atoms[j]!;
        const d = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
        if (d < OVERLAP_DISTANCE) {
          push({ code: "ATOMS_OVERLAP", severity: "warning", message: `Atoms ${a.id} and ${b.id} are only ${d.toFixed(2)} Å apart.`, atomIds: [a.id, b.id] });
        }
      }
    }
  }

  return { valid: !issues.some((i) => i.severity === "error"), issues };
}

export function chargeLabel(charge: number): string {
  if (charge === 0) return "";
  const sign = charge > 0 ? "+" : "-";
  return Math.abs(charge) === 1 ? sign : `${Math.abs(charge)}${sign}`;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
