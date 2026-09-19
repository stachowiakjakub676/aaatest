import { useEffect, useMemo, useState } from "react";
import { buildComparison, comparisonToCsv } from "@molecular-cad/design-engine";
import type { CheckStatus, RankedRecord, Specification } from "@molecular-cad/design-engine";
import type { ChemistryEngine } from "../../chemistry/engine";
import { EMPTY_SELECTION } from "../../state/selection";
import { Viewport } from "../../viewer/Viewport";

export interface ComparisonPanelProps {
  records: RankedRecord[];
  spec: Specification;
  /** Engine used for 2D depictions (the in-browser one). */
  engine: ChemistryEngine;
  onOpen(record: RankedRecord): void;
  onClose(): void;
}

const VERDICT: Record<CheckStatus, { label: string; cls: string }> = { pass: { label: "✓ pass", cls: "ok" }, fail: { label: "✗ fail", cls: "err" }, borderline: { label: "△ borderline", cls: "warn" }, unknown: { label: "? undecided", cls: "warn" } };
const noop = () => {};

function Depiction({ engine, record }: { engine: ChemistryEngine; record: RankedRecord }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!engine.capabilities.depict) return;
    engine
      .depict(record.candidate.molecule, { width: 200, height: 130 })
      .then((s) => !cancelled && setSvg(s))
      .catch(() => !cancelled && setSvg(null));
    return () => {
      cancelled = true;
    };
  }, [engine, record]);
  return svg ? <div className="structure-svg" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="structure-svg muted small">no depiction</div>;
}

/** Side-by-side comparison of selected candidates: structures (2D and 3D), verdicts, every available property with provenance. */
export function ComparisonPanel({ records, spec, engine, onOpen, onClose }: ComparisonPanelProps) {
  const cmp = useMemo(() => buildComparison(records, spec), [records, spec]);
  const [show3d, setShow3d] = useState(true);
  const groups = useMemo(() => {
    const out: Array<[string, typeof cmp.rows]> = [];
    for (const r of cmp.rows) {
      const g = out.find(([name]) => name === r.group);
      if (g) g[1].push(r);
      else out.push([r.group, [r]]);
    }
    return out;
  }, [cmp]);
  const copyCsv = () => {
    const text = comparisonToCsv(cmp);
    void navigator.clipboard?.writeText(text).catch(() => {});
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clapeyron-comparison.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="panel-section" id="comparison">
      <h2 className="panel-title">
        Comparison <span className="muted small">{records.length} candidates</span>
      </h2>
      <div className="button-row">
        <label className="check">
          <input type="checkbox" checked={show3d} onChange={(e) => setShow3d(e.target.checked)} /> 3D structures
        </label>
        <button type="button" className="btn btn-small" id="btn-compare-csv" onClick={copyCsv} title="Download the matrix as CSV (also copied to the clipboard)">
          Export CSV
        </button>
        <button type="button" className="btn btn-small" onClick={onClose}>
          Close comparison
        </button>
      </div>
      <div className="compare-scroll">
        <table className="solvent-table compare-table">
          <thead>
            <tr>
              <th className="compare-label" />
              {records.map((r, i) => (
                <th key={r.candidate.id} className="compare-col">
                  <div className="compare-name">{r.candidate.name}</div>
                  {cmp.columns[i]!.canonicalSmiles && <div className="mono muted small">{cmp.columns[i]!.canonicalSmiles}</div>}
                  <div className="muted small">{cmp.columns[i]!.origin}</div>
                  <Depiction engine={engine} record={r} />
                  {show3d && (
                    <div className="compare-3d">
                      <Viewport molecule={r.candidate.molecule} selection={EMPTY_SELECTION} showLabels={false} mode="select" pendingAtomId={null} additiveMode={false} onTap={noop} onDragAtom={noop} />
                    </div>
                  )}
                  <div>
                    {cmp.columns[i]!.verdict ? <span className={`status ${VERDICT[cmp.columns[i]!.verdict!].cls}`}>{VERDICT[cmp.columns[i]!.verdict!].label}</span> : <span className="status err">rejected</span>}
                    {r.ranking.eligible && <span className={`rank-badge ${r.ranking.paretoFront === 1 ? "front" : ""}`}>{r.ranking.paretoFront === 1 ? "★ front" : `front ${r.ranking.paretoFront}`} · #{r.ranking.position}</span>}
                  </div>
                  <button type="button" className="btn btn-small" onClick={() => onOpen(r)}>
                    Open in editor
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([group, rows]) => [
              <tr key={`g:${group}`} className="compare-group">
                <td colSpan={records.length + 1}>{group}</td>
              </tr>,
              ...rows.map((row) => (
                <tr key={row.id}>
                  <td className="compare-label">
                    {row.label}
                    {row.unit ? <span className="muted"> ({row.unit})</span> : null}
                  </td>
                  {row.cells.map((c, i) => (
                    <td key={i} className={`mono ${c.best ? "compare-best" : ""} ${c.status ? `check-${c.status}` : ""}`} title={c.method ? `${c.method}${c.uncertainty ? ` · ${c.uncertainty}` : ""}` : ""}>
                      {c.text}
                      {c.kind && <span className={`tag tag-${c.kind === "computed" ? "computed" : "predicted"}`}>{c.kind[0]}</span>}
                    </td>
                  ))}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
      <p className="hint">Every value carries its provenance (c = computed, p = predicted; hover for the method and error). A highlighted cell is the best in its row only where a soft preference says which direction is better; other rows are shown without judgement. Rotate the 3D structures with the mouse.</p>
    </section>
  );
}
