/**
 * Two-component phase behaviour for the practical questions "can I separate these by distillation?"
 * and "how much will crystallise out when I cool the solution?".
 *
 * Vapour–liquid: Raoult's law (ideal solution) with each pure component's vapour pressure from the
 * Lee–Kesler correlation; bubble points by bisection between the two pure boiling points; relative
 * volatility α = p1°/p2°; Fenske's equation for the minimum number of theoretical stages. Real
 * mixtures deviate from Raoult's law; the deviation is reported qualitatively from the Hansen
 * distance between the components, and known azeotropes among the tabulated solvents are listed
 * from the literature (CRC Handbook of Chemistry and Physics, azeotrope tables; Horsley,
 * Azeotropic Data). Quantitative activity coefficients (UNIFAC) are not implemented.
 *
 * Solid–liquid: ideal solubility of a solid (Schröder–van Laar / van 't Hoff),
 * ln x = −(ΔHfus/R)(1/T − 1/Tm), which ignores ΔCp and the activity coefficient. For most systems
 * the real solubility is lower (γ > 1), increasingly so as the Hansen distance grows.
 */
import type { HansenTriple } from "./hansen";
import { hansenDistance } from "./hansen";
import { P_ATM_BAR, R_GAS, vapourPressure } from "./phase";
import { describeUnifacGroups, unifacCoverage, unifacGammas } from "./unifac";
import type { UnifacGroups } from "./unifac";

export interface PureComponent {
  name: string;
  /** g/mol */
  molarMass: number;
  /** Normal boiling point, K. */
  tb: number;
  tc: number;
  pc: number;
  omega: number;
  /** Enthalpy of vaporisation at Tb, kJ/mol. */
  hvapTb: number;
  /** Melting point, K (null: no solid–liquid estimates). */
  tm?: number | null;
  /** Enthalpy of fusion, kJ/mol. */
  hfus?: number | null;
  hansen?: HansenTriple | null;
  /** UNIFAC subgroup assignment (null: not fragmentable → ideal-solution fallback). */
  unifac?: UnifacGroups | null;
  /** Where the numbers come from, for the UI ("Joback estimate", "measured", "measured Tb, Joback Tc/pc"). */
  provenance: string;
}

/** Pure-component vapour pressure, bar (null at or above Tc). */
export function componentVapourPressure(c: PureComponent, T: number): number | null {
  return vapourPressure(T, c.tc, c.pc, c.omega);
}

export type ActivityModel = { kind: "UNIFAC"; groups: [string, string] } | { kind: "ideal"; reason: string };

/** Which activity-coefficient model the pair supports. */
export function activityModel(c1: PureComponent, c2: PureComponent): ActivityModel {
  if (!c1.unifac) return { kind: "ideal", reason: `${c1.name} could not be split into UNIFAC groups` };
  if (!c2.unifac) return { kind: "ideal", reason: `${c2.name} could not be split into UNIFAC groups` };
  const cov = unifacCoverage([c1.unifac, c2.unifac]);
  if (!cov.ok) return { kind: "ideal", reason: `no published UNIFAC interaction parameters for ${cov.missing.join("; ") || "these groups"}` };
  return { kind: "UNIFAC", groups: [describeUnifacGroups(c1.unifac), describeUnifacGroups(c2.unifac)] };
}

/** Activity coefficients [γ1, γ2] at liquid mole fraction x1 and T (K); [1, 1] under the ideal fallback. */
export function activityCoefficients(c1: PureComponent, c2: PureComponent, x1: number, T: number): [number, number] {
  if (c1.unifac && c2.unifac) {
    const g = unifacGammas([c1.unifac, c2.unifac], [x1, 1 - x1], T);
    if (g) return [g[0]!, g[1]!];
  }
  return [1, 1];
}

