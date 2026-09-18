/**
 * Suggestions -> editor commands. Every operation is validated against the *current* molecule
 * before anything is applied; an LLM can only ever propose operations from the closed set in
 * types.ts, referencing ids that exist.
 */
import { BOND_ORDERS, cleanupGeometry, getAtom, getBond, isKnownElement } from "@molecular-cad/molecule-model";
import type { BondOrder, Molecule } from "@molecular-cad/molecule-model";
import * as cmd from "../editor/commands";
import type { CommandResult } from "../editor/commands";
import type { EditOperation, Suggestion } from "./types";
import { EDIT_OPS } from "./types";

export function validateOperation(mol: Molecule, op: unknown): { ok: true; op: EditOperation } | { ok: false; reason: string } {
  if (!op || typeof op !== "object") return { ok: false, reason: "operation is not an object" };
  const o = op as Record<string, unknown>;
  if (typeof o.op !== "string" || !EDIT_OPS.has(o.op as EditOperation["op"])) return { ok: false, reason: `unknown operation "${String(o.op)}"` };
  const atom = (key: string) => (typeof o[key] === "string" && getAtom(mol, o[key] as string) ? (o[key] as string) : null);
  const bond = (key: string) => (typeof o[key] === "string" && getBond(mol, o[key] as string) ? (o[key] as string) : null);
  const element = (key: string) => (typeof o[key] === "string" && isKnownElement(o[key] as string) ? (o[key] as string) : null);
  const order = (key: string) => (typeof o[key] === "string" && (BOND_ORDERS as readonly string[]).includes(o[key] as string) ? (o[key] as BondOrder) : null);
  switch (o.op) {
    case "setElement": {
      const a = atom("atomId");
      const e = element("element");
      return a && e ? { ok: true, op: { op: "setElement", atomId: a, element: e } } : { ok: false, reason: "setElement needs an existing atomId and a known element" };
    }
    case "setCharge": {
      const a = atom("atomId");
      return a && Number.isInteger(o.charge) && Math.abs(o.charge as number) <= 4 ? { ok: true, op: { op: "setCharge", atomId: a, charge: o.charge as number } } : { ok: false, reason: "setCharge needs an existing atomId and an integer charge within ±4" };
    }
    case "removeAtom": {
      const a = atom("atomId");
      return a ? { ok: true, op: { op: "removeAtom", atomId: a } } : { ok: false, reason: "removeAtom needs an existing atomId" };
    }
    case "removeBond": {
      const b = bond("bondId");
      return b ? { ok: true, op: { op: "removeBond", bondId: b } } : { ok: false, reason: "removeBond needs an existing bondId" };
    }
    case "setBondOrder": {
      const b = bond("bondId");
      const ord = order("order");
      return b && ord ? { ok: true, op: { op: "setBondOrder", bondId: b, order: ord } } : { ok: false, reason: "setBondOrder needs an existing bondId and a valid order" };
    }
    case "addBondedAtom": {
      const a = atom("anchorId");
      const e = element("element");
      if (!a || !e) return { ok: false, reason: "addBondedAtom needs an existing anchorId and a known element" };
      const ord = o.order === undefined ? undefined : order("order");
      if (o.order !== undefined && !ord) return { ok: false, reason: "addBondedAtom has an invalid order" };
      return { ok: true, op: ord ? { op: "addBondedAtom", anchorId: a, element: e, order: ord } : { op: "addBondedAtom", anchorId: a, element: e } };
    }
    case "addHydrogens": {
      if (o.atomId === undefined) return { ok: true, op: { op: "addHydrogens" } };
      const a = atom("atomId");
      return a ? { ok: true, op: { op: "addHydrogens", atomId: a } } : { ok: false, reason: "addHydrogens atomId does not exist" };
    }
    case "tidy":
      return { ok: true, op: { op: "tidy" } };
    default:
      return { ok: false, reason: "unsupported operation" };
  }
}

/** Validate a (possibly untrusted) suggestion; returns null when nothing usable remains. */
export function validateSuggestion(mol: Molecule, raw: unknown, source: Suggestion["source"], index: number): Suggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.title !== "string" || r.title.trim() === "" || !Array.isArray(r.operations) || r.operations.length === 0) return null;
  const operations: EditOperation[] = [];
  for (const op of r.operations) {
    const v = validateOperation(mol, op);
    if (!v.ok) return null; // one invalid step invalidates the whole suggestion: never apply half of it
    operations.push(v.op);
  }
  if (operations.length > 20) return null;
  return {
    id: typeof r.id === "string" && r.id ? r.id : `${source}-${index}`,
    title: r.title.trim().slice(0, 120),
    rationale: typeof r.rationale === "string" ? r.rationale.trim().slice(0, 600) : "",
    source,
    operations,
  };
}

/** Apply a suggestion as one editor command (one undo step). Re-validates every step. */
export function applySuggestion(mol: Molecule, suggestion: Suggestion): CommandResult {
  let m = mol;
  let selection: CommandResult["selection"];
  for (const raw of suggestion.operations) {
    const v = validateOperation(m, raw);
    if (!v.ok) throw new cmd.CommandError(`Suggestion no longer applies: ${v.reason}.`);
    const op = v.op;
    let r: CommandResult;
    switch (op.op) {
      case "setElement":
        r = cmd.setElement(m, op.atomId, op.element);
        break;
      case "setCharge":
        r = cmd.setFormalCharge(m, op.atomId, op.charge);
        break;
      case "removeAtom":
        r = cmd.deleteAtom(m, op.atomId);
        break;
      case "removeBond":
        r = cmd.deleteBond(m, op.bondId);
        break;
      case "setBondOrder":
        r = cmd.changeBondOrder(m, op.bondId, op.order);
        break;
      case "addBondedAtom":
        r = cmd.addBondedAtom(m, op.anchorId, op.element, op.order ?? "single");
        break;
      case "addHydrogens":
        r = cmd.addHydrogens(m, op.atomId);
        break;
      case "tidy":
        r = { molecule: cleanupGeometry(m, { maxIterations: 800 }).molecule, label: "Tidy geometry" };
        break;
    }
    m = r.molecule;
    if (r.selection) selection = r.selection;
  }
  const result: CommandResult = { molecule: m, label: `Apply suggestion: ${suggestion.title}`, tidy: true };
  if (selection) result.selection = selection;
  return result;
}
