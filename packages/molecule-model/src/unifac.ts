/**
 * Original UNIFAC (Fredenslund, Jones & Prausnitz, AIChE J. 21 (1975) 1086): activity coefficients
 * of a liquid mixture from group contributions. Combinatorial part from the group volumes R and
 * areas Q (Staverman–Guggenheim, z = 10), residual part from the main-group interaction parameters
 * a_mn (kelvin) through Ψ_mn = exp(−a_mn/T). Parameters and the fragmentation catalogue live in
 * `unifacData.ts`, generated from the published tables (see the header there).
 *
 * The group assignment of a molecule (which subgroups, how many) is not done here: it needs
 * substructure matching, which the chemistry engine provides (`apps/web/src/chemistry/unifacFragment.ts`).
 */
import { UNIFAC_INTERACTIONS, UNIFAC_MAIN_GROUPS, UNIFAC_SUBGROUPS } from "./unifacData";

/** Subgroup id → count. */
export type UnifacGroups = Record<number, number>;

const Z = 10;

/** Which main-group pairs among the components lack interaction parameters (empty: fully covered). */
export function unifacCoverage(components: UnifacGroups[]): { ok: boolean; missing: string[]; unknown: number[] } {
  const mains = new Set<number>();
  const unknown: number[] = [];
  for (const g of components) {
    for (const id of Object.keys(g).map(Number)) {
      const sg = UNIFAC_SUBGROUPS[id];
      if (!sg) unknown.push(id);
      else mains.add(sg.main);
    }
  }
  const missing: string[] = [];
  const list = [...mains];
  for (const m of list) for (const n of list) if (m !== n && UNIFAC_INTERACTIONS[`${m}-${n}`] === undefined) missing.push(`${UNIFAC_MAIN_GROUPS[m] ?? m} / ${UNIFAC_MAIN_GROUPS[n] ?? n}`);
  return { ok: unknown.length === 0 && missing.length === 0, missing: [...new Set(missing)], unknown };
}

/**
 * Activity coefficients γ_i of each component at mole fractions xs and temperature T (K).
 * Null when a subgroup is unknown or an interaction parameter is missing.
 */
export function unifacGammas(components: UnifacGroups[], xs: number[], T: number): number[] | null {
  const n = components.length;
  if (n === 0 || xs.length !== n || !unifacCoverage(components).ok) return null;
  const subIds = [...new Set(components.flatMap((g) => Object.keys(g).map(Number)))].sort((a, b) => a - b);
  const sub = subIds.map((id) => UNIFAC_SUBGROUPS[id]!);
  const nu = components.map((g) => subIds.map((id) => g[id] ?? 0));
  const r = nu.map((v) => v.reduce((s, c, k) => s + c * sub[k]!.R, 0));
  const q = nu.map((v) => v.reduce((s, c, k) => s + c * sub[k]!.Q, 0));

  // Combinatorial part, written without dividing by x_i so that x_i = 0 (infinite dilution) is fine.
  const sumXr = xs.reduce((s, x, i) => s + x * r[i]!, 0);
  const sumXq = xs.reduce((s, x, i) => s + x * q[i]!, 0);
  const l = r.map((ri, i) => (Z / 2) * (ri - q[i]!) - (ri - 1));
  const sumXl = xs.reduce((s, x, i) => s + x * l[i]!, 0);
  const lnGammaC = r.map((ri, i) => {
    const phiOverX = ri / sumXr;
    const thetaOverPhi = q[i]! / sumXq / phiOverX;
    return Math.log(phiOverX) + (Z / 2) * q[i]! * Math.log(thetaOverPhi) + l[i]! - phiOverX * sumXl;
  });

  // Residual part: group activity coefficients in the mixture and in each pure component.
  const psi = sub.map((a) => sub.map((b) => Math.exp(-(a.main === b.main ? 0 : (UNIFAC_INTERACTIONS[`${a.main}-${b.main}`] ?? 0)) / T)));
  const lnGammaGroups = (X: number[]): number[] => {
    const sumQX = X.reduce((s, x, k) => s + sub[k]!.Q * x, 0);
    const theta = X.map((x, k) => (sumQX > 0 ? (sub[k]!.Q * x) / sumQX : 0));
    const denom = sub.map((_, m) => theta.reduce((s, t, nn) => s + t * psi[nn]![m]!, 0));
    return sub.map((g, k) => {
      const first = theta.reduce((s, t, m) => s + t * psi[m]![k]!, 0);
      const second = sub.reduce((s, _, m) => s + (denom[m]! > 0 ? (theta[m]! * psi[k]![m]!) / denom[m]! : 0), 0);
      return g.Q * (1 - (first > 0 ? Math.log(first) : 0) - second);
    });
  };
  const totalGroups = xs.reduce((s, x, i) => s + x * nu[i]!.reduce((a, b) => a + b, 0), 0);
  const Xmix = sub.map((_, k) => xs.reduce((s, x, i) => s + x * nu[i]![k]!, 0) / totalGroups);
  const lnGmix = lnGammaGroups(Xmix);
  const lnGammaR = nu.map((v) => {
    const total = v.reduce((a, b) => a + b, 0);
    const lnGpure = lnGammaGroups(v.map((c) => c / total));
    return v.reduce((s, c, k) => s + c * (lnGmix[k]! - lnGpure[k]!), 0);
  });
  return lnGammaC.map((c, i) => Math.exp(c + lnGammaR[i]!));
}

/** Human-readable group list, e.g. "CH3 ×1, CH2 ×1, OH ×1". */
export function describeUnifacGroups(groups: UnifacGroups): string {
  return Object.entries(groups)
    .map(([id, count]) => `${UNIFAC_SUBGROUPS[Number(id)]?.name ?? id} ×${count}`)
    .join(", ");
}
