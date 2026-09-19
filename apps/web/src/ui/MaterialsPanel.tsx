import { useMemo, useState } from "react";
import { CHEM21_ORDER, SOLVENTS, girolamiDensity, greenerAlternatives, hansenParameters, molecularWeight, rankSolvents } from "@molecular-cad/molecule-model";
import type { Chem21Class, Molecule } from "@molecular-cad/molecule-model";

export interface MaterialsPanelProps {
  molecule: Molecule;
  molarMass: number | undefined;
}

const r1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const CLASS_LABEL: Record<Chem21Class, string> = { recommended: "recommended", problematic: "problematic", hazardous: "hazardous", "highly hazardous": "highly hazardous" };

function ClassChip({ c }: { c: Chem21Class }) {
  return <span className={`class-chip class-${CHEM21_ORDER[c]}`}>{CLASS_LABEL[c]}</span>;
}

function similarity(ra: number): string {
  return ra < 5 ? "similar" : ra < 10 ? "moderate" : "dissimilar";
}

export function MaterialsPanel({ molecule, molarMass }: MaterialsPanelProps) {
  const [maxClass, setMaxClass] = useState<Chem21Class>("hazardous");
  const [showAll, setShowAll] = useState(false);
  const [replace, setReplace] = useState("dcm");
  const [replaceMax, setReplaceMax] = useState<Chem21Class>("problematic");
  const heavy = molecule.atoms.filter((a) => a.element !== "H").length;

  const hansen = useMemo(() => {
    if (heavy === 0) return null;
    const mw = molarMass ?? molecularWeight(molecule, { includeImplicitHydrogens: true }).value;
    if (mw === undefined) return null;
    const dens = girolamiDensity(molecule, mw);
    if (!dens) return null;
    return hansenParameters(molecule, mw / dens.density);
  }, [molecule, molarMass, heavy]);

  const matches = useMemo(() => (hansen ? rankSolvents(hansen).filter((m) => CHEM21_ORDER[m.solvent.chem21] <= CHEM21_ORDER[maxClass]) : []), [hansen, maxClass]);
  const alternatives = useMemo(() => greenerAlternatives(replace, replaceMax), [replace, replaceMax]);
  const replaced = SOLVENTS.find((s) => s.id === replace);

  return (
    <>
      <section className="panel-section" id="hansen">
        <h2 className="panel-title">
          Hansen solubility parameters <span className="tag tag-predicted">predicted</span>
        </h2>
        {heavy === 0 && <p className="hint">Add atoms to estimate Hansen parameters.</p>}
        {heavy > 0 && !hansen && <p className="hint">Not available: the Hoftyzer–Van Krevelen table has no group for part of this structure (hetero-aromatic or fused rings, alkynes, sulfur groups, iodine…). The method refuses rather than guess.</p>}
        {hansen && (
          <>
            <div className="hansen-grid">
              <div>
                <span className="row-label">δd dispersion</span>
                <strong className="mono">{r1(hansen.dd)}</strong>
              </div>
              <div>
                <span className="row-label">δp polar</span>
                <strong className="mono">{r1(hansen.dp)}</strong>
              </div>
              <div>
                <span className="row-label">δh H-bond</span>
                <strong className="mono">{r1(hansen.dh)}</strong>
              </div>
              <div>
                <span className="row-label">δt total</span>
                <strong className="mono">{r1(hansen.dt)}</strong>
              </div>
            </div>
            <p className="hint">MPa½, at 25 °C. Molar volume {r1(hansen.molarVolume)} cm³/mol from the Girolami density.</p>
            <details className="prediction-details">
              <summary>Group breakdown</summary>
              <table className="breakdown">
                <thead>
                  <tr>
                    <th>group</th>
                    <th className="mono">n</th>
                    <th className="mono">Fd</th>
                    <th className="mono">Fp</th>
                    <th className="mono">Eh</th>
                  </tr>
                </thead>
                <tbody>
                  {hansen.groups.map((g, i) => (
                    <tr key={g.groupId}>
                      <td>{g.label}</td>
                      <td className="mono">×{g.count}</td>
                      <td className="mono">{hansen.contributions[i]!.fd.toFixed(0)}</td>
                      <td className="mono">{hansen.contributions[i]!.fp.toFixed(0)}</td>
                      <td className="mono">{hansen.contributions[i]!.eh.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">δd = ΣFd / V, δp = √(ΣFp²) / V, δh = √(ΣEh / V). Fd, Fp in (J·cm³)½/mol, Eh in J/mol.</p>
              {hansen.notes.length > 0 && (
                <ul className="reasoning">
                  {hansen.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </details>
            <p className="hint">Hoftyzer–Van Krevelen group contributions (Properties of Polymers, 2009). Typical error 1–2 MPa½ per component; δh is the least reliable.</p>
          </>
        )}
      </section>

      {hansen && (
        <section className="panel-section" id="solvent-match">
          <h2 className="panel-title">Solvent match</h2>
          <label className="field">
            <span className="field-label">Show solvents up to class</span>
            <select id="match-class" className="select" value={maxClass} onChange={(e) => setMaxClass(e.target.value as Chem21Class)}>
              {(Object.keys(CHEM21_ORDER) as Chem21Class[]).map((c) => (
                <option key={c} value={c}>
                  {CLASS_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <table className="solvent-table">
            <thead>
              <tr>
                <th>solvent</th>
                <th className="mono">Ra</th>
                <th className="mono">bp °C</th>
                <th>CHEM21</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? matches : matches.slice(0, 10)).map((m) => (
                <tr key={m.solvent.id} title={m.solvent.note ? `${m.solvent.name}: ${m.solvent.note}` : m.solvent.name}>
                  <td>{m.solvent.name}</td>
                  <td className="mono">
                    {r1(m.ra)} <span className="muted">{similarity(m.ra)}</span>
                  </td>
                  <td className="mono">{m.solvent.bp}</td>
                  <td>
                    <ClassChip c={m.solvent.chem21} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {matches.length > 10 && (
            <button type="button" className="btn btn-small" id="btn-more-solvents" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${matches.length}`}
            </button>
          )}
          <p className="hint">Ra = √(4Δδd² + Δδp² + Δδh²), the Hansen distance between the molecule and each solvent. Small Ra (below ~5) means similar cohesion energy and likely miscibility or dissolution; above ~10 the solvent is a poor match. The molecule's own interaction radius R0 is unknown, so this is a ranking, not a yes/no. Solvent parameters: Hansen (2007); classes: CHEM21 guide (Prat et al., Green Chem. 2016).</p>
        </section>
      )}

      <section className="panel-section" id="greener">
        <h2 className="panel-title">Greener replacement for a solvent</h2>
        <div className="custom-element">
          <select id="replace-solvent" className="select" value={replace} onChange={(e) => setReplace(e.target.value)} aria-label="Solvent to replace">
            {[...SOLVENTS].sort((a, b) => CHEM21_ORDER[b.chem21] - CHEM21_ORDER[a.chem21] || a.name.localeCompare(b.name)).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({CLASS_LABEL[s.chem21]})
              </option>
            ))}
          </select>
          <select id="replace-class" className="select" value={replaceMax} onChange={(e) => setReplaceMax(e.target.value as Chem21Class)} aria-label="Accept substitutes up to class">
            <option value="recommended">recommended only</option>
            <option value="problematic">up to problematic</option>
          </select>
        </div>
        {replaced && (
          <p className="hint">
            {replaced.name}: δd {replaced.dd}, δp {replaced.dp}, δh {replaced.dh} MPa½, bp {replaced.bp} °C, <ClassChip c={replaced.chem21} />
            {replaced.note ? ` (${replaced.note})` : ""}.
          </p>
        )}
        <table className="solvent-table alternatives">
          <thead>
            <tr>
              <th>substitute</th>
              <th className="mono">Ra</th>
              <th className="mono">bp °C</th>
              <th>CHEM21</th>
            </tr>
          </thead>
          <tbody>
            {alternatives.slice(0, 8).map((m) => (
              <tr key={m.solvent.id} title={m.solvent.note ? `${m.solvent.name}: ${m.solvent.note}` : m.solvent.name}>
                <td>{m.solvent.name}</td>
                <td className="mono">
                  {r1(m.ra)} <span className="muted">{similarity(m.ra)}</span>
                </td>
                <td className="mono">{m.solvent.bp}</td>
                <td>
                  <ClassChip c={m.solvent.chem21} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Substitutes sorted by Hansen distance to the solvent being replaced: similar cohesion energy is a starting point, not a guarantee of equal performance (reaction rate, selectivity, crystal form, work-up). The boiling point tells you whether it can play the same role. Always check the current safety data sheet.</p>
      </section>
    </>
  );
}
