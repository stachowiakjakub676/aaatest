import { useEffect, useMemo, useState } from "react";
import { PRESSURE_UNITS, SOLVENTS, acentricFactor, boilingPointAtPressure, girolamiDensity, jobackEstimates, molecularWeight, phaseAt, phaseModel, vapourPressure, watsonHvap } from "@molecular-cad/molecule-model";
import type { Molecule, PhaseInputs } from "@molecular-cad/molecule-model";
import { PhaseDiagram } from "./PhaseDiagram";
import { MixtureSection } from "./MixtureSection";
import { solventComponent, targetComponent } from "../chemistry/components";
import type { ChemistryEngine } from "../chemistry/engine";
import type { UnifacFragmenter } from "../chemistry/components";

export interface PhasePanelProps {
  molecule: Molecule;
  /** Molar mass from the chemistry engine (falls back to the model's own weight). */
  molarMass: number | undefined;
  engine: ChemistryEngine;
  fragmenter: UnifacFragmenter;
  /** Canonical SMILES from the engine (null while unavailable). */
  canonicalSmiles: string | null;
}

/** Optional measured value: blank means "use the estimate". */
function parseOverride(text: string, toKelvin: boolean): number | null {
  const v = text.trim() === "" ? NaN : Number(text);
  return Number.isFinite(v) ? (toKelvin ? v + 273.15 : v) : null;
}

type Unit = keyof typeof PRESSURE_UNITS;
const UNITS = Object.keys(PRESSURE_UNITS) as Unit[];
const PRESETS: Array<[string, number, Unit]> = [
  ["1 atm", 1013.25, "mbar"],
  ["100 mbar", 100, "mbar"],
  ["20 mbar (rotavap)", 20, "mbar"],
  ["1 mbar", 1, "mbar"],
];

const r1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

function fmtP(bar: number): string {
  if (bar >= 1) return `${bar.toFixed(bar >= 10 ? 1 : 2)} bar`;
  if (bar >= 1e-3) return `${(bar * 1000).toFixed(1)} mbar`;
  if (bar >= 1e-6) return `${(bar * 1e6).toFixed(1)} µbar`;
  return `${(bar * 1000).toExponential(2)} mbar`;
}

function Row({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="row" title={title}>
      <span className="row-label">{label}</span>
      <span className="row-value mono">{value}</span>
    </div>
  );
}

