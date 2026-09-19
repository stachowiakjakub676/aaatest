import { useState } from "react";

export interface XySeries {
  /** CSS class suffix: series-1, series-2, series-3. */
  cls: string;
  label: string;
  points: Array<[number, number]>;
}

export interface XyMarker {
  x: number;
  y: number;
  label: string;
  cls?: string;
}

export interface XyChartProps {
  ariaLabel: string;
  xLabel: string;
  yLabel: string;
  xDomain: [number, number];
  yDomain: [number, number];
  series: XySeries[];
  markers?: XyMarker[];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  /** Text for the hover tooltip; default shows x and y. */
  hoverText?: (x: number, y: number) => string[];
}

const W = 340;
const H = 220;
const PAD = { l: 44, r: 12, t: 12, b: 30 };

function niceTicks(lo: number, hi: number, count = 5): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/** Small linear x–y chart with direct series labels, a legend for two or more series and a crosshair hover. */
export function XyChart({ ariaLabel, xLabel, yLabel, xDomain, yDomain, series, markers = [], xFormat = (v) => String(v), yFormat = (v) => String(v), hoverText }: XyChartProps) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const x = (v: number) => PAD.l + ((v - x0) / (x1 - x0 || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - PAD.t - PAD.b);
  const path = (pts: Array<[number, number]>) => pts.map(([px, py], i) => `${i ? "L" : "M"}${x(px).toFixed(1)},${y(py).toFixed(1)}`).join(" ");
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    if (px < PAD.l || px > W - PAD.r || py < PAD.t || py > H - PAD.b) return setHover(null);
    setHover([x0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (x1 - x0), y0 + (1 - (py - PAD.t) / (H - PAD.t - PAD.b)) * (y1 - y0)]);
  };
  const lines = hover ? (hoverText ? hoverText(hover[0], hover[1]) : [`${xFormat(hover[0])} · ${yFormat(hover[1])}`]) : [];
  return (
    <figure className="phase-diagram xy-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {niceTicks(y0, y1).map((v) => (
          <g key={`y${v}`}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
            <text className="axis" x={PAD.l - 4} y={y(v) + 3} textAnchor="end">
              {yFormat(v)}
            </text>
          </g>
        ))}
        {niceTicks(x0, x1).map((v) => (
          <g key={`x${v}`}>
            <line className="grid" x1={x(v)} x2={x(v)} y1={PAD.t} y2={H - PAD.b} />
            <text className="axis" x={x(v)} y={H - PAD.b + 12} textAnchor="middle">
              {xFormat(v)}
            </text>
          </g>
        ))}
        <text className="axis" x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle">
          {xLabel}
        </text>
        <text className="axis" x={PAD.l + 4} y={PAD.t + 9}>
          {yLabel}
        </text>
        {series.map((s) => (
          <path key={s.cls} className={`series ${s.cls}`} d={path(s.points)} />
        ))}
        {series.map((s, i) => {
          // Label near an evenly spaced x position (not array index: curves may bunch their points).
          const targetX = x0 + ((x1 - x0) * (i + 1)) / (series.length + 1);
          const pt = s.points.reduce<[number, number] | null>((best, p) => (best === null || Math.abs(p[0] - targetX) < Math.abs(best[0] - targetX) ? p : best), null);
          if (!pt) return null;
          const atRight = x(pt[0]) > W - 70;
          return (
            <text key={`l${s.cls}`} className={`series-label ${s.cls}`} x={x(pt[0]) + (atRight ? -5 : 5)} y={y(pt[1]) + (i % 2 ? 12 : -5)} textAnchor={atRight ? "end" : "start"}>
              {s.label}
            </text>
          );
        })}
        {markers.map((m) => (
          <g key={m.label}>
            <circle className={m.cls ?? "marker"} cx={x(m.x)} cy={y(m.y)} r={5} />
            <text className="axis" x={x(m.x) + 7} y={y(m.y) + 4}>
              {m.label}
            </text>
          </g>
        ))}
        {hover && (
          <g className="hover">
            <line x1={x(hover[0])} x2={x(hover[0])} y1={PAD.t} y2={H - PAD.b} />
            <line x1={PAD.l} x2={W - PAD.r} y1={y(hover[1])} y2={y(hover[1])} />
            <rect x={Math.min(x(hover[0]) + 8, W - 160)} y={Math.max(PAD.t, y(hover[1]) - 10 - 12 * lines.length)} width={148} height={8 + 12 * lines.length} rx={3} />
            {lines.map((t, i) => (
              <text key={i} x={Math.min(x(hover[0]) + 8, W - 160) + 6} y={Math.max(PAD.t, y(hover[1]) - 10 - 12 * lines.length) + 12 + 12 * i}>
                {t}
              </text>
            ))}
          </g>
        )}
      </svg>
      {series.length > 1 && (
        <figcaption className="legend">
          {series.map((s) => (
            <span key={s.cls}>
              <i className={`swatch ${s.cls}`} /> {s.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
