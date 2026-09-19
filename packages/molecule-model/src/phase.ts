/**
 * Phase behaviour of a pure compound from its (estimated) critical constants.
 *
 * Lee & Kesler, AIChE J. 21 (1975) 510: reduced vapour-pressure correlation ln(p/pc) = f0(Tr) + ω·f1(Tr),
 * and the acentric factor ω back-calculated from the normal boiling point with the same equation
 * (Poling, Prausnitz & O'Connell, The Properties of Gases and Liquids, 5th ed., eqs 2-3.4 and 7-3.1).
 * Watson, Ind. Eng. Chem. 35 (1943) 398: ΔHvap(T) = ΔHvap(Tb)·((1−Tr)/(1−Tbr))^0.38.
 * Clausius–Clapeyron for the sublimation line (ΔHsub = ΔHfus + ΔHvap at the triple point) and the
 * melting line (dT/dp = T·ΔVfus/ΔHfus, with ΔVfus taken as 10 % of the molar volume).
 *
 * Everything here is an ESTIMATE that inherits the error of its inputs (Joback Tb, Tc, pc, ΔHvap, Tm,
 * ΔHfus). Ten kelvin of error in Tb is roughly a factor 1.5–2 in vapour pressure.
 */

/** Gas constant, J/(mol·K). */
export const R_GAS = 8.314462618;
/** Standard atmosphere in bar. */
export const P_ATM_BAR = 1.01325;

/** Lee–Kesler functions of the reduced temperature. */
export function leeKeslerTerms(tr: number): { f0: number; f1: number } {
  const ln = Math.log(tr);
  const t6 = tr ** 6;
  return {
    f0: 5.92714 - 6.09648 / tr - 1.28862 * ln + 0.169347 * t6,
    f1: 15.2518 - 15.6875 / tr - 13.4721 * ln + 0.43577 * t6,
  };
}

/** Acentric factor from Tb (K), Tc (K) and pc (bar): the Lee–Kesler equation solved at 1 atm. */
export function acentricFactor(tb: number, tc: number, pc: number): number {
  const { f0, f1 } = leeKeslerTerms(tb / tc);
  return (Math.log(P_ATM_BAR / pc) - f0) / f1;
}

/** Vapour pressure in bar at T (K); null at or above the critical temperature. */
export function vapourPressure(T: number, tc: number, pc: number, omega: number): number | null {
  if (T <= 0 || T >= tc) return null;
  const { f0, f1 } = leeKeslerTerms(T / tc);
  return pc * Math.exp(f0 + omega * f1);
}

/** Enthalpy of vaporisation (kJ/mol) at T from its value at Tb (Watson scaling); 0 at Tc. */
export function watsonHvap(T: number, tb: number, tc: number, hvapTb: number): number | null {
  if (T >= tc) return 0;
  if (T <= 0 || tb >= tc) return null;
  return hvapTb * Math.pow((1 - T / tc) / (1 - tb / tc), 0.38);
}

/**
 * Temperature (K) at which the vapour pressure equals p (bar): the boiling point under vacuum or
 * pressure. Null when p is not below the critical pressure (no liquid–vapour boundary there).
 */
