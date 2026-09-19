import { useState } from "react";
import { GENERATORS, PROPERTY_BY_KEY, filterRecords, hasErrors, serializeRun, verdictReason } from "@molecular-cad/design-engine";
import type { CandidateFilter, CandidateRecord, CheckStatus, GeneratorParams, Specification, SpecificationIssue } from "@molecular-cad/design-engine";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { DesignRunApi } from "../../design/useDesignRun";

export interface CandidatesPanelProps {
  api: DesignRunApi;
  spec: Specification;
  issues: SpecificationIssue[];
  seed: Molecule;
  onOpenCandidate(record: CandidateRecord): void;
}

const VERDICT: Record<CheckStatus, { label: string; cls: string }> = { pass: { label: "✓ pass", cls: "ok" }, fail: { label: "✗ fail", cls: "err" }, borderline: { label: "△ borderline", cls: "warn" }, unknown: { label: "? undecided", cls: "warn" } };
const FILTERS: Array<[CandidateFilter, string]> = [
  ["all", "all"],
  ["passing", "passing"],
  ["passing-or-borderline", "passing or borderline"],
  ["failing", "failing"],
  ["undecided", "undecided"],
  ["rejected", "rejected"],
];

function fmt(v: number | string): string {
  return typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1)) : v;
}

