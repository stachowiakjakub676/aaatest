import { useState } from "react";
import { phaseAt } from "@molecular-cad/molecule-model";
import type { PhaseInputs, PhaseModel, PhasePoint } from "@molecular-cad/molecule-model";

export interface PhaseDiagramProps {
  model: PhaseModel;
  input: PhaseInputs;
  /** The user's chosen conditions, drawn as a filled marker. */
  marker: PhasePoint;
  markerLabel: string;
}

const W = 340;
const H = 230;
const PAD = { l: 44, r: 12, t: 12, b: 30 };

const K = (c: number) => c + 273.15;
const C = (k: number) => k - 273.15;

function pressureLabel(bar: number): string {
  if (bar >= 1) return `${bar >= 10 ? bar.toFixed(0) : bar.toFixed(1)} bar`;
  if (bar >= 1e-3) return `${(bar * 1000).toFixed(0)} mbar`;
  if (bar >= 1e-6) return `${(bar * 1e6).toFixed(0)} µbar`;
  return `${bar.toExponential(0)} bar`;
}

/**
 * P–T diagram: log10(p) against T. Three boundaries (vapour, sublimation, melting), the triple and
 * critical points, the standard state (25 °C, 1 atm) as a hollow marker and the chosen conditions
 * as a filled one. Hovering reads the phase at the pointer.
 */
