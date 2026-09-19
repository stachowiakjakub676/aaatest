import { useMemo, useState } from "react";
import { PRESSURE_UNITS, acentricFactor, boilingPointAtPressure, girolamiDensity, jobackEstimates, molecularWeight, phaseAt, phaseModel, vapourPressure, watsonHvap } from "@molecular-cad/molecule-model";
import type { Molecule, PhaseInputs } from "@molecular-cad/molecule-model";
import { PhaseDiagram } from "./PhaseDiagram";

export interface PhasePanelProps {
  molecule: Molecule;
  /** Molar mass from the chemistry engine (falls back to the model's own weight). */
  molarMass: number | undefined;
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

export function PhasePanel({ molecule, molarMass }: PhasePanelProps) {
  const [pValue, setPValue] = useState("20");
  const [pUnit, setPUnit] = useState<Unit>("mbar");
  const [tValue, setTValue] = useState("25");
  const heavy = molecule.atoms.filter((a) => a.element !== "H").length;

  const data = useMemo(() => {
    if (heavy === 0) return null;
    const j = jobackEstimates(molecule);
    if (j.tb === null || j.tc === null || j.pc === null || j.hvap === null) return { j, input: null, model: null };
    const mw = molarMass ?? molecularWeight(molecule, { includeImplicitHydrogens: true }).value;
    const dens = mw !== undefined ? girolamiDensity(molecule, mw) : null;
    const input: PhaseInputs = { tb: j.tb, tc: j.tc, pc: j.pc, hvapTb: j.hvap, tm: j.tm, hfus: j.hfus, molarVolume: dens && mw !== undefined ? mw / dens.density : null };
    return { j, input, model: phaseModel(input) };
  }, [molecule, molarMass, heavy]);

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
  const { input, model } = data;
  const omega = acentricFactor(input.tb, input.tc, input.pc);
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
        <Row label="Normal boiling point" value={`${r1(input.tb - 273.15)} °C`} title="Joback" />
        <Row label="Melting point" value={input.tm ? `${r1(input.tm - 273.15)} °C` : "not estimated"} title="Joback (least reliable property)" />
        <Row label="Critical point" value={`${r1(input.tc - 273.15)} °C, ${r1(input.pc)} bar`} title="Joback Tc and pc" />
        <Row label="Acentric factor ω" value={omega.toFixed(3)} title="Lee–Kesler, from Tb/Tc and pc" />
        {model.triple && <Row label="Triple point" value={`${r1(model.triple.T - 273.15)} °C, ${fmtP(model.triple.p)}`} />}
        <Row label="ΔHvap at Tb / 25 °C" value={`${r1(input.hvapTb)} / ${hvap25 === null ? "—" : r1(hvap25)} kJ/mol`} title="Joback at Tb; Watson scaling at 25 °C" />
        {model.hsub !== null && <Row label="ΔHsub at the triple point" value={`${r1(model.hsub)} kJ/mol`} title="ΔHfus + ΔHvap" />}
        <p className="hint">Joback group contributions for Tb, Tm, Tc, pc, ΔHvap and ΔHfus; Lee–Kesler correlation for the vapour curve; Clausius–Clapeyron for the solid boundaries. Estimates, not measurements: 10 K of error in Tb is a factor 1.5–2 in pressure.</p>
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
    </>
  );
}
