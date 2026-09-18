import type { ValidationResult } from "@molecular-cad/molecule-model";
import type { Selection } from "../state/selection";

export interface StatusBarProps {
  validation: ValidationResult;
  selection: Selection;
  lastAction: string;
}

export function StatusBar({ validation, selection, lastAction }: StatusBarProps) {
  const errors = validation.issues.filter((i) => i.severity === "error");
  const warnings = validation.issues.filter((i) => i.severity === "warning");
  const first = errors[0] ?? warnings[0];
  const selText =
    selection.atoms.length === 0 && selection.bonds.length === 0
      ? "No selection"
      : [selection.atoms.length ? `${selection.atoms.length} atom${selection.atoms.length > 1 ? "s" : ""}` : "", selection.bonds.length ? `${selection.bonds.length} bond${selection.bonds.length > 1 ? "s" : ""}` : ""]
          .filter(Boolean)
          .join(", ");

  return (
    <footer className="statusbar" role="status" aria-live="polite">
      <span className={`status-chip ${errors.length ? "err" : warnings.length ? "warn" : "ok"}`}>
        {errors.length ? `Invalid · ${errors.length} error${errors.length > 1 ? "s" : ""}` : warnings.length ? `Valid · ${warnings.length} warning${warnings.length > 1 ? "s" : ""}` : "Structure valid"}
      </span>
      {first && <span className="status-message">{first.message}</span>}
      <span className="status-spacer" />
      <span className="status-item">{selText}</span>
      <span className="status-item muted">{lastAction}</span>
    </footer>
  );
}
