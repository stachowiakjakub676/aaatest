import type { Molecule } from "@molecular-cad/molecule-model";

export interface ToolboxProps {
  molecules: readonly Molecule[];
  currentId: string;
  onLoad(id: string): void;
  showLabels: boolean;
  onToggleLabels(): void;
  additiveMode: boolean;
  onToggleAdditive(): void;
  onFit(): void;
  onReset(): void;
  onClearSelection(): void;
}

export function Toolbox(props: ToolboxProps) {
  return (
    <aside className="panel toolbox" aria-label="Toolbox">
      <section className="panel-section">
        <h2 className="panel-title">Molecule</h2>
        <label className="field">
          <span className="field-label">Built-in sample</span>
          <select id="sample-select" className="select" value={props.currentId} onChange={(e) => props.onLoad(e.target.value)}>
            {props.molecules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.id}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">Coordinates: RDKit ETKDGv3 + MMFF94, explicit hydrogens.</p>
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
        <div className="field">
          <span className="field-label">Display style</span>
          <span className="value">Ball and stick</span>
          <span className="hint">Sticks / space-filling: later phase</span>
        </div>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">Select</h2>
        <label className="toggle">
          <input id="toggle-additive" type="checkbox" checked={props.additiveMode} onChange={props.onToggleAdditive} />
          <span>Add to selection</span>
          <kbd>Shift</kbd>
        </label>
        <button id="btn-clear-selection" type="button" className="btn btn-block" onClick={props.onClearSelection} title="Clear selection (Esc)">
          Clear selection
        </button>
        <p className="hint">Select 2 atoms for a distance, 3 for an angle.</p>
      </section>

      <section className="panel-section panel-section-muted">
        <h2 className="panel-title">Edit</h2>
        <p className="hint">Add / delete atoms and bonds, bond orders, undo and redo arrive in phase 3.</p>
      </section>
    </aside>
  );
}
