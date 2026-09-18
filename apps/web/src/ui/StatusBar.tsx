import type { ValidationResult } from "@molecular-cad/molecule-model";
import type { Selection } from "../state/selection";
import { MODES } from "../editor/modes";
import type { EditorMode } from "../editor/modes";

export interface StatusBarProps {
  validation: ValidationResult;
  selection: Selection;
  mode: EditorMode;
  element: string;
  pendingAtomId: string | null;
  lastAction: string;
  notice: string | null;
}

export function StatusBar({ validation, selection, mode, element, pendingAtomId, lastAction, notice }: StatusBarProps) {
  const errors = validation.issues.filter((i) => i.severity === "error");
  const warnings = validation.issues.filter((i) => i.severity === "warning");
  const first = errors[0] ?? warnings[0];
  const info = MODES.find((m) => m.id === mode)!;
  const selText =
    selection.atoms.length === 0 && selection.bonds.length === 0
      ? "No selection"
      : [selection.atoms.length ? `${selection.atoms.length} atom${selection.atoms.length > 1 ? "s" : ""}` : "", selection.bonds.length ? `${selection.bonds.length} bond${selection.bonds.length > 1 ? "s" : ""}` : ""]
          .filter(Boolean)
          .join(", ");
  const hint = mode === "bond" && pendingAtomId ? `First atom: ${pendingAtomId}. Tap the second atom.` : mode === "add" ? `Adding ${element}. ${info.hint}` : info.hint;

  return (
    <footer className="statusbar" role="status" aria-live="polite">
      <span className="status-chip mode">{info.label}</span>
      <span className="status-message">{notice ?? hint}</span>
      <span className="status-spacer" />
      <span className={`status-chip ${errors.length ? "err" : warnings.length ? "warn" : "ok"}`} title={first?.message}>
        {errors.length ? `${errors.length} error${errors.length > 1 ? "s" : ""}` : warnings.length ? `${warnings.length} warning${warnings.length > 1 ? "s" : ""}` : "Valid"}
      </span>
      <span className="status-item">{selText}</span>
      <span className="status-item muted">{lastAction}</span>
    </footer>
  );
}
