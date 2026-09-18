import { useState } from "react";
import type { ChemistryEngine } from "../chemistry/engine";
import type { ChemistryState } from "../chemistry/useChemistry";

export type EngineChoice = "wasm" | "server";

export interface ChemistryPanelProps {
  engine: ChemistryEngine;
  state: ChemistryState;
  choice: EngineChoice;
  onChoice(choice: EngineChoice): void;
  serverUrl: string;
  onServerUrl(url: string): void;
  onOptimize(opts: { embed: boolean }): void;
  optimizing: boolean;
  hasAtoms: boolean;
}

function Row({ label, value, mono = true, title }: { label: string; value: React.ReactNode; mono?: boolean; title?: string }) {
  return (
    <div className="row" title={title}>
      <span className="row-label">{label}</span>
      <span className={mono ? "row-value mono" : "row-value"}>{value}</span>
    </div>
  );
}

function fmtNumber(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 3 : 2);
}

export function ChemistryPanel(props: ChemistryPanelProps) {
  const { engine, state } = props;
  const [urlDraft, setUrlDraft] = useState(props.serverUrl);
  const statusChip =
    state.status === "loading" ? <span className="status-chip warn">loading</span> : state.status === "error" ? <span className="status-chip err">unavailable</span> : <span className="status-chip ok">{state.computing ? "computing…" : `ready · ${state.version}`}</span>;

  return (
    <>
      <section className="panel-section">
        <h2 className="panel-title">
          Chemistry engine <span className="tag tag-computed">computed</span>
        </h2>
        <label className="field">
          <span className="field-label">Engine</span>
          <select id="engine-select" className="select" value={props.choice} onChange={(e) => props.onChoice(e.target.value as EngineChoice)}>
            <option value="wasm">RDKit in browser (WebAssembly, offline)</option>
            <option value="server">RDKit server (FastAPI, geometry optimisation)</option>
          </select>
        </label>
        {props.choice === "server" && (
          <form
            className="custom-element"
            onSubmit={(e) => {
              e.preventDefault();
              props.onServerUrl(urlDraft.trim());
            }}
          >
            <input id="server-url" className="input mono" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="http://localhost:8000" aria-label="Server URL" />
            <button type="submit" className="btn btn-small">
              Connect
            </button>
          </form>
        )}
        <div className="row">
          <span className="row-label">Status</span>
          <span className="row-value">{statusChip}</span>
        </div>
        {state.error && <p className="hint error-text">{state.error}</p>}
        <div className="button-row">
          <button
            id="btn-optimize"
            type="button"
            className="btn"
            disabled={!engine.capabilities.optimizeGeometry || state.status !== "ready" || props.optimizing || !props.hasAtoms}
            onClick={() => props.onOptimize({ embed: false })}
            title={engine.capabilities.optimizeGeometry ? "Minimise the force-field energy from the current coordinates (MMFF94 or UFF)" : "Needs the server engine"}
          >
            {props.optimizing ? "Optimising…" : "Optimise geometry"}
          </button>
          <button
            id="btn-embed"
            type="button"
            className="btn"
            disabled={!engine.capabilities.optimizeGeometry || state.status !== "ready" || props.optimizing || !props.hasAtoms}
            onClick={() => props.onOptimize({ embed: true })}
            title={engine.capabilities.optimizeGeometry ? "Discard current coordinates and generate a fresh 3D conformer (ETKDG) before minimising" : "Needs the server engine"}
          >
            Re-embed 3D
          </button>
        </div>
        {!engine.capabilities.optimizeGeometry && <p className="hint">Geometry optimisation is only available with the server engine: force fields are not part of the RDKit WebAssembly build.</p>}
      </section>

      {state.validation && !state.validation.valid && (
        <section className="panel-section">
          <h2 className="panel-title">Engine validation</h2>
          <ul className="issue-list">
            {state.validation.issues.map((issue, i) => (
              <li key={i} className={`issue ${issue.severity}`}>
                <span className="issue-code mono">{issue.code}</span>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel-section">
        <h2 className="panel-title">
          Properties <span className="tag tag-computed">computed</span>
        </h2>
        {!props.hasAtoms && <p className="hint">Add atoms to compute properties.</p>}
        {props.hasAtoms && !state.properties && !state.computing && state.status === "ready" && <p className="hint">Not available: the engine rejected the structure (see engine validation).</p>}
        {state.properties && (
          <>
            <Row label="Canonical SMILES" value={state.properties.canonicalSmiles} />
            {state.properties.inchiKey && <Row label="InChIKey" value={state.properties.inchiKey} />}
            {state.properties.molecularWeight !== undefined && <Row label="Mol. weight (with H)" value={`${state.properties.molecularWeight.toFixed(3)} g/mol`} />}
            {state.properties.exactMass !== undefined && <Row label="Exact mass" value={`${state.properties.exactMass.toFixed(4)} Da`} />}
            {Object.entries(state.properties.descriptors)
              .filter(([key]) => key !== "exactMass")
              .map(([key, d]) => (
                <Row key={key} label={d.label} value={`${fmtNumber(d.value)}${d.unit ? ` ${d.unit}` : ""}`} />
              ))}
            <p className="hint">Source: {state.properties.source}. Deterministic functions of the structure, not measurements.</p>
          </>
        )}
      </section>

      {state.stereo && (state.stereo.atoms.length > 0 || state.stereo.bonds.length > 0) && (
        <section className="panel-section">
          <h2 className="panel-title">
            Stereochemistry <span className="tag tag-computed">computed</span>
          </h2>
          {state.stereo.atoms.map((a) => (
            <Row key={a.atomId} label={`Centre ${a.atomId}`} value={a.label === "?" ? "unassigned (flat or ambiguous geometry)" : a.label} />
          ))}
          {state.stereo.bonds.map((b) => (
            <Row key={b.bondId} label={`Double bond ${b.bondId}`} value={b.label} />
          ))}
          <p className="hint">CIP labels perceived from the 3D coordinates ({state.stereo.source}). Select an atom or bond to invert or flip it.</p>
        </section>
      )}

      <section className="panel-section">
        <h2 className="panel-title">
          Estimated properties <span className="tag tag-predicted">predicted</span>
        </h2>
        {state.predictions.length === 0 && <p className="hint">{props.hasAtoms ? "No estimates yet (waiting for descriptors or the structure is rejected)." : "Add atoms to get estimates."}</p>}
        <ul className="prediction-list">
          {state.predictions.map((p) => (
            <li key={p.id} className="prediction">
              <div className="row">
                <span className="row-label">{p.label}</span>
                <span className="row-value mono">
                  {typeof p.value === "number" ? fmtNumber(p.value) : p.value}
                  {p.unit ? ` ${p.unit}` : ""}
                </span>
              </div>
              <p className="hint">
                {p.model}
                {p.uncertainty ? `. ${p.uncertainty}.` : ""}
              </p>
            </li>
          ))}
        </ul>
        <p className="hint">Model outputs, not measurements: each one names its model and its known error. {state.predictionSource}</p>
      </section>

      {state.properties?.inchiKey && (
        <section className="panel-section">
          <h2 className="panel-title">Is it new?</h2>
          <Row label="InChIKey" value={state.properties.inchiKey} />
          <p className="hint">
            Novelty can only be checked against databases. Search this exact structure in PubChem:{" "}
            <a className="link" href={`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(state.properties.inchiKey)}`} target="_blank" rel="noreferrer">
              open PubChem
            </a>
            . No hit is a hint, not proof, that the compound is unreported.
          </p>
        </section>
      )}
    </>
  );
}
