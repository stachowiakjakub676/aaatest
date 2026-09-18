import type { DisconnectionCandidate, TargetAnalysis } from "../retro/types";

export interface RetroPanelProps {
  serviceLabel: string;
  disclaimer: string;
  analysis: TargetAnalysis | null;
  candidates: DisconnectionCandidate[];
  working: boolean;
  error: string | null;
  selectedId: string | null;
  hasAtoms: boolean;
  onAnalyze(): void;
  onSelect(candidate: DisconnectionCandidate | null): void;
}

export function RetroPanel(props: RetroPanelProps) {
  const { analysis, candidates } = props;
  return (
    <div className="panel-content">
      <section className="panel-section">
        <h2 className="panel-title">
          Retrosynthesis <span className="tag tag-predicted">mock</span>
        </h2>
        <p className="hint">{props.disclaimer}</p>
        <div className="button-row">
          <button id="btn-retro" type="button" className="btn" onClick={props.onAnalyze} disabled={!props.hasAtoms || props.working}>
            {props.working ? "Analysing…" : "Analyse target"}
          </button>
        </div>
        {props.error && <p className="hint error-text">{props.error}</p>}
        {analysis && (
          <>
            <div className="row">
              <span className="row-label">Heavy atoms / rings</span>
              <span className="row-value mono">
                {analysis.heavyAtomCount} / {analysis.ringCount}
              </span>
            </div>
            <div className="row">
              <span className="row-label">Recognised groups</span>
              <span className="row-value">{analysis.functionalGroups.length ? analysis.functionalGroups.map((g) => g.name).join(", ") : "none"}</span>
            </div>
            <div className="row">
              <span className="row-label">Disconnectable bonds</span>
              <span className="row-value mono">{analysis.disconnectableBondCount}</span>
            </div>
            {analysis.notes.map((n, i) => (
              <p key={i} className="hint">
                {n}
              </p>
            ))}
          </>
        )}
      </section>

      {analysis && (
        <section className="panel-section">
          <h2 className="panel-title">Conceptual disconnections</h2>
          {candidates.length === 0 && <p className="hint">No candidates for this target.</p>}
          <ul className="suggestion-list">
            {candidates.map((c) => (
              <li key={c.id} className={`suggestion candidate ${props.selectedId === c.id ? "selected" : ""}`} onClick={() => props.onSelect(props.selectedId === c.id ? null : c)} role="button" tabIndex={0}>
                <div className="suggestion-head">
                  <strong>
                    #{c.rank} {c.strategy}
                  </strong>
                  <span className="tag tag-computed mono">bond {c.bondId}</span>
                </div>
                <p className="hint">{c.description}</p>
                <ul className="fragment-list">
                  {c.fragments.map((f, i) => (
                    <li key={i} className="mono">
                      {f.heavyAtomCount} heavy · {f.smiles ?? "(SMILES unavailable)"}
                    </li>
                  ))}
                </ul>
                <p className="hint">{c.rationale[c.rationale.length - 1]}</p>
              </li>
            ))}
          </ul>
          <p className="hint">Tap a candidate to highlight the bond in the viewport. Fragments are H-capped graph pieces, not reagents.</p>
        </section>
      )}
      <section className="panel-section panel-section-muted">
        <h2 className="panel-title">Interface</h2>
        <p className="hint">
          Service: {props.serviceLabel}. Any future research module implements <span className="mono">analyzeTarget</span>, <span className="mono">generateCandidates</span> and <span className="mono">rankCandidates</span> and passes every candidate through the safety policy before it reaches this panel.
        </p>
      </section>
    </div>
  );
}
