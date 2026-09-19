import { useEffect, useMemo, useState } from "react";
import { CHEM21_ORDER, SOLVENTS, assessCrystallisation, assessDistillation, knownAzeotrope, solubilityCurve } from "@molecular-cad/molecule-model";
import type { Molecule, PureComponent, UnifacGroups } from "@molecular-cad/molecule-model";
import type { ChemistryEngine } from "../chemistry/engine";
import { solventComponent, targetUnifacGroups } from "../chemistry/components";
import type { SolventComponent, UnifacFragmenter } from "../chemistry/components";
import { XyChart } from "./XyChart";

export interface MixtureSectionProps {
  engine: ChemistryEngine;
  /** Always the WebAssembly engine: UNIFAC fragmentation runs locally whatever engine is selected. */
  fragmenter: UnifacFragmenter;
  molecule: Molecule;
  target: PureComponent | null;
  /** Solvent-table id when the drawn molecule is a tabulated solvent (for the literature azeotropes). */
  targetId: string | null;
}

const r1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const C = (k: number) => k - 273.15;

function Row({ label, value, id }: { label: string; value: React.ReactNode; id?: string }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-value mono" id={id}>
        {value}
      </span>
    </div>
  );
}

/** Distillation and crystallisation of the drawn molecule with a tabulated solvent. */
export function MixtureSection({ engine, fragmenter, molecule, target: targetIn, targetId }: MixtureSectionProps) {
  const [solventId, setSolventId] = useState("ethanol");
  const [solvent, setSolvent] = useState<SolventComponent | null | "loading">("loading");
  const [tHot, setTHot] = useState("60");
  const [tCold, setTCold] = useState("0");
  const [targetGroups, setTargetGroups] = useState<UnifacGroups | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSolvent("loading");
    void solventComponent(engine, fragmenter, solventId).then((s) => !cancelled && setSolvent(s));
    return () => {
      cancelled = true;
    };
  }, [engine, fragmenter, solventId]);

  useEffect(() => {
    let cancelled = false;
    setTargetGroups(null);
    if (molecule.atoms.length === 0) return;
    void targetUnifacGroups(fragmenter, molecule).then((g) => !cancelled && setTargetGroups(g));
    return () => {
      cancelled = true;
    };
  }, [fragmenter, molecule]);

  const target = useMemo(() => (targetIn ? { ...targetIn, unifac: targetGroups } : null), [targetIn, targetGroups]);
  const sc = solvent === "loading" ? null : solvent;

  const distillation = useMemo(() => (target && sc ? assessDistillation(target, sc.component) : null), [target, sc]);
  const azeotrope = targetId && sc ? knownAzeotrope(targetId, sc.solvent.id) : null;
  const hotK = (Number(tHot) || 0) + 273.15;
  const coldK = (Number(tCold) || 0) + 273.15;
  const crystal = useMemo(() => (target && sc ? assessCrystallisation(target, sc.component, hotK, coldK) : null), [target, sc, hotK, coldK]);
  const curve = useMemo(() => {
    if (!target || !sc || target.tm == null || target.hfus == null) return [];
    const lo = Math.min(coldK, hotK) - 10;
    const hi = Math.min(Math.max(hotK, coldK) + 20, target.tm - 0.5, sc.component.tb);
    return hi > lo ? solubilityCurve(target, sc.component, lo, hi) : [];
  }, [target, sc, hotK, coldK]);

  const solventSelect = (
    <label className="field">
      <span className="field-label">Solvent (partner component)</span>
      <select id="mix-solvent" className="select" value={solventId} onChange={(e) => setSolventId(e.target.value)}>
        {[...SOLVENTS].sort((a, b) => CHEM21_ORDER[a.chem21] - CHEM21_ORDER[b.chem21] || a.name.localeCompare(b.name)).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · bp {s.bp} °C · {s.chem21}
          </option>
        ))}
      </select>
    </label>
  );

  if (!target) {
    return (
      <section className="panel-section" id="mixture">
        <h2 className="panel-title">
          Mixture with a solvent <span className="tag tag-predicted">predicted</span>
        </h2>
        <p className="hint">Distillation and crystallisation need the critical constants of the drawn molecule, which the Joback table cannot supply for this structure.</p>
      </section>
    );
  }

  return (
    <>
      <section className="panel-section" id="mixture">
        <h2 className="panel-title">
          Mixture with a solvent <span className="tag tag-predicted">predicted</span>
        </h2>
        {solventSelect}
        {solvent === "loading" && <p className="hint">Building the solvent's constants…</p>}
        {solvent === null && <p className="hint">The group method cannot estimate this solvent's critical constants (sulfone, sulfoxide or another uncovered group). Choose another solvent.</p>}
        {sc && <p className="hint">{target.name}: {target.provenance}. {sc.solvent.name}: {sc.component.provenance}.</p>}
      </section>

      {sc && distillation && (
        <section className="panel-section" id="distillation">
          <h2 className="panel-title">Distillation (ideal, 1 atm)</h2>
          <Row label="More volatile" value={`${distillation.light.name} (${r1(C(distillation.light.tb))} °C)`} id="dist-light" />
          <Row label="Less volatile" value={`${distillation.heavy.name} (${r1(C(distillation.heavy.tb))} °C)`} />
          <Row label="Boiling-point gap" value={`${r1(distillation.dTb)} K`} />
          <Row label="Relative volatility α" value={distillation.alphaMeaningful ? `${distillation.alphaMean.toFixed(2)} (${distillation.alphaLow.toFixed(2)}–${distillation.alphaHigh.toFixed(2)})` : "≫ 100 (not a fractionation)"} />
          <Row label="Separation" value={<span id="dist-verdict">{distillation.verdict}</span>} />
          <Row label="Activity model" value={<span id="dist-model">{distillation.activityModel.kind === "UNIFAC" ? "UNIFAC" : `ideal (${distillation.activityModel.reason})`}</span>} />
          {distillation.azeotrope && <Row label="Predicted azeotrope" value={<span id="azeotrope-predicted">{`x(${distillation.light.name}) = ${distillation.azeotrope.x1.toFixed(2)}, ${r1(C(distillation.azeotrope.T))} °C, ${distillation.azeotrope.kind}`}</span>} />}
          {distillation.alphaMeaningful && <Row label="Min. stages (99 %/1 %)" value={distillation.nmin === null ? "—" : `${Math.ceil(distillation.nmin)} (Fenske, total reflux)`} />}
          {distillation.txy.length > 0 && (
            <XyChart
              ariaLabel={`Temperature–composition diagram for ${distillation.light.name} and ${distillation.heavy.name}`}
              xLabel={`mole fraction of ${distillation.light.name}`}
              yLabel="°C"
              xDomain={[0, 1]}
              yDomain={[Math.floor(C(distillation.light.tb) / 5) * 5 - 5, Math.ceil(C(distillation.heavy.tb) / 5) * 5 + 5]}
              series={[
                { cls: "series-1", label: "liquid (bubble)", points: distillation.txy.map((p) => [p.x1, C(p.T)]) },
                { cls: "series-2", label: "vapour (dew)", points: distillation.txy.map((p) => [p.y1, C(p.T)]) },
              ]}
              xFormat={(v) => v.toFixed(1)}
              yFormat={(v) => v.toFixed(0)}
              hoverText={(xv, yv) => [`x = ${xv.toFixed(2)}, ${yv.toFixed(0)} °C`, "between the curves: two phases"]}
            />
          )}
          {azeotrope ? (
            <p className="hint warn-text" id="azeotrope">
              Literature: {distillation.light.name} and {distillation.heavy.name} form a {azeotrope.kind} azeotrope at {azeotrope.t} °C (about {azeotrope.wtA} wt % {SOLVENTS.find((s) => s.id === azeotrope.a)?.name}).{" "}
              {distillation.azeotrope ? `The UNIFAC prediction above (${r1(C(distillation.azeotrope.T))} °C) can be compared with this measured value.` : distillation.activityModel.kind === "UNIFAC" ? "UNIFAC does not reproduce it here; trust the measurement." : "The ideal diagram above does not show it; simple distillation cannot pass the azeotropic composition."}
            </p>
          ) : distillation.activityModel.kind === "ideal" ? (
            <p className={`hint${distillation.nonIdeality.level === "strong" ? " warn-text" : ""}`} id="nonideality">
              {distillation.nonIdeality.text}
            </p>
          ) : null}
          <ul className="reasoning">
            {distillation.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <p className="hint">{distillation.activityModel.kind === "UNIFAC" ? `Modified Raoult's law with original-UNIFAC activity coefficients (groups: ${distillation.activityModel.groups[0]} / ${distillation.activityModel.groups[1]}) on Lee–Kesler vapour pressures; typical error a few percent in composition, more for water-rich or associating systems.` : "Raoult's law on Lee–Kesler vapour pressures without activity coefficients."} Known azeotropes are literature values for the tabulated solvents only.</p>
        </section>
      )}

      {sc && (
        <section className="panel-section" id="crystallisation">
          <h2 className="panel-title">Cooling crystallisation (ideal)</h2>
          {target.tm == null || target.hfus == null ? (
            <p className="hint">Needs the melting point and enthalpy of fusion of the drawn molecule; the Joback table gives none for this structure. Enter measured values above.</p>
          ) : (
            <>
              <div className="custom-element">
                <label className="field">
                  <span className="field-label">Dissolve at, °C</span>
                  <input id="cryst-hot" className="input mono" inputMode="decimal" value={tHot} onChange={(e) => setTHot(e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Cool to, °C</span>
                  <input id="cryst-cold" className="input mono" inputMode="decimal" value={tCold} onChange={(e) => setTCold(e.target.value)} />
                </label>
              </div>
              {crystal === null && <p className="hint">The cold temperature must be below the hot one.</p>}
              {crystal && (
                <>
                  <Row label={`Solubility at ${tHot} °C`} value={Number.isFinite(crystal.sHot) ? `${r1(crystal.sHot)} g / 100 g solvent` : "miscible (above Tm)"} id="cryst-hot-s" />
                  <Row label={`Solubility at ${tCold} °C`} value={Number.isFinite(crystal.sCold) ? `${r1(crystal.sCold)} g / 100 g solvent` : "miscible"} />
                  <Row label="Recovery on cooling" value={<span id="cryst-recovery">{`${(crystal.recovery * 100).toFixed(0)} %`}</span>} />
                  <Row label="Activity model" value={<span id="cryst-model">{crystal.activityModel.kind === "UNIFAC" ? `UNIFAC (γ = ${crystal.gammaHot >= 100 ? crystal.gammaHot.toExponential(1) : crystal.gammaHot.toFixed(2)} at ${tHot} °C)` : `ideal (${crystal.activityModel.reason})`}</span>} />
                  <Row label="Solvent per gram" value={crystal.solventPerGram > 0 ? `${r1(crystal.solventPerGram)} g` : "—"} />
                  {curve.length > 1 && (
                    <XyChart
                      ariaLabel={`Ideal solubility of ${target.name} in ${sc.solvent.name}`}
                      xLabel="temperature, °C"
                      yLabel="g / 100 g solvent"
                      xDomain={[C(curve[0]!.T), C(curve[curve.length - 1]!.T)]}
                      yDomain={[0, Math.max(1, ...curve.map((p) => (Number.isFinite(p.gPer100g) ? p.gPer100g : 0))) * 1.05]}
                      series={[{ cls: "series-3", label: "ideal solubility", points: curve.filter((p) => Number.isFinite(p.gPer100g)).map((p) => [C(p.T), p.gPer100g]) }]}
                      markers={[
                        ...(Number.isFinite(crystal.sHot) ? [{ x: hotK - 273.15, y: crystal.sHot, label: "hot" }] : []),
                        ...(Number.isFinite(crystal.sCold) ? [{ x: coldK - 273.15, y: crystal.sCold, label: "cold", cls: "marker-std" }] : []),
                      ]}
                      xFormat={(v) => v.toFixed(0)}
                      yFormat={(v) => v.toFixed(0)}
                      hoverText={(xv, yv) => [`${xv.toFixed(0)} °C · ${yv.toFixed(1)} g/100 g`]}
                    />
                  )}
                  <ul className="reasoning">
                    {crystal.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="hint">Schröder–van Laar solubility (no ΔCp term) with the UNIFAC activity coefficient of the solute when both components have groups, ideal (γ = 1, an upper bound) otherwise. Tm and ΔHfus from Joback unless you entered measured values; Joback's Tm is its least reliable property and enters exponentially here.</p>
            </>
          )}
        </section>
      )}
    </>
  );
}