/** Temperature at which a pure component boils at p (bar), by bisection; null above its pc. */
function pureBoilingPoint(c: PureComponent, p: number): number | null {
  if (p >= c.pc) return null;
  let lo = 0.15 * c.tc;
  let hi = c.tc;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if ((componentVapourPressure(c, mid) ?? Infinity) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface BubblePoint {
  /** K */
  T: number;
  /** Vapour mole fraction of component 1. */
  y1: number;
}

/**
 * Bubble point of a liquid with mole fraction x1 of component 1 at total pressure p (bar):
 * modified Raoult's law p = x1·γ1·p1° + x2·γ2·p2°, with γ from UNIFAC when both components have
 * groups and ideal (γ = 1) otherwise.
 */
export function bubblePoint(c1: PureComponent, c2: PureComponent, x1: number, p: number = P_ATM_BAR): BubblePoint | null {
  const t1 = pureBoilingPoint(c1, p);
  const t2 = pureBoilingPoint(c2, p);
  if (t1 === null || t2 === null) return null;
  const total = (T: number) => {
    const [g1, g2] = activityCoefficients(c1, c2, x1, T);
    return x1 * g1 * (componentVapourPressure(c1, T) ?? Infinity) + (1 - x1) * g2 * (componentVapourPressure(c2, T) ?? Infinity);
  };
  // Azeotropes boil outside the pure-component range: widen the bracket until it contains p.
  let lo = Math.min(t1, t2);
  let hi = Math.max(t1, t2);
  while (total(lo) > p && lo > 0.3 * Math.min(c1.tc, c2.tc)) lo -= 10;
  while (total(hi) < p && hi < 0.98 * Math.min(c1.tc, c2.tc)) hi += 10;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (total(mid) < p) lo = mid;
    else hi = mid;
  }
  const T = (lo + hi) / 2;
  const [g1] = activityCoefficients(c1, c2, x1, T);
  const p1 = componentVapourPressure(c1, T) ?? 0;
  return { T, y1: Math.min(1, Math.max(0, (x1 * g1 * p1) / p)) };
}

export interface TxyPoint {
  x1: number;
  y1: number;
  /** Bubble temperature, K. */
  T: number;
}

/** Bubble-point curve (T against x1) and the dew-point pairs (T against y1) at pressure p. */
export function txyDiagram(c1: PureComponent, c2: PureComponent, p: number = P_ATM_BAR, samples = 40): TxyPoint[] {
  const out: TxyPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const x1 = i / samples;
    const b = bubblePoint(c1, c2, x1, p);
    if (!b) return [];
    out.push({ x1, y1: b.y1, T: b.T });
  }
  return out;
}

/** Relative volatility α12 = γ1·p1° / (γ2·p2°) at T and liquid composition x1 (γ = 1 under the ideal fallback). */
export function relativeVolatility(c1: PureComponent, c2: PureComponent, T: number, x1 = 0.5): number | null {
  const p1 = componentVapourPressure(c1, T);
  const p2 = componentVapourPressure(c2, T);
  if (p1 === null || p2 === null || p2 === 0) return null;
  const [g1, g2] = activityCoefficients(c1, c2, x1, T);
  return (g1 * p1) / (g2 * p2);
}

export interface PredictedAzeotrope {
  /** Liquid (= vapour) mole fraction of component 1 at the azeotrope. */
  x1: number;
  /** K */
  T: number;
  kind: "minimum-boiling" | "maximum-boiling";
}

/** Azeotrope from a T–x–y curve: where y1 − x1 changes sign inside the composition range. */
export function findAzeotrope(txy: TxyPoint[], tb1: number, tb2: number): PredictedAzeotrope | null {
  for (let i = 1; i < txy.length - 2; i++) {
    const a = txy[i]!;
    const b = txy[i + 1]!;
    const fa = a.y1 - a.x1;
    const fb = b.y1 - b.x1;
    if (fa === 0 || fa * fb > 0) continue;
    const t = fa / (fa - fb);
    const x1 = a.x1 + t * (b.x1 - a.x1);
    const T = a.T + t * (b.T - a.T);
    return { x1, T, kind: T < Math.min(tb1, tb2) ? "minimum-boiling" : "maximum-boiling" };
  }
  return null;
}

