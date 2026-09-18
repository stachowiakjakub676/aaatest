/**
 * Workspace: several molecules open at once, each with its own undo history, plus a persisted
 * snapshot (molecules only) so the desktop app and the PWA reopen where you left off.
 */
import { createMolecule, moleculeFromObject, validateMolecule } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import { createHistory } from "../editor/history";
import type { History } from "../editor/history";

export interface Doc {
  id: string;
  history: History;
}

export const WORKSPACE_KIND = "clapeyron-workspace";
export const WORKSPACE_STORAGE_KEY = "clapeyron.workspace";

let docCounter = 0;
export function newDocId(): string {
  docCounter += 1;
  return `doc-${Date.now().toString(36)}-${docCounter}`;
}

let newCounter = 0;
export function blankMolecule(): Molecule {
  newCounter += 1;
  return createMolecule({ id: `untitled-${newCounter}`, name: "Untitled", metadata: { source: "editor" } });
}

export function blankDoc(): Doc {
  return { id: newDocId(), history: createHistory(blankMolecule()) };
}

/** A document nobody has touched: no atoms and no history. Such a tab is reused instead of opening another. */
export function isPristine(doc: Doc): boolean {
  return doc.history.present.atoms.length === 0 && doc.history.past.length === 0;
}

export interface WorkspaceFile {
  kind: typeof WORKSPACE_KIND;
  version: 1;
  savedAt: string;
  activeIndex: number;
  molecules: Molecule[];
}

export function serializeWorkspace(docs: Doc[], activeId: string, pretty = false): string {
  const file: WorkspaceFile = { kind: WORKSPACE_KIND, version: 1, savedAt: new Date().toISOString(), activeIndex: Math.max(0, docs.findIndex((d) => d.id === activeId)), molecules: docs.map((d) => d.history.present) };
  return JSON.stringify(file, null, pretty ? 2 : 0);
}

/** Parse a workspace file; returns null when the text is not one. Throws on a malformed one. */
export function parseWorkspace(text: string): { molecules: Molecule[]; activeIndex: number } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || (raw as { kind?: unknown }).kind !== WORKSPACE_KIND) return null;
  const file = raw as Partial<WorkspaceFile>;
  if (!Array.isArray(file.molecules)) throw new Error("Workspace file has no molecules array.");
  const molecules = file.molecules.map((m, i) => {
    const mol = moleculeFromObject(m);
    const v = validateMolecule(mol);
    if (!v.valid) throw new Error(`Molecule ${i + 1} (${mol.name ?? mol.id}) fails validation: ${v.issues[0]?.message ?? "invalid"}`);
    return mol;
  });
  return { molecules, activeIndex: typeof file.activeIndex === "number" ? file.activeIndex : 0 };
}

export function docsFromMolecules(molecules: Molecule[]): Doc[] {
  return molecules.map((m) => ({ id: newDocId(), history: createHistory(m, `Opened ${m.name ?? m.id}`) }));
}

/** Persisted snapshot (browser storage). Failures are silent: persistence is a convenience. */
export function saveWorkspaceSnapshot(docs: Doc[], activeId: string): void {
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(docs, activeId));
  } catch {
    /* private mode, quota */
  }
}

export function restoreWorkspaceSnapshot(): { docs: Doc[]; activeId: string } | null {
  try {
    const text = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!text) return null;
    const parsed = parseWorkspace(text);
    if (!parsed || parsed.molecules.length === 0) return null;
    const docs = parsed.molecules.map((m) => ({ id: newDocId(), history: createHistory(m, "Restored") }));
    const active = docs[Math.min(Math.max(0, parsed.activeIndex), docs.length - 1)]!;
    return { docs, activeId: active.id };
  } catch {
    return null;
  }
}
