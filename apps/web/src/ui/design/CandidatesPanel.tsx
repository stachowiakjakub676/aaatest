import { useState } from "react";
import { GENERATORS, hasErrors, serializeRun } from "@molecular-cad/design-engine";
import type { CandidateRecord, GeneratorParams, Specification, SpecificationIssue } from "@molecular-cad/design-engine";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { DesignRunApi } from "../../design/useDesignRun";

export interface CandidatesPanelProps {
  api: DesignRunApi;
  spec: Specification;
  issues: SpecificationIssue[];
  seed: Molecule;
  onOpenCandidate(record: CandidateRecord): void;
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
  const [showRejected, setShowRejected] = useState(true);
  const generator = GENERATORS.find((g) => g.id === generatorId)!;
  const broken = hasErrors(issues);
  const seedEmpty = seed.atoms.length === 0;
  const needsSeed = generatorId === "derivatives";
  const run = api.run;
  const shown = run ? run.records.filter((r) => showRejected || r.status !== "rejected") : [];

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
          {api.progress.stage === "generating" ? "Generating" : "Validating"} {api.progress.done} / {api.progress.total || "…"}
        </p>
      )}
      {api.error && <p className="hint error-text">{api.error}</p>}
      {run && (
        <>
          <div className="row">
            <span className="row-label">Run {run.id}</span>
            <span className="row-value" id="run-summary">
              <span className="status-chip ok">{run.summary.valid} valid</span> <span className="status-chip err">{run.summary.rejected} rejected</span> <span className="muted">of {run.summary.generated}</span>
            </span>
          </div>
          <p className="hint">
            {run.generator.label}
            {run.seed ? ` on ${run.seed.name} (${run.seed.atoms} atoms)` : ""} · {run.provenance.engine} · {run.createdAt.replace("T", " ").slice(0, 19)} · rejections: {Object.entries(run.rejectionsByStage).filter(([, n]) => n > 0).map(([s, n]) => `${s} ${n}`).join(", ") || "none"}
          </p>
          <label className="check">
            <input type="checkbox" id="show-rejected" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} /> show rejected candidates
          </label>
          <table className="solvent-table candidate-table">
            <thead>
              <tr>
                <th>#</th>
                <th>candidate</th>
                <th>how it was made</th>
                <th>status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.candidate.id} className={`cand-${r.status}`} title={r.canonicalSmiles ?? ""}>
                  <td className="mono">{i + 1}</td>
                  <td>
                    {r.candidate.name}
                    {r.canonicalSmiles && <div className="mono muted small">{r.canonicalSmiles}</div>}
                  </td>
                  <td className="muted small">{r.candidate.origin.operations.join("; ")}</td>
                  <td>{r.status === "valid" ? <span className="status ok">valid</span> : <span className="status err">rejected: {r.rejection?.stage} — {r.rejection?.reason}</span>}</td>
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => onOpenCandidate(r)} title="Open this candidate in a new editor tab">
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">Validation: structural scope → graph (valence, connectivity) → RDKit sanitisation → duplicates by canonical SMILES → required/forbidden SMARTS. Property evaluation and filtering against the hard constraints follow in phase 3C; nothing here ranks candidates.</p>
        </>
      )}
    </section>
  );
}