/** Fenske: minimum theoretical stages (total reflux) to go from xB of the light key in the bottoms to xD in the distillate. */
export function fenskeMinimumStages(alpha: number, xD = 0.99, xB = 0.01): number | null {
  if (!(alpha > 1)) return null;
  return Math.log((xD / (1 - xD)) * ((1 - xB) / xB)) / Math.log(alpha);
}

export type DeviationLevel = "near-ideal" | "moderate" | "strong";

export interface NonIdeality {
  level: DeviationLevel;
  /** Hansen distance between the components, MPa^½ (null when either has no Hansen parameters). */
  ra: number | null;
  text: string;
}

/**
 * Qualitative deviation from Raoult's law from the Hansen distance: components with similar
 * cohesion energy mix nearly ideally; a large distance means the unlike interactions are weaker
 * than the like ones (positive deviation), which raises vapour pressures and, when the boiling
 * points are close, produces a minimum-boiling azeotrope.
 */
export function nonIdealityFromHansen(c1: PureComponent, c2: PureComponent): NonIdeality {
  if (!c1.hansen || !c2.hansen) return { level: "moderate", ra: null, text: "No Hansen parameters for one component: the deviation from ideality cannot be judged; assume moderate." };
  const ra = hansenDistance(c1.hansen, c2.hansen);
  const dTb = Math.abs(c1.tb - c2.tb);
  if (ra < 5) return { level: "near-ideal", ra, text: `Hansen distance ${ra.toFixed(1)} MPa½: similar cohesion energy, close to an ideal solution (Raoult's law is a fair description).` };
  if (ra < 9) return { level: "moderate", ra, text: `Hansen distance ${ra.toFixed(1)} MPa½: moderate positive deviation from Raoult's law expected; the real curves lie somewhat below the ideal ones${dTb < 30 ? " and an azeotrope is possible since the boiling points are within 30 K" : ""}.` };
  return { level: "strong", ra, text: `Hansen distance ${ra.toFixed(1)} MPa½: strongly non-ideal (unlike interactions much weaker than like ones). ${dTb < 40 ? "With boiling points this close a minimum-boiling azeotrope is likely, and simple distillation cannot pass it." : "Expect a large positive deviation and possibly limited miscibility."}` };
}

export interface KnownAzeotrope {
  /** Solvent ids from the SOLVENTS table. */
  a: string;
  b: string;
  /** Azeotropic boiling point at 1 atm, °C. */
  t: number;
  /** Approximate mass fraction of component a at the azeotrope, %. */
  wtA: number;
  kind: "minimum-boiling" | "maximum-boiling" | "minimum-boiling (heterogeneous)";
}

