import { useState } from "react";
import type { AnalysisReport, Explanation, Suggestion } from "../ai/types";

export type ExplainerChoice = "template" | "remote";

export interface AssistantPanelProps {
  report: AnalysisReport;
  explainer: ExplainerChoice;
  onExplainer(choice: ExplainerChoice): void;
  explanation: Explanation | null;
  explaining: boolean;
  error: string | null;
  onExplain(): void;
  onApplySuggestion(s: Suggestion): void;
  serverAiEnabled: boolean | null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-value mono">{value}</span>
    </div>
  );
}

export function AssistantPanel(props: AssistantPanelProps) {
  const { report, explanation } = props;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const suggestions = [...report.suggestions, ...(explanation?.suggestions ?? [])].filter((s) => !dismissed.has(s.id));
  const hasAtoms = report.molecule.atomCount > 0;

  return (
    <div className="panel-content">
      <section className="panel-section">
        <h2 className="panel-title">
          Assistant <span className="tag tag-computed">explains computed results</span>
        </h2>
        <p className="hint">The assistant reads a structured report from the deterministic chemistry layer. It never edits the structure: every suggestion below needs your confirmation and is one undoable step.</p>
        <label className="field">
          <span className="field-label">Explanation source</span>
          <select id="explainer-select" className="select" value={props.explainer} onChange={(e) => props.onExplainer(e.target.value as ExplainerChoice)}>
            <option value="template">Built-in templates (offline, deterministic)</option>
            <option value="remote">Language model via server{props.serverAiEnabled === false ? " (not configured on server)" : ""}</option>
          </select>
        </label>
        <div className="button-row">
          <button id="btn-explain" type="button" className="btn" onClick={props.onExplain} disabled={!hasAtoms || props.explaining}>
            {props.explaining ? "Explaining…" : "Explain this molecule"}
          </button>
        </div>
        {props.error && <p className="hint error-text">{props.error}</p>}
        {explanation && (
          <div className="explanation">
            <p className="explanation-text">{explanation.text}</p>
            <p className="hint">Source: {explanation.source}. {explanation.disclaimer}</p>
          </div>
        )}
      </section>

      <section className="panel-section">
        <h2 className="panel-title">
          Suggestions <span className="tag tag-predicted">need confirmation</span>
        </h2>
        {suggestions.length === 0 && <p className="hint">{hasAtoms ? "No suggestions right now." : "Add atoms to get suggestions."}</p>}
        <ul className="suggestion-list">
          {suggestions.map((s) => (
            <li key={s.id} className="suggestion">
              <div className="suggestion-head">
                <strong>{s.title}</strong>
                <span className={`tag ${s.source === "llm" ? "tag-predicted" : "tag-computed"}`}>{s.source === "llm" ? "language model" : "rule"}</span>
              </div>
              {s.rationale && <p className="hint">{s.rationale}</p>}
              <p className="hint mono">{s.operations.map((op) => op.op).join(" → ")}</p>
              <div className="button-row">
                <button type="button" className="btn btn-small" onClick={() => props.onApplySuggestion(s)}>
                  Apply (undoable)
                </button>
                <button type="button" className="btn btn-small" onClick={() => setDismissed((d) => new Set([...d, s.id]))}>
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">
          Report <span className="tag tag-computed">computed</span>
        </h2>
        <Row label="Formula" value={report.molecule.formulaWithImplicitH || "—"} />
        <Row label="Heavy atoms / rings" value={`${report.molecule.heavyAtomCount} / ${report.molecule.ringCount}`} />
        <Row label="Functional groups" value={report.molecule.functionalGroups.length ? report.molecule.functionalGroups.join(", ") : "none recognised"} />
        <Row label="Validation" value={report.validation.valid ? "valid" : `${report.validation.errors.length} error(s)`} />
        {report.ruleChecks.length > 0 && (
          <ul className="issue-list">
            {report.ruleChecks.map((c) => (
              <li key={c.id} className={`issue ${c.passed ? "ok" : "warning"}`}>
                <span className="issue-code mono">{c.passed ? "PASS" : "FAIL"}</span>
                <span>{c.detail}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">Rule checks (Lipinski) are evaluations of computed descriptors, not predictions of biological behaviour.</p>
      </section>
    </div>
  );
}
