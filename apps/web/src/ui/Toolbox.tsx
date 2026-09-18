import { useState } from "react";
import { ELEMENTS, isKnownElement } from "@molecular-cad/molecule-model";
import type { BondOrder, Molecule } from "@molecular-cad/molecule-model";
import { MODES, QUICK_ELEMENTS } from "../editor/modes";
import type { EditorMode } from "../editor/modes";

export interface ToolboxProps {
  mode: EditorMode;
  onMode(mode: EditorMode): void;
  element: string;
  onElement(symbol: string): void;
  bondOrder: BondOrder;
  onBondOrder(order: BondOrder): void;

  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string | undefined;
  redoLabel?: string | undefined;
  onUndo(): void;
  onRedo(): void;
  onDeleteSelection(): void;
  hasSelection: boolean;
  onAddHydrogens(): void;
  onRemoveHydrogens(): void;

  onNewMolecule(): void;
  samples: readonly Molecule[];
  onLoadSample(id: string): void;

  showLabels: boolean;
  onToggleLabels(): void;
  additiveMode: boolean;
  onToggleAdditive(): void;
  onFit(): void;
  onReset(): void;
  autoTidy: boolean;
  onToggleAutoTidy(): void;
  onTidy(): void;
}

const ORDERS: Array<{ id: BondOrder; label: string }> = [
  { id: "single", label: "1" },
  { id: "double", label: "2" },
  { id: "triple", label: "3" },
  { id: "aromatic", label: "ar" },
];

export function Toolbox(props: ToolboxProps) {
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [sampleId, setSampleId] = useState("");

  const applyCustom = () => {
    const sym = custom.trim();
    if (!sym) return;
    const fixed = sym.length <= 2 ? sym[0]!.toUpperCase() + sym.slice(1).toLowerCase() : sym;
    if (!isKnownElement(fixed)) {
      setCustomError(`"${sym}" is not an element symbol`);
      return;
    }
    setCustomError(null);
    setCustom("");
    props.onElement(fixed);
  };

  return (
    <aside className="panel toolbox" aria-label="Toolbox">
      <section className="panel-section">
        <h2 className="panel-title">Tools</h2>
        <div className="tool-grid" role="radiogroup" aria-label="Editor tool">
          {MODES.map((m) => (
            <button
              key={m.id}
              id={`tool-${m.id}`}
              type="button"
              role="radio"
              aria-checked={props.mode === m.id}
              className={`tool ${props.mode === m.id ? "active" : ""}`}
              onClick={() => props.onMode(m.id)}
              title={`${m.hint} (${m.key})`}
            >
              <span>{m.label}</span>
              <kbd>{m.key}</kbd>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">
          Atom <span className="current-element mono">{props.element}</span>
        </h2>
        <div className="elements" role="radiogroup" aria-label="Element">
          {QUICK_ELEMENTS.map((sym) => (
            <button
              key={sym}
              id={`el-${sym}`}
              type="button"
              role="radio"
              aria-checked={props.element === sym}
              className={`el mono ${props.element === sym ? "active" : ""}`}
              style={{ ["--el" as string]: `#${(ELEMENTS.find((e) => e.symbol === sym)?.color ?? 0).toString(16).padStart(6, "0")}` }}
              onClick={() => props.onElement(sym)}
            >
              {sym}
            </button>
          ))}
        </div>
        <form
          className="custom-element"
          onSubmit={(e) => {
            e.preventDefault();
            applyCustom();
          }}
        >
          <input
            id="custom-element"
            className="input mono"
            placeholder="Any symbol, e.g. Si"
            value={custom}
            maxLength={2}
            autoCapitalize="off"
            autoCorrect="off"
            onChange={(e) => {
              setCustom(e.target.value);
              setCustomError(null);
            }}
            aria-label="Other element symbol"
          />
          <button type="submit" className="btn btn-small">
            Use
          </button>
        </form>
        {customError && <p className="hint error-text">{customError}</p>}
        <p className="hint">All 118 elements are accepted. Hydrogens can also be added automatically below.</p>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">Bond order</h2>
        <div className="seg" role="radiogroup" aria-label="Bond order">
          {ORDERS.map((o) => (
            <button
              key={o.id}
              id={`order-${o.id}`}
              type="button"
              role="radio"
              aria-checked={props.bondOrder === o.id}
              className={`seg-item ${props.bondOrder === o.id ? "active" : ""}`}
              onClick={() => props.onBondOrder(o.id)}
              title={o.id}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="hint">Used when adding atoms and when bonding or re-ordering with the Bond tool.</p>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">Edit</h2>
        <div className="button-row">
          <button id="btn-undo" type="button" className="btn" onClick={props.onUndo} disabled={!props.canUndo} title={props.undoLabel ? `Undo: ${props.undoLabel} (Ctrl+Z)` : "Nothing to undo"}>
            Undo
          </button>
          <button id="btn-redo" type="button" className="btn" onClick={props.onRedo} disabled={!props.canRedo} title={props.redoLabel ? `Redo: ${props.redoLabel} (Ctrl+Shift+Z)` : "Nothing to redo"}>
            Redo
          </button>
        </div>
        <button id="btn-delete-selection" type="button" className="btn btn-block" onClick={props.onDeleteSelection} disabled={!props.hasSelection} title="Delete selected atoms and bonds (Delete)">
          Delete selection
        </button>
        <div className="button-row">
          <button id="btn-add-h" type="button" className="btn" onClick={props.onAddHydrogens} title="Add explicit hydrogens to satisfy valence (selected atom, or all atoms)">
            Add H
          </button>
          <button id="btn-remove-h" type="button" className="btn" onClick={props.onRemoveHydrogens} title="Remove all hydrogen atoms">
            Remove H
          </button>
        </div>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">Geometry</h2>
        <label className="toggle">
          <input id="toggle-auto-tidy" type="checkbox" checked={props.autoTidy} onChange={props.onToggleAutoTidy} />
          <span>Auto-tidy after edits</span>
        </label>
        <button id="btn-tidy" type="button" className="btn btn-block" onClick={props.onTidy} title="Relax bond lengths, angles and planarity (T)">
          Tidy now
        </button>
        <p className="hint">Sketch clean-up: ideal bond lengths, VSEPR angles, planar sp2, staggered torsions. A drawing aid, not a physical force field; use the server engine for MMFF94.</p>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">Molecule</h2>
        <button id="btn-new" type="button" className="btn btn-block" onClick={props.onNewMolecule}>
          New (empty)
        </button>
        <label className="field">
          <span className="field-label">Start from a sample</span>
          <select
            id="sample-select"
            className="select"
            value={sampleId}
            onChange={(e) => {
              setSampleId("");
              if (e.target.value) props.onLoadSample(e.target.value);
            }}
          >
            <option value="">Load sample…</option>
            {props.samples.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.id}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">View</h2>
        <div className="button-row">
          <button id="btn-fit" type="button" className="btn" onClick={props.onFit} title="Fit molecule to viewport (F)">
            Fit
          </button>
          <button id="btn-reset" type="button" className="btn" onClick={props.onReset} title="Reset camera (R)">
            Reset
          </button>
        </div>
        <label className="toggle">
          <input id="toggle-labels" type="checkbox" checked={props.showLabels} onChange={props.onToggleLabels} />
          <span>Atom labels</span>
          <kbd>L</kbd>
        </label>
        <label className="toggle">
          <input id="toggle-additive" type="checkbox" checked={props.additiveMode} onChange={props.onToggleAdditive} />
          <span>Add to selection</span>
          <kbd>Shift</kbd>
        </label>
      </section>
    </aside>
  );
}