/** Literature azeotropes among the tabulated solvents (measured data, rounded). */
export const KNOWN_AZEOTROPES: readonly KnownAzeotrope[] = [
  { a: "ethanol", b: "water", t: 78.2, wtA: 95.6, kind: "minimum-boiling" },
  { a: "2-propanol", b: "water", t: 80.4, wtA: 87.7, kind: "minimum-boiling" },
  { a: "1-butanol", b: "water", t: 92.7, wtA: 55.5, kind: "minimum-boiling (heterogeneous)" },
  { a: "acetonitrile", b: "water", t: 76.5, wtA: 83.7, kind: "minimum-boiling" },
  { a: "thf", b: "water", t: 64.0, wtA: 94.7, kind: "minimum-boiling" },
  { a: "ethyl-acetate", b: "water", t: 70.4, wtA: 91.5, kind: "minimum-boiling (heterogeneous)" },
  { a: "toluene", b: "water", t: 84.1, wtA: 80, kind: "minimum-boiling (heterogeneous)" },
  { a: "benzene", b: "water", t: 69.3, wtA: 91, kind: "minimum-boiling (heterogeneous)" },
  { a: "mek", b: "water", t: 73.4, wtA: 89, kind: "minimum-boiling (heterogeneous)" },
  { a: "dioxane", b: "water", t: 87.8, wtA: 82, kind: "minimum-boiling" },
  { a: "pyridine", b: "water", t: 92.6, wtA: 57, kind: "minimum-boiling" },
  { a: "formic-acid", b: "water", t: 107.1, wtA: 77.5, kind: "maximum-boiling" },
  { a: "ethyl-acetate", b: "ethanol", t: 71.8, wtA: 69, kind: "minimum-boiling" },
  { a: "benzene", b: "ethanol", t: 67.9, wtA: 67.6, kind: "minimum-boiling" },
  { a: "hexane", b: "ethanol", t: 58.7, wtA: 79, kind: "minimum-boiling" },
  { a: "heptane", b: "ethanol", t: 70.9, wtA: 51, kind: "minimum-boiling" },
  { a: "cyclohexane", b: "ethanol", t: 64.9, wtA: 69.5, kind: "minimum-boiling" },
  { a: "chloroform", b: "ethanol", t: 59.3, wtA: 93, kind: "minimum-boiling" },
  { a: "toluene", b: "ethanol", t: 76.7, wtA: 32, kind: "minimum-boiling" },
  { a: "chloroform", b: "methanol", t: 53.5, wtA: 87.4, kind: "minimum-boiling" },
  { a: "benzene", b: "methanol", t: 57.5, wtA: 60.5, kind: "minimum-boiling" },
  { a: "acetone", b: "methanol", t: 55.5, wtA: 88, kind: "minimum-boiling" },
  { a: "dcm", b: "methanol", t: 37.8, wtA: 92.7, kind: "minimum-boiling" },
  { a: "hexane", b: "methanol", t: 50.6, wtA: 72, kind: "minimum-boiling" },
  { a: "chloroform", b: "acetone", t: 64.5, wtA: 78.5, kind: "maximum-boiling" },
  { a: "acetone", b: "hexane", t: 49.8, wtA: 59, kind: "minimum-boiling" },
  { a: "acetone", b: "cyclohexane", t: 53.0, wtA: 67, kind: "minimum-boiling" },
  { a: "ethyl-acetate", b: "cyclohexane", t: 71.6, wtA: 54, kind: "minimum-boiling" },
  { a: "acetic-acid", b: "toluene", t: 100.6, wtA: 28, kind: "minimum-boiling" },
];

export function knownAzeotrope(idA: string, idB: string): KnownAzeotrope | null {
  return KNOWN_AZEOTROPES.find((z) => (z.a === idA && z.b === idB) || (z.a === idB && z.b === idA)) ?? null;
}

export type SeparationVerdict = "easy" | "normal" | "hard" | "impractical" | "azeotropic";

export interface DistillationAssessment {
  /** Component 1 is the more volatile one after ordering. */
  light: PureComponent;
  heavy: PureComponent;
  /** Which of the inputs is the light one (1 or 2). */
  lightIndex: 1 | 2;
  /** Difference of the pure boiling points at p, K. */
  dTb: number;
  /** Relative volatility at the two pure boiling points and their geometric mean. */
  alphaLow: number;
  alphaHigh: number;
  alphaMean: number;
  verdict: SeparationVerdict;
  activityModel: ActivityModel;
  /** Azeotrope predicted by the activity model (null: none, or ideal fallback). */
  azeotrope: PredictedAzeotrope | null;
  /** False when the boiling points are more than 150 K apart: α is then astronomically large and not a useful number. */
  alphaMeaningful: boolean;
  /** Fenske minimum stages for 99 % / 1 % (mol) products, at the mean α. */
  nmin: number | null;
  txy: TxyPoint[];
  nonIdeality: NonIdeality;
  notes: string[];
}

