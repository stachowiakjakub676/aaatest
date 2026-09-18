import type { AtomId, BondId } from "@molecular-cad/molecule-model";

/** Ordered selection: order matters for measurements (distance A-B, angle A-B-C). */
export interface Selection {
  atoms: AtomId[];
  bonds: BondId[];
}

export const EMPTY_SELECTION: Selection = { atoms: [], bonds: [] };

export type Pick = { kind: "atom"; id: AtomId } | { kind: "bond"; id: BondId };

/**
 * Click semantics (CAD convention): plain click replaces the selection,
 * additive click (shift / long-press flag) toggles the item.
 */
export function applyPick(sel: Selection, pick: Pick | null, additive: boolean): Selection {
  if (!pick) return additive ? sel : EMPTY_SELECTION;
  const list = pick.kind === "atom" ? sel.atoms : sel.bonds;
  const has = list.includes(pick.id);
  if (!additive) {
    if (has && list.length === 1 && (pick.kind === "atom" ? sel.bonds.length : sel.atoms.length) === 0) {
      return EMPTY_SELECTION; // clicking the only selected item deselects it
    }
    return pick.kind === "atom" ? { atoms: [pick.id], bonds: [] } : { atoms: [], bonds: [pick.id] };
  }
  const next = has ? list.filter((x) => x !== pick.id) : [...list, pick.id];
  return pick.kind === "atom" ? { ...sel, atoms: next } : { ...sel, bonds: next };
}

/** Drop ids that no longer exist in the molecule (after edits or loading another molecule). */
export function pruneSelection(sel: Selection, atomIds: Set<AtomId>, bondIds: Set<BondId>): Selection {
  const atoms = sel.atoms.filter((id) => atomIds.has(id));
  const bonds = sel.bonds.filter((id) => bondIds.has(id));
  if (atoms.length === sel.atoms.length && bonds.length === sel.bonds.length) return sel;
  return { atoms, bonds };
}

export function isEmptySelection(sel: Selection): boolean {
  return sel.atoms.length === 0 && sel.bonds.length === 0;
}