export function PhasePanel({ molecule, molarMass, engine, fragmenter, canonicalSmiles }: PhasePanelProps) {
  const [pValue, setPValue] = useState("20");
  const [pUnit, setPUnit] = useState<Unit>("mbar");
  const [tValue, setTValue] = useState("25");
  const [tbText, setTbText] = useState("");
  const [tmText, setTmText] = useState("");
  const [hfusText, setHfusText] = useState("");
  const heavy = molecule.atoms.filter((a) => a.element !== "H").length;
  // The drawn molecule may be one of the tabulated solvents: then its measured boiling point is known.
  const [recognised, setRecognised] = useState<{ id: string; name: string; bp: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setRecognised(null);
    if (!canonicalSmiles) return;
    void Promise.all(SOLVENTS.map((s) => solventComponent(engine, fragmenter, s.id))).then((all) => {
      if (cancelled) return;
      const hit = all.find((s) => s && s.canonicalSmiles === canonicalSmiles);
      setRecognised(hit ? { id: hit.solvent.id, name: hit.solvent.name, bp: hit.solvent.bp } : null);
    });
    return () => {
      cancelled = true;
    };
  }, [engine, fragmenter, canonicalSmiles]);
  const overrides = useMemo(() => ({ tb: parseOverride(tbText, true) ?? (recognised ? recognised.bp + 273.15 : null), tm: parseOverride(tmText, true), hfus: parseOverride(hfusText, false) }), [tbText, tmText, hfusText, recognised]);

  const data = useMemo(() => {
    if (heavy === 0) return null;
    const j = jobackEstimates(molecule);
    if (j.tb === null || j.tc === null || j.pc === null || j.hvap === null) return { j, input: null, model: null, target: null };
    const mw = molarMass ?? molecularWeight(molecule, { includeImplicitHydrogens: true }).value;
    const dens = mw !== undefined ? girolamiDensity(molecule, mw) : null;
    const input: PhaseInputs = { tb: overrides.tb ?? j.tb, tc: j.tc, pc: j.pc, hvapTb: j.hvap, tm: overrides.tm ?? j.tm, hfus: overrides.hfus ?? j.hfus, molarVolume: dens && mw !== undefined ? mw / dens.density : null };
    const target = targetComponent(molecule, molecule.name ?? "drawn molecule", mw, overrides);
    return { j, input, model: phaseModel(input), target };
  }, [molecule, molarMass, heavy, overrides]);

  if (heavy === 0) {
    return (
      <section className="panel-section" id="phase">
        <h2 className="panel-title">
          Phase behaviour <span className="tag tag-predicted">predicted</span>
        </h2>
        <p className="hint">Add atoms to estimate the phase diagram.</p>
      </section>
    );
  }
  if (!data || !data.input || !data.model) {
    const els = data ? [...new Set(data.j.unassigned.map((id) => molecule.atoms.find((a) => a.id === id)?.element ?? "?"))] : [];
    return (
      <section className="panel-section" id="phase">
        <h2 className="panel-title">
          Phase behaviour <span className="tag tag-predicted">predicted</span>
        </h2>
        <p className="hint">Not available: the Joback table has no group for {els.join(", ") || "this bonding pattern"}, so there are no critical constants to build the diagram from. The method refuses rather than guess.</p>
      </section>
    );
  }
  const { input, model, target } = data;
  const omega = acentricFactor(input.tb, input.tc, input.pc);
  const measuredAny = overrides.tb !== null || overrides.tm !== null || overrides.hfus !== null;
  const pBar = (Number(pValue) || 0) * PRESSURE_UNITS[pUnit];
  const tK = (Number(tValue) || 0) + 273.15;
  const tAtP = pBar > 0 ? boilingPointAtPressure(pBar, input.tc, input.pc, omega) : null;
  const pAtT = vapourPressure(tK, input.tc, input.pc, omega);
  const hvapT = watsonHvap(tK, input.tb, input.tc, input.hvapTb);
  const phase = phaseAt(model, input, tK, pBar > 0 ? pBar : 1.01325);
  const hvap25 = watsonHvap(298.15, input.tb, input.tc, input.hvapTb);

  return (
    <>
      <section className="panel-section" id="phase">
        <h2 className="panel-title">
          Phase behaviour <span className="tag tag-predicted">predicted</span>
        </h2>
        <Row label="Normal boiling point" value={`${r1(input.tb - 273.15)} °C${overrides.tb !== null ? (tbText.trim() === "" && recognised ? ` (measured: recognised as ${recognised.name})` : " (measured)") : ""}`} title="Joback unless measured" />
        <Row label="Melting point" value={input.tm ? `${r1(input.tm - 273.15)} °C${overrides.tm !== null ? " (measured)" : ""}` : "not estimated"} title="Joback (least reliable property) unless measured" />
        <Row label="Critical point" value={`${r1(input.tc - 273.15)} °C, ${r1(input.pc)} bar`} title="Joback Tc and pc" />
        <Row label="Acentric factor ω" value={omega.toFixed(3)} title="Lee–Kesler, from Tb/Tc and pc" />
        {model.triple && <Row label="Triple point" value={`${r1(model.triple.T - 273.15)} °C, ${fmtP(model.triple.p)}`} />}
        <Row label="ΔHvap at Tb / 25 °C" value={`${r1(input.hvapTb)} / ${hvap25 === null ? "—" : r1(hvap25)} kJ/mol`} title="Joback at Tb; Watson scaling at 25 °C" />
        {model.hsub !== null && <Row label="ΔHsub at the triple point" value={`${r1(model.hsub)} kJ/mol`} title="ΔHfus + ΔHvap" />}
        <p className="hint">Joback group contributions for Tb, Tm, Tc, pc, ΔHvap and ΔHfus; Lee–Kesler correlation for the vapour curve; Clausius–Clapeyron for the solid boundaries. Estimates, not measurements: 10 K of error in Tb is a factor 1.5–2 in pressure.</p>
        <details className="prediction-details" open={measuredAny}>
          <summary>Measured values (optional)</summary>
          <div className="custom-element">
            <label className="field">
              <span className="field-label">Tb, °C</span>
              <input id="meas-tb" className="input mono" inputMode="decimal" value={tbText} onChange={(e) => setTbText(e.target.value)} placeholder={r1(data.j.tb! - 273.15)} />
            </label>
            <label className="field">
              <span className="field-label">Tm, °C</span>
              <input id="meas-tm" className="input mono" inputMode="decimal" value={tmText} onChange={(e) => setTmText(e.target.value)} placeholder={data.j.tm === null ? "—" : r1(data.j.tm - 273.15)} />
            </label>
            <label className="field">
              <span className="field-label">ΔHfus, kJ/mol</span>
              <input id="meas-hfus" className="input mono" inputMode="decimal" value={hfusText} onChange={(e) => setHfusText(e.target.value)} placeholder={data.j.hfus === null ? "—" : r1(data.j.hfus)} />
            </label>
          </div>
          <p className="hint">If you know a value from a data sheet, enter it: the vapour curve is then anchored at the measured boiling point (ω is recomputed) and the solid boundaries and crystallisation use the measured Tm and ΔHfus. Blank fields keep the estimates{recognised ? `, except that the boiling point of ${recognised.name} is taken from the solvent table` : ""}.</p>
        </details>
      </section>

      <section className="panel-section" id="vacuum">
        <h2 className="panel-title">Boiling point at a chosen pressure</h2>
        <div className="custom-element">
          <input id="vac-pressure" className="input mono" inputMode="decimal" value={pValue} onChange={(e) => setPValue(e.target.value)} aria-label="Pressure" />
          <select id="vac-unit" className="select" value={pUnit} onChange={(e) => setPUnit(e.target.value as Unit)} aria-label="Pressure unit">
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="chips" role="group" aria-label="Pressure presets">
          {PRESETS.map(([label, v, u]) => (
            <button
              key={label}
              type="button"
              className="chip"
              onClick={() => {
                setPValue(String(v));
                setPUnit(u);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="row">
          <span className="row-label">Boils at</span>
          <span className="row-value mono" id="vac-result">
            {pBar <= 0 ? "enter a pressure" : tAtP === null ? `no boiling above pc (${r1(input.pc)} bar)` : `${r1(tAtP - 273.15)} °C (${r1(tAtP)} K)`}
          </span>
        </div>
        {tAtP !== null && pBar > 0 && <p className="hint">{pBar < 1.01325 ? `Lowering the pressure from 1 atm to ${fmtP(pBar)} drops the boiling point by about ${r1(input.tb - tAtP)} K.` : `Raising the pressure to ${fmtP(pBar)} lifts the boiling point by about ${r1(tAtP - input.tb)} K.`} Typical rotary-evaporator range: 10–100 mbar; a bath 20 K above this temperature keeps evaporation going.</p>}
      </section>

      <section className="panel-section" id="conditions">
        <h2 className="panel-title">State at given conditions</h2>
        <label className="field">
          <span className="field-label">Temperature, °C (pressure as above)</span>
          <input id="cond-temperature" className="input mono" inputMode="decimal" value={tValue} onChange={(e) => setTValue(e.target.value)} />
        </label>
        <Row label="Phase" value={<span id="cond-phase">{phase}</span>} />
        <Row label="Vapour pressure at T" value={pAtT === null ? (tK >= input.tc ? "above Tc: no liquid–vapour boundary" : "—") : fmtP(pAtT)} />
        <Row label="ΔHvap at T" value={hvapT === null ? "—" : `${r1(hvapT)} kJ/mol`} />
        <PhaseDiagram model={model} input={input} marker={{ T: tK, p: pBar > 0 ? pBar : 1.01325 }} markerLabel="you" />
        {model.notes.length > 0 && (
          <ul className="reasoning">
            {model.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        <p className="hint">Hover the diagram to read the phase at any point. Melting line: Clapeyron slope with ΔVfus ≈ 10 % of the molar volume; the sublimation line uses ΔHsub = ΔHfus + ΔHvap at the triple point.</p>
      </section>
      <MixtureSection engine={engine} fragmenter={fragmenter} molecule={molecule} target={target} targetId={recognised?.id ?? null} />
    </>
  );
}