/** Assess an ideal binary distillation at pressure p (bar). */
export function assessDistillation(c1: PureComponent, c2: PureComponent, p: number = P_ATM_BAR): DistillationAssessment | null {
  const t1 = pureBoilingPoint(c1, p);
  const t2 = pureBoilingPoint(c2, p);
  if (t1 === null || t2 === null) return null;
  const lightIndex: 1 | 2 = t1 <= t2 ? 1 : 2;
  const light = lightIndex === 1 ? c1 : c2;
  const heavy = lightIndex === 1 ? c2 : c1;
  const tLow = Math.min(t1, t2);
  const tHigh = Math.max(t1, t2);
  const model = activityModel(light, heavy);
  // α at the two ends of the composition range: light component infinitely dilute (x → 0, at the heavy Tb) and pure (x → 1).
  const alphaLow = relativeVolatility(light, heavy, tHigh, 0) ?? 1;
  const alphaHigh = relativeVolatility(light, heavy, tLow, 1) ?? 1;
  const alphaMean = Math.sqrt(Math.max(alphaLow, 1e-9) * Math.max(alphaHigh, 1e-9));
  const dTb = tHigh - tLow;
  const txy = txyDiagram(light, heavy, p);
  const azeotrope = model.kind === "UNIFAC" ? findAzeotrope(txy, tLow, tHigh) : null;
  const alphaMin = Math.min(alphaLow, alphaHigh);
  const verdict: SeparationVerdict = azeotrope ? "azeotropic" : alphaMin < 1.1 ? "impractical" : alphaMin < 1.5 ? "hard" : alphaMin < 3 ? "normal" : "easy";
  const nmin = azeotrope ? null : fenskeMinimumStages(alphaMean);
  const nonIdeality = nonIdealityFromHansen(light, heavy);
  const alphaMeaningful = dTb <= 150;
  const notes: string[] = [];
  notes.push(model.kind === "UNIFAC" ? `Modified Raoult's law p = Σ xᵢγᵢpᵢ° with UNIFAC activity coefficients (${model.groups[0]} / ${model.groups[1]}) at ${p === P_ATM_BAR ? "1 atm" : `${p.toFixed(3)} bar`}; α = γ·p°(light) / γ·p°(heavy).` : `Ideal solution (Raoult's law, ${model.reason}): T–x–y from the pure-component vapour pressures at ${p === P_ATM_BAR ? "1 atm" : `${p.toFixed(3)} bar`}; α = p°(light)/p°(heavy).`);
  if (azeotrope) notes.push(`${azeotrope.kind === "minimum-boiling" ? "Minimum" : "Maximum"}-boiling azeotrope predicted at x(${light.name}) = ${azeotrope.x1.toFixed(2)}, ${(azeotrope.T - 273.15).toFixed(1)} °C: ordinary distillation cannot cross this composition; use pressure-swing, an entrainer, a membrane or a different separation. UNIFAC places azeotropes to within a few percent in composition when the groups are well parameterised.`);
  else if (!alphaMeaningful) notes.push(`Boiling points ${dTb.toFixed(0)} K apart: this is not a fractionation problem. The volatile component simply evaporates or distils off (a rotary evaporator or a short-path still), leaving the other behind; the heavy one may decompose before it boils.`);
  else if (verdict === "easy") notes.push(`α ≈ ${alphaMean.toFixed(1)}: a simple distillation (one stage) already enriches the vapour strongly; a short column gives pure products.`);
  else if (verdict === "normal") notes.push(`α ≈ ${alphaMean.toFixed(2)}: fractional distillation with a packed or plated column; about ${nmin === null ? "?" : Math.ceil(nmin)} theoretical stages at total reflux for 99 %/1 % products, roughly twice that at a practical reflux ratio.`);
  else if (verdict === "hard") notes.push(`α ≈ ${alphaMean.toFixed(2)}: boiling points ${dTb.toFixed(0)} K apart; ${nmin === null ? "many" : Math.ceil(nmin)} theoretical stages at minimum, so an efficient column and a high reflux ratio are needed.`);
  else notes.push(`α ≈ ${alphaMean.toFixed(3)}: boiling points only ${dTb.toFixed(1)} K apart; distillation is impractical, consider crystallisation, extraction or chromatography.`);
  return { light, heavy, lightIndex, dTb, alphaLow, alphaHigh, alphaMean, verdict, activityModel: model, azeotrope, alphaMeaningful, nmin, txy, nonIdeality, notes };
}

