import { useMemo, useState } from "react";
import { GENERATORS, PROPERTY_BY_KEY, filterRecords, hasErrors, rankRecords, serializeRun, verdictReason } from "@molecular-cad/design-engine";
import type { CandidateFilter, CandidateRecord, CheckStatus, GeneratorParams, RankedRecord, Specification, SpecificationIssue } from "@molecular-cad/design-engine";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { DesignRunApi } from "../../design/useDesignRun";
import type { ChemistryEngine } from "../../chemistry/engine";
import { XyChart } from "../XyChart";
import { ComparisonPanel } from "./ComparisonPanel";

export interface CandidatesPanelProps {
  api: DesignRunApi;
  spec: Specification;
  issues: SpecificationIssue[];
  seed: Molecule;
  /** In-browser engine for 2D depictions in the comparison. */
  engine: ChemistryEngine;
  onOpenCandidate(record: CandidateRecord): void;
}

const MAX_COMPARE = 6;

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
export function CandidatesPanel({ api, spec, issues, seed, engine, onOpenCandidate }: CandidatesPanelProps) {
  const [generatorId, setGeneratorId] = useState(GENERATORS[0]!.id);
  const [limit, setLimit] = useState("60");
  const [filter, setFilter] = useState<CandidateFilter>("all");
  const [order, setOrder] = useState<"generation" | "ranking">("ranking");
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const generator = GENERATORS.find((g) => g.id === generatorId)!;
  const broken = hasErrors(issues);
  const seedEmpty = seed.atoms.length === 0;
  const needsSeed = generatorId === "derivatives";
  const run = api.run;
  const ranking = useMemo(() => (run ? rankRecords(run.records, spec) : null), [run, spec]);
  const ranked: RankedRecord[] = ranking ? ranking.records : [];
  const shown = useMemo(() => {
    const kept = filterRecords(ranked, filter) as RankedRecord[];
    if (order === "generation" || !ranking) return kept;
    return [...kept].sort((a, b) => (a.ranking.position ?? 1e9) - (b.ranking.position ?? 1e9) || ranked.indexOf(a) - ranked.indexOf(b));
  }, [ranked, filter, order, ranking]);
  const objectives = ranking?.objectives ?? [];
  const selectedRecords = ranked.filter((r) => selected.includes(r.candidate.id));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_COMPARE ? s : [...s, id]));
  const scatter = objectives.length === 2 && ranking ? ranking.ordered.map((r) => ({ x: r.ranking.objectives[0]!.value!, y: r.ranking.objectives[1]!.value!, cls: r.ranking.paretoFront === 1 ? "marker" : "point", title: `${r.candidate.name}: ${objectives[0]!.label} ${fmt(r.ranking.objectives[0]!.value!)}, ${objectives[1]!.label} ${fmt(r.ranking.objectives[1]!.value!)}${r.ranking.paretoFront === 1 ? " · Pareto front" : ""}` })) : [];
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
          <div className="custom-element">
            <div className="seg" role="radiogroup" aria-label="Show candidates" id="cand-filter">
              {FILTERS.map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={filter === id} className={`seg-item ${filter === id ? "active" : ""}`} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="seg" role="radiogroup" aria-label="Order" id="cand-order">
              <button type="button" role="radio" aria-checked={order === "ranking"} className={`seg-item ${order === "ranking" ? "active" : ""}`} onClick={() => setOrder("ranking")}>
                by ranking
              </button>
              <button type="button" role="radio" aria-checked={order === "generation"} className={`seg-item ${order === "generation" ? "active" : ""}`} onClick={() => setOrder("generation")}>
                generation order
              </button>
            </div>
          </div>
          {ranking && (
            <section className="tradeoffs" id="tradeoffs">
              <h3 className="prediction-group-title">Ranking and trade-offs</h3>
              {ranking.notes.map((n, i) => (
                <p key={i} className="hint">
                  {n}
                </p>
              ))}
              {objectives.length > 0 && (
                <table className="solvent-table">
                  <thead>
                    <tr>
                      <th>objective</th>
                      <th>direction</th>
                      <th className="mono">range</th>
                      <th>best candidate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objectives.map((o) => (
                      <tr key={o.preferenceId}>
                        <td>
                          {o.label}
                          {o.unit ? ` (${o.unit})` : ""}
                        </td>
                        <td>{o.direction === "maximize" ? "higher is better" : o.direction === "minimize" ? "lower is better" : "close to target"}</td>
                        <td className="mono">{o.min === null || o.max === null ? "—" : `${fmt(o.min)} – ${fmt(o.max)}`}</td>
                        <td>{o.best ? `${o.best.name} (${fmt(o.best.value)})` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {ranking.front.length > 0 && (
                <p className="hint" id="pareto-front">
                  Pareto front ({ranking.front.length} of {ranking.population} ranked): {ranking.front.map((r) => r.candidate.name).join("; ")}.{" "}
                  <button
                    type="button"
                    className="link-btn"
                    id="btn-compare-front"
                    onClick={() => {
                      setSelected(ranking.front.slice(0, MAX_COMPARE).map((r) => r.candidate.id));
                      setComparing(true);
                    }}
                  >
                    Compare the front
                  </button>
                </p>
              )}
              {scatter.length > 1 && (
                <XyChart
                  ariaLabel={`${objectives[0]!.label} against ${objectives[1]!.label} for the ranked candidates; filled points are the Pareto front`}
                  xLabel={`${objectives[0]!.label}${objectives[0]!.unit ? ` (${objectives[0]!.unit})` : ""}`}
                  yLabel={objectives[1]!.label}
                  xDomain={[objectives[0]!.min!, objectives[0]!.max === objectives[0]!.min ? objectives[0]!.min! + 1 : objectives[0]!.max!]}
                  yDomain={[objectives[1]!.min!, objectives[1]!.max === objectives[1]!.min ? objectives[1]!.min! + 1 : objectives[1]!.max!]}
                  series={[]}
                  points={scatter}
                  xFormat={(v) => fmt(v)}
                  yFormat={(v) => fmt(v)}
                  hoverText={(xv, yv) => [`${fmt(xv)} · ${fmt(yv)}`]}
                />
              )}
            </section>
          )}
          <div className="button-row">
            <button type="button" className="btn btn-small" id="btn-compare" disabled={selectedRecords.length < 2} onClick={() => setComparing(true)} title={`Compare the ticked candidates side by side (up to ${MAX_COMPARE})`}>
              Compare selected ({selectedRecords.length})
            </button>
            {selected.length > 0 && (
              <button type="button" className="btn btn-small" onClick={() => setSelected([])}>
                Clear selection
              </button>
            )}
          </div>
          {comparing && selectedRecords.length > 0 && <ComparisonPanel records={selectedRecords} spec={spec} engine={engine} onOpen={onOpenCandidate} onClose={() => setComparing(false)} />}
          <table className="solvent-table candidate-table">
            <thead>
              <tr>
                <th />
                <th>#</th>
                <th>candidate</th>
                <th>verdict</th>
                {objectives.length > 0 && <th>rank</th>}
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
                    <td>
                      <input type="checkbox" className="compare-pick" aria-label={`Select ${r.candidate.name} for comparison`} checked={selected.includes(r.candidate.id)} onChange={() => toggle(r.candidate.id)} disabled={r.status === "rejected"} />
                    </td>
                    <td className="mono">{i + 1}</td>
                    <td>
                      {r.candidate.name}
                      {r.canonicalSmiles && <div className="mono muted small">{r.canonicalSmiles}</div>}
                      <div className="muted small">{r.candidate.origin.operations.join("; ")}</div>
                    </td>
                    {objectives.length > 0 && (
                      <td className="rank-cell" title={r.ranking.eligible ? r.ranking.objectives.map((o) => `${PROPERTY_BY_KEY.get(o.property)?.label ?? o.property}: ${o.value === null ? "—" : fmt(o.value)} → ${o.score === null ? "—" : (o.score * 100).toFixed(0) + " %"}`).join("\n") : (r.ranking.reason ?? "")}>
                        {r.ranking.eligible ? (
                          <>
                            <span className={`rank-badge ${r.ranking.paretoFront === 1 ? "front" : ""}`}>{r.ranking.paretoFront === 1 ? "★ front" : `front ${r.ranking.paretoFront}`}</span>
                            <div className="score-bar" aria-label={`weighted score ${((r.ranking.weighted ?? 0) * 100).toFixed(0)} %`}>
                              <i style={{ width: `${((r.ranking.weighted ?? 0) * 100).toFixed(0)}%` }} />
                            </div>
                            <span className="mono small">#{r.ranking.position} · {((r.ranking.weighted ?? 0) * 100).toFixed(0)} %</span>
                          </>
                        ) : (
                          <span className="muted small">{r.ranking.reason}</span>
                        )}
                      </td>
                    )}
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
                      <td colSpan={5 + columns.length + (objectives.length > 0 ? 1 : 0)}>
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
          <p className="hint">Pipeline: generate → validate (structural scope, graph, RDKit sanitisation, duplicates, SMARTS) → evaluate every valid candidate with the same descriptors and models as the Chemistry tab (c = computed, p = predicted; hover a value for its method and error) → apply the hard constraints. A miss within the model error is borderline, a missing value leaves the candidate undecided. Ranking: each soft preference is an objective scored 0–100 % over the ranked population; ★ marks the Pareto front (no other candidate is better on every objective), the bar is the weighted score with your weights; only passing or borderline candidates with every preferred property available are ranked.</p>
        </>
      )}
    </section>
  );
}
