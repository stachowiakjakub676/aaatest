import { useState } from "react";
import type { DisconnectionCandidate, Provenance, ReactionRecord, Reagent, ReagentRole, TargetAnalysis } from "../retro/types";
import { validateReactionRecord } from "../retro/types";

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
  onSaveReaction(candidateId: string, record: ReactionRecord): void;
  onExportJson(): void;
  exported: boolean;
}

const ROLES: ReagentRole[] = ["reactant", "reagent", "catalyst", "solvent", "workup", "other"];

function provenanceLabel(p: Provenance): string {
  switch (p.source) {
    case "user":
      return "your notes";
    case "literature":
      return `literature: ${p.citation}${p.doi ? ` (doi:${p.doi})` : ""}`;
    case "database":
      return `${p.database} #${p.recordId}`;
    case "model":
      return `model ${p.model}${p.confidence !== undefined ? ` (confidence ${p.confidence})` : ""}`;
  }
}

function ReactionView({ r }: { r: ReactionRecord }) {
  return (
    <div className="reaction">
      <div className="row">
        <span className="row-label">Provenance</span>
        <span className="row-value">
          {provenanceLabel(r.provenance)}
          {r.provenance.source === "model" && (r.reviewed ? " · reviewed" : " · unreviewed")}
        </span>
      </div>
      {r.reagents.length > 0 && (
        <table className="reagents">
          <tbody>
            {r.reagents.map((g, i) => (
              <tr key={i}>
                <td className="mono">{g.role}</td>
                <td>{g.name}</td>
                <td className="mono">{g.equivalents !== undefined ? `${g.equivalents} eq` : g.amount ? `${g.amount.value} ${g.amount.unit}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row">
        <span className="row-label">Conditions</span>
        <span className="row-value mono">
          {[r.conditions.temperature ? `${r.conditions.temperature.value} °${r.conditions.temperature.unit}` : null, r.conditions.time ? `${r.conditions.time.value} ${r.conditions.time.unit}` : null, r.conditions.pressure ? `${r.conditions.pressure.value} ${r.conditions.pressure.unit}` : null, r.conditions.atmosphere ?? null]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      </div>
      {r.conditions.notes && <p className="hint">{r.conditions.notes}</p>}
      {r.yield && (
        <div className="row">
          <span className="row-label">Yield</span>
          <span className="row-value mono">
            {r.yield.value} % ({r.yield.type})
          </span>
        </div>
      )}
      {r.procedure && <p className="procedure">{r.procedure}</p>}
    </div>
  );
}

function ReactionForm({ onSave, onCancel }: { onSave(record: ReactionRecord): void; onCancel(): void }) {
  const [reagents, setReagents] = useState<Reagent[]>([{ role: "reactant", name: "" }]);
  const [temperature, setTemperature] = useState("");
  const [time, setTime] = useState("");
  const [atmosphere, setAtmosphere] = useState("");
  const [yieldValue, setYieldValue] = useState("");
  const [yieldType, setYieldType] = useState<"isolated" | "nmr" | "reported" | "estimated">("isolated");
  const [procedure, setProcedure] = useState("");
  const [citation, setCitation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const raw: Record<string, unknown> = {
      reagents: reagents.filter((g) => g.name.trim() !== "").map((g) => ({ ...g, name: g.name.trim() })),
      conditions: {
        ...(temperature.trim() ? { temperature: { value: Number(temperature), unit: "C" } } : {}),
        ...(time.trim() ? { time: { value: Number(time), unit: "h" } } : {}),
        ...(atmosphere.trim() ? { atmosphere: atmosphere.trim() } : {}),
      },
      ...(yieldValue.trim() ? { yield: { value: Number(yieldValue), unit: "%", type: yieldType } } : {}),
      procedure: procedure.trim(),
      provenance: citation.trim() ? { source: "literature", citation: citation.trim() } : { source: "user" },
      reviewed: true,
    };
    const v = validateReactionRecord(raw);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    onSave(v.record);
  };

  return (
    <form
      className="reaction-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="field-label">Reagents</span>
      {reagents.map((g, i) => (
        <div key={i} className="reagent-row">
          <select className="select" value={g.role} onChange={(e) => setReagents((rs) => rs.map((x, j) => (j === i ? { ...x, role: e.target.value as ReagentRole } : x)))} aria-label="Role">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input className="input" placeholder="name" value={g.name} onChange={(e) => setReagents((rs) => rs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Reagent name" />
          <input
            className="input mono"
            placeholder="eq"
            inputMode="decimal"
            value={g.equivalents ?? ""}
            onChange={(e) =>
              setReagents((rs) =>
                rs.map((x, j) => {
                  if (j !== i) return x;
                  const { equivalents: _e, ...restX } = x;
                  void _e;
                  return e.target.value ? { ...restX, equivalents: Number(e.target.value) } : restX;
                }),
              )
            }
            aria-label="Equivalents"
          />
        </div>
      ))}
      <button type="button" className="btn btn-small" onClick={() => setReagents((rs) => [...rs, { role: "reagent", name: "" }])}>
        + reagent
      </button>
      <div className="reagent-row">
        <input className="input mono" placeholder="temperature °C" inputMode="decimal" value={temperature} onChange={(e) => setTemperature(e.target.value)} aria-label="Temperature" />
        <input className="input mono" placeholder="time h" inputMode="decimal" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
        <input className="input" placeholder="atmosphere" value={atmosphere} onChange={(e) => setAtmosphere(e.target.value)} aria-label="Atmosphere" />
      </div>
      <div className="reagent-row">
        <input className="input mono" placeholder="yield %" inputMode="decimal" value={yieldValue} onChange={(e) => setYieldValue(e.target.value)} aria-label="Yield" />
        <select className="select" value={yieldType} onChange={(e) => setYieldType(e.target.value as typeof yieldType)} aria-label="Yield type">
          <option value="isolated">isolated</option>
          <option value="nmr">NMR</option>
          <option value="reported">reported</option>
          <option value="estimated">estimated</option>
        </select>
      </div>
      <textarea className="textarea" rows={4} placeholder="Procedure / notes" value={procedure} onChange={(e) => setProcedure(e.target.value)} aria-label="Procedure" />
      <input className="input" placeholder="Citation (optional; sets provenance to literature)" value={citation} onChange={(e) => setCitation(e.target.value)} aria-label="Citation" />
      {error && <p className="hint error-text">{error}</p>}
      <div className="button-row">
        <button type="submit" className="btn btn-small" id="btn-save-reaction">
          Save to candidate
        </button>
        <button type="button" className="btn btn-small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function RetroPanel(props: RetroPanelProps) {
  const { analysis, candidates } = props;
  const [editing, setEditing] = useState<string | null>(null);
  const selected = candidates.find((c) => c.id === props.selectedId) ?? null;

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
          <button id="btn-retro-export" type="button" className="btn" onClick={props.onExportJson} disabled={!analysis}>
            {props.exported ? "Copied" : "Copy JSON"}
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
            <div className="row">
              <span className="row-label">Target screening</span>
              <span className="row-value">{analysis.screening.permitted ? "permitted" : "not permitted"} · {analysis.screening.screener}</span>
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
              <li key={c.id} className={`suggestion candidate ${props.selectedId === c.id ? "selected" : ""}`}>
                <div className="candidate-body" onClick={() => props.onSelect(props.selectedId === c.id ? null : c)} role="button" tabIndex={0}>
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
                </div>
                {props.selectedId === c.id && (
                  <div className="reaction-section">
                    <span className="field-label">Reaction data (reagents, conditions, yield, procedure)</span>
                    {c.reaction ? <ReactionView r={c.reaction} /> : <p className="hint">Not provided: the mock has no reaction knowledge base. Add your own notes below; they are stored with provenance “your notes” and included in the JSON export.</p>}
                    {editing === c.id ? (
                      <ReactionForm
                        onSave={(record) => {
                          props.onSaveReaction(c.id, record);
                          setEditing(null);
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <button type="button" className="btn btn-small" id="btn-add-reaction" onClick={() => setEditing(c.id)}>
                        {c.reaction ? "Replace with my notes" : "Add reaction notes"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="hint">Tap a candidate to highlight the bond in the viewport and to see or add its reaction data. Fragments are H-capped graph pieces.</p>
        </section>
      )}
      {selected === null && analysis && candidates.length > 0 && <></>}
      <section className="panel-section panel-section-muted">
        <h2 className="panel-title">Interface</h2>
        <p className="hint">
          Service: {props.serviceLabel}. A future module implements <span className="mono">analyzeTarget</span>, <span className="mono">generateCandidates</span> and <span className="mono">rankCandidates</span>; reaction records carry provenance (user, literature, database, model) and pass the safety policy before display: model-generated details stay hidden until reviewed, and a deployment-specific target screener can withhold them entirely.
        </p>
      </section>
    </div>
  );
}