// ---------------------------------------------------------------------------
// Solid–liquid equilibrium
// ---------------------------------------------------------------------------

/** Ideal solubility of a solid: mole fraction of solute in the saturated solution (1 at or above Tm). */
export function idealSolubility(hfus: number, tm: number, T: number): number {
  if (T >= tm) return 1;
  return Math.exp((-(hfus * 1000) / R_GAS) * (1 / T - 1 / tm));
}

/**
 * Solubility (mole fraction) of a solid solute in a solvent at T: ln(x·γ) = −ΔHfus/R·(1/T − 1/Tm),
 * solved by damped fixed-point iteration when UNIFAC γ is available, ideal otherwise.
 */
export function solubilityMoleFraction(solute: PureComponent, solvent: PureComponent, T: number): number | null {
  if (solute.tm == null || solute.hfus == null) return null;
  const ideal = idealSolubility(solute.hfus, solute.tm, T);
  if (ideal >= 1 || activityModel(solute, solvent).kind !== "UNIFAC") return ideal;
  let x = ideal;
  for (let i = 0; i < 200; i++) {
    const [g] = activityCoefficients(solute, solvent, x, T);
    const next = Math.min(1, ideal / g);
    const damped = Math.exp(0.5 * Math.log(x) + 0.5 * Math.log(Math.max(next, 1e-300)));
    if (Math.abs(damped - x) < 1e-12 * Math.max(x, 1e-300)) return damped;
    x = damped;
  }
  return x;
}

/** Mole fraction of solute → grams of solute per 100 g of solvent. */
export function solubilityToGrams(x: number, soluteMass: number, solventMass: number): number {
  if (x >= 1) return Infinity;
  return (100 * x * soluteMass) / ((1 - x) * solventMass);
}

export interface SolubilityPoint {
  /** K */
  T: number;
  x: number;
  /** g solute per 100 g solvent (Infinity above Tm: the two liquids are assumed miscible). */
  gPer100g: number;
}

export function solubilityCurve(solute: PureComponent, solvent: PureComponent, tMin: number, tMax: number, samples = 40): SolubilityPoint[] {
  if (solute.tm === null || solute.tm === undefined || solute.hfus === null || solute.hfus === undefined) return [];
  const out: SolubilityPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const T = tMin + ((tMax - tMin) * i) / samples;
    const x = solubilityMoleFraction(solute, solvent, T) ?? 1;
    out.push({ T, x, gPer100g: solubilityToGrams(x, solute.molarMass, solvent.molarMass) });
  }
  return out;
}

export interface CrystallisationEstimate {
  /** Solubility at the hot and cold temperatures, g per 100 g solvent. */
  sHot: number;
  sCold: number;
  /** Fraction of the dissolved solute that crystallises on cooling (0–1). */
  recovery: number;
  /** Grams of solvent needed to dissolve 1 g of solute at the hot temperature. */
  solventPerGram: number;
  /** Hansen-based caution about how far below the ideal value the real solubility may be (ideal fallback only). */
  nonIdeality: NonIdeality;
  activityModel: ActivityModel;
  /** Activity coefficient of the solute in the saturated solution at the hot temperature (1 under the ideal fallback). */
  gammaHot: number;
  notes: string[];
}