/** Cell with every requirement's verdict, for the row tooltip and the expandable detail. */
function checksText(r: CandidateRecord): string {
  const ev = r.evaluation;
  if (!ev) return "";
  return [...ev.constraints.map((c) => `${VERDICT[c.status].label}  ${c.requirement} — ${c.reason}`), ...ev.structural.map((s) => `${VERDICT[s.status].label}  ${s.rule} — ${s.reason}`)].join("\n");
}

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Candidate generation and validation (phase 3B). Evaluation, filtering and ranking join in 3C/3D. */
export function CandidatesPanel({ api, spec, issues, seed, onOpenCandidate }: CandidatesPanelProps) {
  const [generatorId, setGeneratorId] = useState(GENERATORS[0]!.id);
  const [limit, setLimit] = useState("60");
  const [filter, setFilter] = useState<CandidateFilter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const generator = GENERATORS.find((g) => g.id === generatorId)!;
  const broken = hasErrors(issues);
  const seedEmpty = seed.atoms.length === 0;
  const needsSeed = generatorId === "derivatives";
  const run = api.run;
  const shown = run ? filterRecords(run.records, filter) : [];
  // Properties the specification talks about, shown as columns (hard constraints first, then preferences).
  const columns = [...new Set([...spec.hard.map((c) => c.property), ...spec.soft.map((p) => p.property)])].filter((k) => PROPERTY_BY_KEY.has(k));

  return (
    <section className="panel-section" id="candidates">
      <h2 className="panel-title">
        Candidates <span className="tag tag-computed">generated · validated</span>
      </h2>
      <div className="custom-element">
        <label className="field">
          <span className="field-label">Generator</span>
          <select id="gen-select" className="select" value={generatorId} onChange={(e) => setGeneratorId(e.target.value)}>
            {GENERATORS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Limit</span>
          <input id="gen-limit" className="input mono" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
      </div>
      <p className="hint">{generator.description}</p>
      <div className="button-row">
        <button
          type="button"
          className="btn"
          id="btn-generate"
          disabled={api.running || broken || (needsSeed && seedEmpty)}
          onClick={() => {
            const params: GeneratorParams = {};
            void api.start(spec, seed, generatorId, params, Math.max(1, Math.min(2000, Number(limit) || 60)));
          }}
          title={broken ? "Fix the specification first" : needsSeed && seedEmpty ? "Open or draw a seed molecule in the editor" : "Generate candidates and validate them"}
        >
          {api.running ? "Working…" : "Generate and validate"}
        </button>
        {run && (
          <button type="button" className="btn btn-small" id="btn-run-export" onClick={() => download(`${run.id}.clapeyron-run.json`, serializeRun(run))} title="Download the run (specification snapshot, generator, every candidate with its status)">
            Export run
          </button>
        )}
        {run && (
          <button type="button" className="btn btn-small" onClick={api.clear}>
            Clear
          </button>
        )}
      </div>
      {api.progress && (
        <p className="hint" id="gen-progress">
          {api.progress.stage === "generating" ? "Generating" : api.progress.stage === "validating" ? "Validating" : "Evaluating properties"} {api.progress.done} / {api.progress.total || "…"}
        </p>
      )}
      {api.error && <p className="hint error-text">{api.error}</p>}
      {run && (
        <>
          <div className="row">
            <span className="row-label">Run {run.id}</span>
            <span className="row-value" id="run-summary">
              <span className="status-chip ok">{run.evaluation.passed} pass</span> <span className="status-chip warn">{run.evaluation.borderline} borderline</span> <span className="status-chip err">{run.evaluation.failed} fail</span> <span className="status-chip warn">{run.evaluation.undecided} undecided</span> <span className="muted">· {run.summary.valid} valid of {run.summary.generated} generated, {run.summary.rejected} rejected</span>
            </span>
          </div>
          <p className="hint">
            {run.generator.label}
            {run.seed ? ` on ${run.seed.name} (${run.seed.atoms} atoms)` : ""} · {run.provenance.engine} · {run.createdAt.replace("T", " ").slice(0, 19)} · rejections: {Object.entries(run.rejectionsByStage).filter(([, n]) => n > 0).map(([s, n]) => `${s} ${n}`).join(", ") || "none"} · profiles from cache: {run.evaluation.cacheHits}
          </p>
          <p className="hint" id="run-models">Models: {run.provenance.models.join("; ")}</p>
          <div className="seg" role="radiogroup" aria-label="Show candidates" id="cand-filter">
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={filter === id} className={`seg-item ${filter === id ? "active" : ""}`} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
          <table className="solvent-table candidate-table">
            <thead>
              <tr>
                <th>#</th>
                <th>candidate</th>
                <th>verdict</th>
                {columns.map((k) => (
                  <th key={k} className="mono" title={PROPERTY_BY_KEY.get(k)!.method}>
                    {PROPERTY_BY_KEY.get(k)!.label}
                    {PROPERTY_BY_KEY.get(k)!.unit ? ` (${PROPERTY_BY_KEY.get(k)!.unit})` : ""}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const verdict = r.status === "rejected" ? null : (r.evaluation?.overall ?? "unknown");
                const reason = verdictReason(r);
                const expanded = open === r.candidate.id;
                return [
                  <tr key={r.candidate.id} className={`cand-${r.status} ${verdict ? `check-${verdict}` : ""}`} title={r.status === "rejected" ? `${r.rejection?.stage}: ${r.rejection?.reason}` : checksText(r)}>
                    <td className="mono">{i + 1}</td>
                    <td>
                      {r.candidate.name}
                      {r.canonicalSmiles && <div className="mono muted small">{r.canonicalSmiles}</div>}
                      <div className="muted small">{r.candidate.origin.operations.join("; ")}</div>
                    </td>
                    <td>
                      {r.status === "rejected" ? <span className="status err">rejected: {r.rejection?.stage}</span> : <span className={`status ${VERDICT[verdict!].cls}`}>{VERDICT[verdict!].label}</span>}
                      {reason && <div className="muted small verdict-reason">{reason}</div>}
                      {r.evaluation && (
                        <button type="button" className="link-btn small" onClick={() => setOpen(expanded ? null : r.candidate.id)}>
                          {expanded ? "hide checks" : `${r.evaluation.counts.pass}✓ ${r.evaluation.counts.fail}✗ ${r.evaluation.counts.borderline}△ ${r.evaluation.counts.unknown}?`}
                        </button>
                      )}
                    </td>
                    {columns.map((k) => {
                      const v = r.profile?.[k];
                      return (
                        <td key={k} className="mono" title={v ? `${v.method}${v.uncertainty ? ` · ${v.uncertainty}` : ""}` : "not available"}>
                          {v ? (
                            <>
                              {fmt(v.value)} <span className={`tag tag-${v.kind === "computed" ? "computed" : "predicted"}`}>{v.kind[0]}</span>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <button type="button" className="btn btn-small" onClick={() => onOpenCandidate(r)} title="Open this candidate in a new editor tab">
                        Open
                      </button>
                    </td>
                  </tr>,
                  expanded && r.evaluation ? (
                    <tr key={`${r.candidate.id}-checks`} className="checks-row">
                      <td colSpan={4 + columns.length}>
                        <ul className="reasoning">
                          {r.evaluation.constraints.map((c) => (
                            <li key={c.constraintId} className={`check-${c.status}`}>
                              <span className="mono">{VERDICT[c.status].label}</span> {c.requirement} — {c.reason}
                            </li>
                          ))}
                          {r.evaluation.structural.map((s, j) => (
                            <li key={j} className={`check-${s.status}`}>
                              <span className="mono">{VERDICT[s.status].label}</span> {s.rule} — {s.reason}
                            </li>
                          ))}
                          {r.evaluationError && <li className="error-text">Evaluator error: {r.evaluationError}</li>}
                        </ul>
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
          <p className="hint">Pipeline: generate → validate (structural scope, graph, RDKit sanitisation, duplicates, SMARTS) → evaluate every valid candidate with the same descriptors and models as the Chemistry tab (c = computed, p = predicted; hover a value for its method and error) → apply the hard constraints. A miss within the model error is borderline, a missing value leaves the candidate undecided. Ranking by the soft preferences arrives in phase 3D; the order here is the generation order.</p>
        </>
      )}
    </section>
  );
}