export function PhaseDiagram({ model, input, marker, markerLabel }: PhaseDiagramProps) {
  const [hover, setHover] = useState<PhasePoint | null>(null);
  const allT = [...model.vapour, ...model.sublimation, ...model.melting].map((p) => p.T);
  const tMin = Math.min(...allT) - 15;
  const tMax = model.critical.T * 1.12;
  const pFloor = Math.max(1e-9, Math.min(...[...model.vapour, ...model.sublimation].map((p) => p.p)) / 3);
  const logMin = Math.floor(Math.log10(pFloor));
  const logMax = Math.ceil(Math.log10(model.critical.p * 3));
  const x = (T: number) => PAD.l + ((T - tMin) / (tMax - tMin)) * (W - PAD.l - PAD.r);
  const y = (p: number) => PAD.t + (1 - (Math.log10(Math.max(p, 10 ** logMin)) - logMin) / (logMax - logMin)) * (H - PAD.t - PAD.b);
  const path = (pts: PhasePoint[]) => pts.map((pt, i) => `${i ? "L" : "M"}${x(pt.T).toFixed(1)},${y(pt.p).toFixed(1)}`).join(" ");
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // Axis ticks: whole decades in pressure, "nice" 50/100/200 K steps in temperature (labelled in °C).
  const pTicks: number[] = [];
  const decadeStep = logMax - logMin > 8 ? 2 : 1;
  for (let e = logMin; e <= logMax; e += decadeStep) pTicks.push(10 ** e);
  const span = tMax - tMin;
  const tStep = span > 600 ? 200 : span > 300 ? 100 : 50;
  const tTicks: number[] = [];
  for (let t = Math.ceil(C(tMin) / tStep) * tStep; t <= C(tMax); t += tStep) tTicks.push(K(t));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    if (px < PAD.l || px > W - PAD.r || py < PAD.t || py > H - PAD.b) return setHover(null);
    const T = tMin + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (tMax - tMin);
    const p = 10 ** (logMin + (1 - (py - PAD.t) / (H - PAD.t - PAD.b)) * (logMax - logMin));
    setHover({ T, p });
  };

  const hoverPhase = hover ? phaseAt(model, input, hover.T, hover.p) : null;
  const std: PhasePoint = { T: 298.15, p: 1.01325 };
  const vapMid = model.vapour[Math.floor(model.vapour.length * 0.55)]!;
  const subMid = model.sublimation[Math.floor(model.sublimation.length / 2)];
  const meltTop = model.melting[model.melting.length - 1];
  // Region labels: solid left of the triple point, gas bottom-right, liquid between vapour curve and melting line.
  const gasPos = { x: x(tMin + span * 0.72), y: y(10 ** (logMin + 0.9)) };
  const liqT = model.triple ? (model.triple.T + model.critical.T) / 2 : (model.vapour[0]!.T + model.critical.T) / 2;
  const liqP = 10 ** ((Math.log10(model.critical.p * 3) + Math.log10(Math.max(model.critical.p, 1))) / 2);
  const liqPos = { x: x(liqT), y: y(liqP) };
  const solPos = model.triple ? { x: x(Math.max(tMin + span * 0.04, model.triple.T - span * 0.24)), y: PAD.t + 26 } : null;

  return (
    <figure className="phase-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pressure–temperature phase diagram (estimated)" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {pTicks.map((p) => (
          <g key={`p${p}`}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(p)} y2={y(p)} />
            <text className="axis" x={PAD.l - 4} y={y(p) + 3} textAnchor="end">
              {pressureLabel(p)}
            </text>
          </g>
        ))}
        {tTicks.map((T) => (
          <g key={`t${T}`}>
            <line className="grid" x1={x(T)} x2={x(T)} y1={PAD.t} y2={H - PAD.b} />
            <text className="axis" x={x(T)} y={H - PAD.b + 12} textAnchor="middle">
              {C(T).toFixed(0)}
            </text>
          </g>
        ))}
        <text className="axis" x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle">
          temperature, °C
        </text>
        <text className="region" x={gasPos.x} y={gasPos.y}>
          gas
        </text>
        <text className="region" x={liqPos.x} y={liqPos.y} textAnchor="middle">
          liquid
        </text>
        {solPos && (
          <text className="region" x={solPos.x} y={solPos.y}>
            solid
          </text>
        )}
        <text className="region" x={W - PAD.r - 2} y={PAD.t + 10} textAnchor="end">
          supercritical
        </text>
        <path className="series series-1" d={path(model.vapour)} />
        {model.sublimation.length > 0 && <path className="series series-3" d={path(model.sublimation)} />}
        {model.melting.length > 0 && <path className="series series-2" d={path(model.melting)} />}
        <text className="series-label series-1" x={x(vapMid.T) + 5} y={y(vapMid.p) + 12}>
          vapour
        </text>
        {subMid && (
          <text className="series-label series-3" x={x(subMid.T) + 5} y={y(subMid.p) + 11}>
            sublimation
          </text>
        )}
        {meltTop && (
          <text className="series-label series-2" x={x(meltTop.T) - 5} y={PAD.t + 10} textAnchor="end">
            melting
          </text>
        )}
        {model.triple && <circle className="point" cx={x(model.triple.T)} cy={y(model.triple.p)} r={4} />}
        <circle className="point" cx={x(model.critical.T)} cy={y(model.critical.p)} r={4} />
        <text className="axis" x={x(model.critical.T) - 7} y={y(model.critical.p) + 12} textAnchor="end">
          critical
        </text>
        {model.triple && (
          <text className="axis" x={x(model.triple.T) + 6} y={y(model.triple.p) + 12}>
            triple
          </text>
        )}
        <circle className="marker-std" cx={x(clamp(std.T, tMin, tMax))} cy={y(std.p)} r={4.5} />
        <circle className="marker" cx={x(clamp(marker.T, tMin, tMax))} cy={y(clamp(marker.p, 10 ** logMin, 10 ** logMax))} r={5} />
        <text className="axis" x={x(clamp(marker.T, tMin, tMax)) + 7} y={y(clamp(marker.p, 10 ** logMin, 10 ** logMax)) + 4}>
          {markerLabel}
        </text>
        {hover && (
          <g className="hover">
            <line x1={x(hover.T)} x2={x(hover.T)} y1={PAD.t} y2={H - PAD.b} />
            <line x1={PAD.l} x2={W - PAD.r} y1={y(hover.p)} y2={y(hover.p)} />
            <rect x={Math.min(x(hover.T) + 8, W - 150)} y={Math.max(PAD.t, y(hover.p) - 34)} width={138} height={30} rx={3} />
            <text x={Math.min(x(hover.T) + 8, W - 150) + 6} y={Math.max(PAD.t, y(hover.p) - 34) + 12}>
              {C(hover.T).toFixed(0)} °C · {pressureLabel(hover.p)}
            </text>
            <text x={Math.min(x(hover.T) + 8, W - 150) + 6} y={Math.max(PAD.t, y(hover.p) - 34) + 24}>
              {hoverPhase}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="legend">
        <span>
          <i className="swatch series-1" /> liquid–vapour
        </span>
        {model.sublimation.length > 0 && (
          <span>
            <i className="swatch series-3" /> solid–vapour
          </span>
        )}
        {model.melting.length > 0 && (
          <span>
            <i className="swatch series-2" /> solid–liquid
          </span>
        )}
        <span>
          <i className="swatch hollow" /> 25 °C, 1 atm
        </span>
      </figcaption>
    </figure>
  );
}
