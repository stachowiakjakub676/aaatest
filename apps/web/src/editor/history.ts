/**
 * Undo/redo as an immutable stack of molecule snapshots. Snapshots are cheap because every
 * domain operation already returns a structurally-shared new object.
 */
import type { Molecule } from "@molecular-cad/molecule-model";

export interface HistoryEntry {
  molecule: Molecule;
  /** Human-readable description of the change that produced the *next* state. */
  label: string;
}

export interface History {
  past: HistoryEntry[];
  present: Molecule;
  future: HistoryEntry[];
  /** Label of the last committed change (for the status bar). */
  lastLabel: string;
}

export const MAX_HISTORY = 200;

export function createHistory(initial: Molecule, label = "New molecule"): History {
  return { past: [], present: initial, future: [], lastLabel: label };
}

/** Record `next` as a new undoable state. No-op when nothing changed. */
export function commit(h: History, next: Molecule, label: string): History {
  if (next === h.present) return h;
  const past = [...h.past, { molecule: h.present, label }];
  if (past.length > MAX_HISTORY) past.shift();
  return { past, present: next, future: [], lastLabel: label };
}

/**
 * Replace the present state without creating an undo step (used while dragging an atom).
 * Call `commitFrom` with the pre-drag molecule when the gesture ends.
 */
export function replacePresent(h: History, next: Molecule): History {
  return { ...h, present: next };
}

/** Commit the current present as one undoable step relative to `before`. */
export function commitFrom(h: History, before: Molecule, label: string): History {
  if (before === h.present) return h;
  const past = [...h.past, { molecule: before, label }];
  if (past.length > MAX_HISTORY) past.shift();
  return { past, present: h.present, future: [], lastLabel: label };
}

export function canUndo(h: History): boolean {
  return h.past.length > 0;
}

export function canRedo(h: History): boolean {
  return h.future.length > 0;
}

export function undo(h: History): History {
  const entry = h.past[h.past.length - 1];
  if (!entry) return h;
  return {
    past: h.past.slice(0, -1),
    present: entry.molecule,
    future: [{ molecule: h.present, label: entry.label }, ...h.future],
    lastLabel: `Undo: ${entry.label}`,
  };
}

export function redo(h: History): History {
  const entry = h.future[0];
  if (!entry) return h;
  return {
    past: [...h.past, { molecule: h.present, label: entry.label }],
    present: entry.molecule,
    future: h.future.slice(1),
    lastLabel: `Redo: ${entry.label}`,
  };
}

export function undoLabel(h: History): string | undefined {
  return h.past[h.past.length - 1]?.label;
}

export function redoLabel(h: History): string | undefined {
  return h.future[0]?.label;
}

/** Start over with a different molecule (loading a sample, new file). History is cleared. */
export function reset(h: History, molecule: Molecule, label: string): History {
  void h;
  return createHistory(molecule, label);
}
