import { useMemo } from "react";
import { PROPERTY_BY_KEY, describePreference, describeStructural, evaluateSpecification, hasErrors } from "@molecular-cad/design-engine";
import type { CandidateRecord, CheckStatus, PropertyValue } from "@molecular-cad/design-engine";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { ChemistryState } from "../../chemistry/useChemistry";
import type { ChemistryEngine } from "../../chemistry/engine";
import { profileFromChemistry } from "../../design/profile";
import type { SpecificationApi } from "../../design/useSpecification";
import type { DesignRunApi } from "../../design/useDesignRun";
import { SpecificationBuilder } from "./SpecificationBuilder";
import { CandidatesPanel } from "./CandidatesPanel";

export interface DesignViewProps {
  api: SpecificationApi;
  runApi: DesignRunApi;
  molecule: Molecule;
  chemistry: ChemistryState;
  /** In-browser engine for depictions. */
  engine: ChemistryEngine;
  onOpenEditor(): void;
  onOpenCandidate(record: CandidateRecord): void;
}

const STATUS_LABEL: Record<CheckStatus, string> = { pass: "✓ pass", fail: "✗ fail", borderline: "△ borderline", unknown: "? unknown" };

function fmt(v: number | string): string {
  return typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1)) : v;
}

function Actual({ value }: { value: PropertyValue | null }) {
  if (!value) return <span className="muted">not available</span>;
  const def = PROPERTY_BY_KEY.get(value.key);
  return (
    <span title={`${value.method}${value.uncertainty ? ` · ${value.uncertainty}` : ""}`}>
      <span className="mono">
        {fmt(value.value)}
        {def?.unit ? ` ${def.unit}` : ""}
      </span>{" "}
      <span className={`tag tag-${value.kind === "computed" ? "computed" : "predicted"}`}>{value.kind}</span>
    </span>
  );
}

/**
 * Design workspace (stage 3): the specification builder on the left, a requirement sheet and a
 * live check of the molecule open in the editor on the right. Candidate generation, filtering
 * and comparison plug into the same evaluation in later phases.
 */
export function DesignView({ api, runApi, molecule, chemistry, engine, onOpenEditor, onOpenCandidate }: DesignViewProps) {
  const { spec, issues } = api;
  const profile = useMemo(() => profileFromChemistry(molecule, chemistry), [molecule, chemistry]);
  const hasAtoms = molecule.atoms.length > 0;
  const result = useMemo(() => evaluateSpecification(spec, profile, hasAtoms ? molecule : null), [spec, profile, molecule, hasAtoms]);
  const structuralLines = describeStructural(spec.structural);
  const broken = hasErrors(issues);

  return (
    <section className="design-view" aria-label="Design workspace">
      <SpecificationBuilder api={api} />
      <div className="design-main">
        <section className="panel-section">
          <h2 className="panel-title">Requirement sheet</h2>
          <p className="design-title">{spec.name || "Untitled specification"}</p>
          {spec.description && <p className="hint">{spec.description}</p>}
          <h3 className="prediction-group-title">Must</h3>
          {spec.hard.length === 0 && structuralLines.length === 0 && <p className="hint">No hard constraints yet.</p>}
          <ul className="reasoning" id="sheet-hard">
            {result.constraints.map((r) => (
              <li key={r.constraintId}>{r.requirement}</li>
            ))}
            {structuralLines.map((l, i) => (
              <li key={`s${i}`}>{l}</li>
            ))}
          </ul>
          <h3 className="prediction-group-title">Prefer</h3>
          {spec.soft.length === 0 && <p className="hint">No soft preferences.</p>}
          <ul className="reasoning" id="sheet-soft">
            {spec.soft.map((p) => (
              <li key={p.id}>{describePreference(p)}</li>
            ))}
          </ul>
          <p className="hint">{broken ? "Fix the validation errors before this specification can drive a design run." : "This specification can drive a design run (candidate generation arrives in phase 3B)."}</p>
        </section>

        <section className="panel-section" id="spec-preview">
          <h2 className="panel-title">
            Check: molecule in the editor
            <span className="tag tag-predicted">preview</span>
          </h2>
          {!hasAtoms && <p className="hint">Open or draw a molecule in the editor to check it against the specification.</p>}
          {hasAtoms && (
            <>
              <div className="row">
                <span className="row-label">{molecule.name ?? molecule.id}</span>
                <span className="row-value">
                  <span className={`status-chip ${result.overall === "pass" ? "ok" : result.overall === "fail" ? "err" : "warn"}`} id="preview-overall">
                    {STATUS_LABEL[result.overall]}
                  </span>{" "}
                  <span className="muted">
                    {result.counts.pass} pass · {result.counts.fail} fail · {result.counts.borderline} borderline · {result.counts.unknown} unknown
                  </span>
                </span>
              </div>
              {chemistry.computing && <p className="hint">Computing properties…</p>}
              <table className="solvent-table check-table">
                <thead>
                  <tr>
                    <th>requirement</th>
                    <th>actual</th>
                    <th>status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.constraints.map((r) => (
                    <tr key={r.constraintId} className={`check-${r.status}`} title={r.reason}>
                      <td>{r.requirement}</td>
                      <td>
                        <Actual value={r.actual} />
                      </td>
                      <td className="mono">{STATUS_LABEL[r.status]}</td>
                    </tr>
                  ))}
                  {result.structural.map((r, i) => (
                    <tr key={`st${i}`} className={`check-${r.status}`} title={r.reason}>
                      <td>{r.rule}</td>
                      <td className="muted">{r.reason}</td>
                      <td className="mono">{STATUS_LABEL[r.status]}</td>
                    </tr>
                  ))}
                  {result.constraints.length + result.structural.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        Nothing to check yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {spec.soft.length > 0 && (
                <>
                  <h3 className="prediction-group-title">Preferences (values only; ranking in phase 3D)</h3>
                  <table className="solvent-table check-table">
                    <tbody>
                      {spec.soft.map((p) => (
                        <tr key={p.id}>
                          <td>{describePreference(p)}</td>
                          <td>
                            <Actual value={profile[p.property] ?? null} />
                          </td>
                          <td />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <p className="hint">Hover a row for the reason. A miss smaller than the model's typical error is marked borderline rather than failed. Substructure rules are checked on generated candidates below.</p>
              <button type="button" className="btn btn-small" id="btn-open-editor" onClick={onOpenEditor}>
                Back to the editor
              </button>
            </>
          )}
        </section>
        <CandidatesPanel api={runApi} spec={spec} issues={issues} seed={molecule} engine={engine} onOpenCandidate={onOpenCandidate} />
      </div>
    </section>
  );
}
