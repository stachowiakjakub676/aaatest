import { useEffect } from "react";
import { MODES } from "../editor/modes";

const GENERAL: Array<[string, string]> = [
  ["Ctrl/⌘ + Z", "Undo"],
  ["Ctrl/⌘ + Shift + Z, Ctrl + Y", "Redo"],
  ["Delete / Backspace", "Delete selection"],
  ["Esc", "Clear selection, cancel bond pick, close dialogs"],
  ["Shift + click", "Add to selection"],
  ["T", "Tidy geometry now"],
  ["F", "Fit molecule to view"],
  ["R", "Reset camera"],
  ["L", "Toggle atom labels"],
  ["Ctrl/⌘ + O", "Import"],
  ["Ctrl/⌘ + S", "Export"],
  ["?", "This overlay"],
];

export function ShortcutsOverlay({ onClose }: { onClose(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "?") && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal modal-narrow" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <button type="button" className="btn btn-small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-body">
          <table className="shortcuts">
            <tbody>
              {MODES.map((m) => (
                <tr key={m.id}>
                  <td>
                    <kbd>{m.key}</kbd>
                  </td>
                  <td>{m.label} tool</td>
                </tr>
              ))}
              {GENERAL.map(([k, d]) => (
                <tr key={k}>
                  <td>
                    <kbd>{k}</kbd>
                  </td>
                  <td>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">On iPad every action is also available from the panels; two-finger drag pans, pinch zooms, one finger rotates.</p>
        </div>
      </div>
    </div>
  );
}