/** Ideal cooling-crystallisation estimate: saturate at tHot, cool to tCold. Null without Tm/ΔHfus or when the solute melts below tHot. */
export function assessCrystallisation(solute: PureComponent, solvent: PureComponent, tHot: number, tCold: number): CrystallisationEstimate | null {
  if (solute.tm === null || solute.tm === undefined || solute.hfus === null || solute.hfus === undefined) return null;
  if (!(tCold < tHot)) return null;
  const model = activityModel(solute, solvent);
  const xHot = solubilityMoleFraction(solute, solvent, tHot)!;
  const xCold = solubilityMoleFraction(solute, solvent, tCold)!;
  const sHot = solubilityToGrams(xHot, solute.molarMass, solvent.molarMass);
  const sCold = solubilityToGrams(xCold, solute.molarMass, solvent.molarMass);
  const gammaHot = model.kind === "UNIFAC" && xHot < 1 ? activityCoefficients(solute, solvent, xHot, tHot)[0] : 1;
  const notes: string[] = [];
  const nonIdeality = nonIdealityFromHansen(solute, solvent);
  if (tHot >= solute.tm) {
    notes.push(`At ${(tHot - 273.15).toFixed(0)} °C the solute is above its melting point (${(solute.tm - 273.15).toFixed(0)} °C): it is a second liquid, not a solid to dissolve. Choose a lower temperature or the estimate is meaningless.`);
    return { sHot, sCold, recovery: 0, solventPerGram: 0, nonIdeality, activityModel: model, gammaHot, notes };
  }
  const recovery = Number.isFinite(sHot) && sHot > 0 ? Math.max(0, 1 - sCold / sHot) : 0;
  if (model.kind === "UNIFAC") notes.push(`Solubility from ln(x·γ) = −ΔHfus/R·(1/T − 1/Tm) with ΔHfus ${solute.hfus.toFixed(1)} kJ/mol, Tm ${(solute.tm - 273.15).toFixed(0)} °C and the UNIFAC activity coefficient of the solute in the saturated solution (γ = ${gammaHot >= 100 ? gammaHot.toExponential(1) : gammaHot.toFixed(2)} at ${(tHot - 273.15).toFixed(0)} °C; γ > 1 lowers the solubility below the ideal value).`);
  else notes.push(`Ideal solubility ln x = −ΔHfus/R·(1/T − 1/Tm) with ΔHfus ${solute.hfus.toFixed(1)} kJ/mol and Tm ${(solute.tm - 273.15).toFixed(0)} °C (${model.reason}); it does not depend on the solvent, only the conversion to grams does.`);
  notes.push(recovery > 0.8 ? "Steep solubility curve: cooling crystallisation recovers most of the material." : recovery > 0.5 ? "Moderate recovery; concentrating the mother liquor or an anti-solvent would raise it." : "Flat solubility curve: cooling alone recovers little; evaporate solvent or add an anti-solvent instead.");
  if (model.kind === "UNIFAC") notes.push(gammaHot > 50 ? "The solute is very non-ideal in this solvent: it is practically insoluble, so this is an anti-solvent, not a crystallisation solvent." : gammaHot > 3 ? "Substantial positive deviation: a workable but not ideal crystallisation solvent; check the absolute solubility against the amount you need to dissolve." : "The solute behaves nearly ideally in this solvent.");
  else notes.push(nonIdeality.level === "near-ideal" ? "Solute and solvent have similar Hansen parameters: the ideal value is a reasonable estimate." : nonIdeality.level === "moderate" ? "Moderate Hansen distance: expect the real solubility to be lower than ideal by a factor of a few; the recovery fraction is less affected than the absolute amounts." : "Large Hansen distance: the real solubility is probably far below the ideal value (the ideal number is an upper bound); this solvent may be an anti-solvent rather than a crystallisation solvent.");
  return { sHot, sCold, recovery, solventPerGram: Number.isFinite(sHot) && sHot > 0 ? 100 / sHot : 0, nonIdeality, activityModel: model, gammaHot, notes };
}