export function boilingPointAtPressure(p: number, tc: number, pc: number, omega: number): number | null {
  if (!(p > 0) || p >= pc) return null;
  let lo = 0.15 * tc;
  let hi = tc;
  const target = Math.log(p / pc);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const { f0, f1 } = leeKeslerTerms(mid / tc);
    if (f0 + omega * f1 < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface PhaseInputs {
  /** Normal boiling point, K. */
  tb: number;
  /** Critical temperature, K. */
  tc: number;
  /** Critical pressure, bar. */
  pc: number;
  /** Enthalpy of vaporisation at Tb, kJ/mol. */
  hvapTb: number;
  /** Melting point, K (null: no solid region is drawn). */
  tm?: number | null;
  /** Enthalpy of fusion, kJ/mol (null: sublimation line approximated by the extrapolated vapour curve). */
  hfus?: number | null;
  /** Liquid molar volume, cm³/mol (null: melting line drawn vertical). */
  molarVolume?: number | null;
}

export interface PhasePoint {
  /** K */
  T: number;
  /** bar */
  p: number;
}

export interface PhaseModel {
  omega: number;
  critical: PhasePoint;
  /** Triple point: T taken as the melting point, p from the vapour curve there. */
  triple: PhasePoint | null;
  /** Enthalpy of sublimation at the triple point, kJ/mol. */
  hsub: number | null;
  /** Slope of the melting line, K/bar. */
  meltingSlope: number | null;
  /** Liquid–vapour boundary from the triple point (or 0.4·Tc) to the critical point. */
  vapour: PhasePoint[];
  /** Solid–vapour boundary below the triple point. */
  sublimation: PhasePoint[];
  /** Solid–liquid boundary from the triple point upwards. */
  melting: PhasePoint[];
  /** Honest statements about what was assumed. */
  notes: string[];
}

export type PhaseName = "solid" | "liquid" | "gas" | "supercritical fluid";

function sublimationPressure(T: number, triple: PhasePoint, hsub: number): number {
  return triple.p * Math.exp((-(hsub * 1000) / R_GAS) * (1 / T - 1 / triple.T));
}

/** Build the boundaries of the P–T diagram. */
export function phaseModel(input: PhaseInputs, samples = 64): PhaseModel {
  const { tb, tc, pc, hvapTb } = input;
  const omega = acentricFactor(tb, tc, pc);
  const notes: string[] = [];
  const tm = input.tm ?? null;
  const hfus = input.hfus ?? null;
  const vm = input.molarVolume ?? null;
  let triple: PhasePoint | null = null;
  let hsub: number | null = null;
  if (tm !== null && tm > 0 && tm < tc) {
    const p = vapourPressure(tm, tc, pc, omega)!;
    triple = { T: tm, p };
    if (tm / tc < 0.3) notes.push("The melting point lies below 0.3·Tc, where the Lee–Kesler correlation is extrapolated; the triple-point pressure is only indicative.");
    const hvapTm = watsonHvap(tm, tb, tc, hvapTb) ?? hvapTb;
    if (hfus !== null) hsub = hfus + hvapTm;
    else notes.push("No enthalpy of fusion: the sublimation line is the vapour curve extrapolated below the melting point.");
  } else if (tm !== null) {
    notes.push("The melting-point estimate is not below the critical temperature, so no solid region is drawn.");
  } else {
    notes.push("No melting-point estimate: the solid region is not drawn.");
  }
  let meltingSlope: number | null = null;
  if (triple && hfus !== null && hfus > 0) {
    if (vm !== null && vm > 0) {
      // dT/dp = T·ΔV/ΔH with ΔVfus ≈ 0.1·Vm; units: K · cm³/mol / (kJ/mol) · bar → K/bar.
      meltingSlope = (triple.T * 0.1 * vm * 1e-4) / hfus;
      notes.push("Melting line: ΔVfus taken as 10 % of the molar volume (typical for organics; water-like negative slopes are not predicted).");
    } else {
      meltingSlope = 0;
      notes.push("Melting line drawn vertical (no molar volume for the Clapeyron slope).");
    }
  } else if (triple) {
    meltingSlope = 0;
  }
  const vapour: PhasePoint[] = [];
  const t0 = triple ? triple.T : 0.4 * tc;
  for (let i = 0; i <= samples; i++) {
    const T = t0 + ((tc - t0) * i) / samples;
    const p = i === samples ? pc : vapourPressure(T, tc, pc, omega)!;
    vapour.push({ T, p });
  }
  const sublimation: PhasePoint[] = [];
  const melting: PhasePoint[] = [];
  if (triple) {
    const tLow = 0.65 * triple.T;
    for (let i = 0; i <= 24; i++) {
      const T = tLow + ((triple.T - tLow) * i) / 24;
      const p = hsub !== null ? sublimationPressure(T, triple, hsub) : vapourPressure(T, tc, pc, omega)!;
      sublimation.push({ T, p });
    }
    const pTop = pc * 3;
    for (let i = 0; i <= 8; i++) {
      const p = triple.p + ((pTop - triple.p) * i) / 8;
      melting.push({ T: triple.T + (meltingSlope ?? 0) * (p - triple.p), p });
    }
  }
  if (tb / tc < 0.3 || tb / tc > 0.95) notes.push("Tb/Tc is outside the range where the Lee–Kesler acentric-factor estimate is reliable.");
  return { omega, critical: { T: tc, p: pc }, triple, hsub, meltingSlope, vapour, sublimation, melting, notes };
}

/** Which phase the model puts at (T in K, p in bar). */
export function phaseAt(model: PhaseModel, input: PhaseInputs, T: number, p: number): PhaseName {
  const { tc, pc } = input;
  if (T >= tc) return p >= pc ? "supercritical fluid" : "gas";
  if (model.triple) {
    const tMelt = model.triple.T + (model.meltingSlope ?? 0) * (p - model.triple.p);
    if (T < tMelt) {
      const pSub = model.hsub !== null ? sublimationPressure(T, model.triple, model.hsub) : vapourPressure(T, tc, pc, model.omega)!;
      return p >= pSub ? "solid" : "gas";
    }
  }
  const pv = vapourPressure(T, tc, pc, model.omega)!;
  return p >= pv ? "liquid" : "gas";
}

/** Pressure unit conversions to bar. */
export const PRESSURE_UNITS: Record<"bar" | "mbar" | "kPa" | "Torr" | "atm" | "psi", number> = {
  bar: 1,
  mbar: 1e-3,
  kPa: 1e-2,
  Torr: 1.01325 / 760,
  atm: 1.01325,
  psi: 0.0689476,
};
