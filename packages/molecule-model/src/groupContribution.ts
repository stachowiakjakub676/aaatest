/**
 * Group-contribution estimates of bulk physical properties.
 *
 * Joback & Reid, Chem. Eng. Commun. 57 (1987) 233: normal boiling point, melting point,
 * critical constants, enthalpies of formation/vaporisation/fusion and ideal-gas heat capacity
 * from a fixed table of structural groups. Girolami, J. Chem. Educ. 71 (1994) 962: liquid
 * density from scaled atomic volumes.
 *
 * Everything here is an ESTIMATE from a published correlation, never a measurement. The
 * per-group breakdown is returned so the UI can show *why* the number comes out the way it
 * does (e.g. each extra CH2 adds 22.9 K to the Joback boiling point, an OH adds 92.9 K).
 */
import { getElement } from "./elements";
import { implicitHydrogenCount } from "./formula";
import { bondsOfAtom, getAtom, neighborsOf } from "./molecule";
import { bondInRing } from "./perception";
import type { AtomId, Molecule } from "./types";

export interface JobackGroup {
  id: string;
  label: string;
  tc: number;
  pc: number;
  vc: number | null;
  tb: number;
  tm: number | null;
  hf: number;
  gf: number | null;
  cpa: number | null;
  cpb: number | null;
  cpc: number | null;
  cpd: number | null;
  hfus: number | null;
  hvap: number;
}

const G = (id: string, label: string, v: Array<number | null>): JobackGroup => ({
  id,
  label,
  tc: v[0]!,
  pc: v[1]!,
  vc: v[2] ?? null,
  tb: v[3]!,
  tm: v[4] ?? null,
  hf: v[5]!,
  gf: v[6] ?? null,
  cpa: v[7] ?? null,
  cpb: v[8] ?? null,
  cpc: v[9] ?? null,
  cpd: v[10] ?? null,
  hfus: v[11] ?? null,
  hvap: v[12]!,
});

/** Joback table: Tc, Pc, Vc, Tb, Tm, Hf, Gf, Cp a b c d, Hfus, Hvap. */
export const JOBACK_GROUPS: Record<string, JobackGroup> = Object.fromEntries(
  [
    G("CH3", "−CH3", [0.0141, -0.0012, 65, 23.58, -5.1, -76.45, -43.96, 19.5, -8.08e-3, 1.53e-4, -9.67e-8, 0.908, 2.373]),
    G("CH2", "−CH2−", [0.0189, 0.0, 56, 22.88, 11.27, -20.64, 8.42, -0.909, 9.5e-2, -5.44e-5, 1.19e-8, 2.59, 2.226]),
    G("CH", ">CH−", [0.0164, 0.002, 41, 21.74, 12.64, 29.89, 58.36, -23.0, 2.04e-1, -2.65e-4, 1.2e-7, 0.749, 1.691]),
    G("C", ">C<", [0.0067, 0.0043, 27, 18.25, 46.43, 82.23, 116.02, -66.2, 4.27e-1, -6.41e-4, 3.01e-7, -1.46, 0.636]),
    G("=CH2", "=CH2", [0.0113, -0.0028, 56, 18.18, -4.32, -9.63, 3.77, 23.6, -3.81e-2, 1.72e-4, -1.03e-7, -0.473, 1.724]),
    G("=CH", "=CH−", [0.0129, -0.0006, 46, 24.96, 8.73, 37.97, 48.53, -8.0, 1.05e-1, -9.63e-5, 3.56e-8, 2.691, 2.205]),
    G("=C", "=C<", [0.0117, 0.0011, 38, 24.14, 11.14, 83.99, 92.36, -28.1, 2.08e-1, -3.06e-4, 1.46e-7, 3.063, 2.138]),
    G("=C=", "=C=", [0.0026, 0.0028, 36, 26.15, 17.78, 142.14, 136.7, 27.4, -5.57e-2, 1.01e-4, -5.02e-8, 4.72, 2.661]),
    G("#CH", "≡CH", [0.0027, -0.0008, 46, 9.2, -11.18, 79.3, 77.71, 24.5, -2.71e-2, 1.11e-4, -6.78e-8, 2.322, 1.155]),
    G("#C", "≡C−", [0.002, 0.0016, 37, 27.38, 64.32, 115.51, 109.82, 7.87, 2.01e-2, -8.33e-6, 1.39e-9, 4.151, 3.302]),
    G("rCH2", "−CH2− (ring)", [0.01, 0.0025, 48, 27.15, 7.75, -26.8, -3.68, -6.03, 8.54e-2, -8.0e-6, -1.8e-8, 0.49, 2.398]),
    G("rCH", ">CH− (ring)", [0.0122, 0.0004, 38, 21.78, 19.88, 8.67, 40.99, -20.5, 1.62e-1, -1.6e-4, 6.24e-8, 3.243, 1.942]),
    G("rC", ">C< (ring)", [0.0042, 0.0061, 27, 21.32, 60.15, 79.72, 87.88, -90.9, 5.57e-1, -9.0e-4, 4.69e-7, -1.373, 0.644]),
    G("r=CH", "=CH− (ring)", [0.0082, 0.0011, 41, 26.73, 8.13, 2.09, 11.3, -2.14, 5.74e-2, -1.64e-6, -1.59e-8, 1.101, 2.544]),
    G("r=C", "=C< (ring)", [0.0143, 0.0008, 32, 31.01, 37.02, 46.43, 54.05, -8.25, 1.01e-1, -1.42e-4, 6.78e-8, 2.394, 3.059]),
    G("F", "−F", [0.0111, -0.0057, 27, -0.03, -15.78, -251.92, -247.19, 26.5, -9.13e-2, 1.91e-4, -1.03e-7, 1.398, -0.67]),
    G("Cl", "−Cl", [0.0105, -0.0049, 58, 38.13, 13.55, -71.55, -64.31, 33.3, -9.63e-2, 1.87e-4, -9.96e-8, 2.515, 4.532]),
    G("Br", "−Br", [0.0133, 0.0057, 71, 66.86, 43.43, -29.48, -38.06, 28.6, -6.49e-2, 1.36e-4, -7.45e-8, 3.603, 6.582]),
    G("I", "−I", [0.0068, -0.0034, 97, 93.84, 41.69, 21.06, 5.74, 32.1, -6.41e-2, 1.26e-4, -6.87e-8, 2.724, 9.52]),
    G("OH", "−OH (alcohol)", [0.0741, 0.0112, 28, 92.88, 44.45, -208.04, -189.2, 25.7, -6.91e-2, 1.77e-4, -9.88e-8, 2.406, 16.826]),
    G("ArOH", "−OH (phenol)", [0.024, 0.0184, -25, 76.34, 82.83, -221.65, -197.37, -2.81, 1.11e-1, -1.16e-4, 4.94e-8, 4.49, 12.499]),
    G("O", "−O− (ether)", [0.0168, 0.0015, 18, 22.42, 22.23, -132.22, -105.0, 25.5, -6.32e-2, 1.11e-4, -5.48e-8, 1.188, 2.41]),
    G("rO", "−O− (ring)", [0.0098, 0.0048, 13, 31.22, 23.05, -138.16, -98.22, 12.2, -1.26e-2, 6.03e-5, -3.86e-8, 5.879, 4.682]),
    G("C=O", ">C=O (ketone)", [0.038, 0.0031, 62, 76.75, 61.2, -133.22, -120.5, 6.45, 6.7e-2, -3.57e-5, 2.86e-9, 4.189, 8.972]),
    G("rC=O", ">C=O (ring)", [0.0284, 0.0028, 55, 94.97, 75.97, -164.5, -126.27, 30.4, -8.29e-2, 2.36e-4, -1.31e-7, 0.0, 6.645]),
    G("CHO", "O=CH− (aldehyde)", [0.0379, 0.003, 82, 72.24, 36.9, -162.03, -143.48, 30.9, -3.36e-2, 1.6e-4, -9.88e-8, 3.197, 9.093]),
    G("COOH", "−COOH (acid)", [0.0791, 0.0077, 89, 169.09, 155.5, -426.72, -387.87, 24.1, 4.27e-2, 8.04e-5, -6.87e-8, 11.051, 19.537]),
    G("COO", "−COO− (ester)", [0.0481, 0.0005, 82, 81.1, 53.6, -337.92, -301.95, 24.5, 4.02e-2, 4.02e-5, -4.52e-8, 6.959, 9.633]),
    G("=O", "=O (other)", [0.0143, 0.0101, 36, -10.5, 2.08, -247.61, -250.83, 6.82, 1.96e-2, 1.27e-5, -1.78e-8, 3.624, 5.909]),
    G("NH2", "−NH2", [0.0243, 0.0109, 38, 73.23, 66.89, -22.02, 14.07, 26.9, -4.12e-2, 1.64e-4, -9.76e-8, 3.515, 10.788]),
    G("NH", ">NH", [0.0295, 0.0077, 35, 50.17, 52.66, 53.47, 89.39, -1.21, 7.62e-2, -4.86e-5, 1.05e-8, 5.099, 6.436]),
    G("rNH", ">NH (ring)", [0.013, 0.0114, 29, 52.82, 101.51, 31.65, 75.61, 11.8, -2.3e-2, 1.07e-4, -6.28e-8, 7.49, 6.93]),
    G("N", ">N−", [0.0169, 0.0074, 9, 11.74, 48.84, 123.34, 163.16, -31.1, 2.27e-1, -3.2e-4, 1.46e-7, 4.703, 1.896]),
    G("N=", "−N= (imine)", [0.0255, -0.0099, null, 74.6, null, 23.61, null, null, null, null, null, null, 3.335]),
    G("rN=", "−N= (ring)", [0.0085, 0.0076, 34, 57.55, 68.4, 55.52, 79.93, 8.83, -3.84e-3, 4.35e-5, -2.6e-8, 3.649, 6.528]),
    G("=NH", "=NH", [0.0, 0.0, null, 83.08, 68.91, 93.7, 119.66, 5.69, -4.12e-3, 1.28e-4, -8.88e-8, null, 12.169]),
    G("CN", "−C≡N", [0.0496, -0.0101, 91, 125.66, 59.89, 88.43, 89.22, 36.5, -7.33e-2, 1.84e-4, -1.03e-7, 2.414, 12.851]),
    G("NO2", "−NO2", [0.0437, 0.0064, 91, 152.54, 127.24, -66.57, -16.83, 25.9, -3.74e-3, 1.29e-4, -8.88e-8, 9.679, 16.738]),
    G("SH", "−SH", [0.0031, 0.0084, 63, 63.56, 20.09, -17.33, -22.99, 35.3, -7.58e-2, 1.85e-4, -1.03e-7, 2.36, 6.884]),
    G("S", "−S−", [0.0119, 0.0049, 54, 68.78, 34.4, 41.87, 33.12, 19.6, -5.61e-3, 4.02e-5, -2.76e-8, 4.13, 6.817]),
    G("rS", "−S− (ring)", [0.0019, 0.0051, 38, 52.1, 79.93, 39.1, 27.76, 16.7, 4.81e-3, 2.77e-5, -2.11e-8, 1.557, 5.984]),
  ].map((g) => [g.id, g]),
);

export interface GroupAssignment {
  groupId: string;
  label: string;
  count: number;
  /** Atoms covered by this group (one entry per occurrence, first atom of each). */
  atomIds: AtomId[];
}

export interface JobackResult {
  /** Assigned groups with counts. */
  groups: GroupAssignment[];
  /** Heavy atoms that no Joback group describes (estimates are then unavailable). */
  unassigned: AtomId[];
  /** Total atom count including implicit hydrogens (used for Pc). */
  atomCount: number;
  /** Estimates; null when the molecule is not covered. Temperatures in K, pressure in bar. */
  tb: number | null;
  tm: number | null;
  tc: number | null;
  pc: number | null;
  vc: number | null;
  hf: number | null;
  gf: number | null;
  hvap: number | null;
  hfus: number | null;
  /** Ideal-gas heat capacity at 298.15 K, J/(mol·K). */
  cp298: number | null;
  /** Per-property contribution of each group (same order as `groups`), for the breakdown UI. */
  contributions: Record<"tb" | "tm" | "hvap" | "hf", number[]>;
}

interface AtomInfo {
  id: AtomId;
  element: string;
  h: number;
  heavy: AtomId[];
  ring: boolean;
  aromatic: boolean;
  doubles: AtomId[];
  triples: AtomId[];
}

function describe(mol: Molecule, ringBonds: Set<string>): Map<AtomId, AtomInfo> {
  const out = new Map<AtomId, AtomInfo>();
  for (const a of mol.atoms) {
    if (a.element === "H") continue;
    const bonds = bondsOfAtom(mol, a.id);
    const other = (b: (typeof bonds)[number]) => (b.atomA === a.id ? b.atomB : b.atomA);
    const explicitH = neighborsOf(mol, a.id).filter((n) => getAtom(mol, n)?.element === "H").length;
    out.set(a.id, {
      id: a.id,
      element: a.element,
      h: explicitH + implicitHydrogenCount(mol, a.id),
      heavy: bonds.map(other).filter((n) => getAtom(mol, n)?.element !== "H"),
      ring: bonds.some((b) => ringBonds.has(b.id)),
      aromatic: bonds.some((b) => b.order === "aromatic"),
      doubles: bonds.filter((b) => b.order === "double").map(other),
      triples: bonds.filter((b) => b.order === "triple").map(other),
    });
  }
  return out;
}

/**
 * Assign Joback groups to every heavy atom. Functional groups that Joback treats as one unit
 * (−COOH, −COO−, −CHO, >C=O, −CN, −NO2) consume their oxygen/nitrogen atoms.
 */
export function assignJobackGroups(mol: Molecule): { groups: GroupAssignment[]; unassigned: AtomId[]; atomCount: number } {
  const ringBonds = new Set(mol.bonds.filter((b) => bondInRing(mol, b.id)).map((b) => b.id));
  const info = describe(mol, ringBonds);
  const used = new Set<AtomId>();
  const found = new Map<string, AtomId[]>();
  const unassigned: AtomId[] = [];
  const put = (gid: string, atom: AtomId, ...consumed: AtomId[]) => {
    if (!JOBACK_GROUPS[gid]) throw new Error(`unknown Joback group ${gid}`);
    found.set(gid, [...(found.get(gid) ?? []), atom]);
    used.add(atom);
    for (const c of consumed) used.add(c);
  };
  const el = (id: AtomId) => info.get(id)?.element ?? "H";

  // Pass 1: multi-atom groups centred on carbon / nitrogen.
  for (const a of info.values()) {
    if (used.has(a.id)) continue;
    if (a.element === "C") {
      const dO = a.doubles.filter((n) => el(n) === "O" && info.get(n)!.heavy.length === 1);
      if (dO.length === 1) {
        const o = dO[0]!;
        const sO = a.heavy.filter((n) => n !== o && el(n) === "O" && !a.doubles.includes(n));
        if (sO.length >= 1) {
          const ox = info.get(sO[0]!)!;
          if (ox.h >= 1 && ox.heavy.length === 1) put("COOH", a.id, o, ox.id);
          else put("COO", a.id, o, ox.id);
          continue;
        }
        if (a.h >= 1) {
          put("CHO", a.id, o);
          continue;
        }
        put(a.ring ? "rC=O" : "C=O", a.id, o);
        continue;
      }
      const tN = a.triples.filter((n) => el(n) === "N" && info.get(n)!.heavy.length === 1);
      if (tN.length === 1) {
        put("CN", a.id, tN[0]!);
        continue;
      }
    } else if (a.element === "N") {
      const os = a.heavy.filter((n) => el(n) === "O" && info.get(n)!.heavy.length === 1);
      if (os.length === 2 && a.heavy.length === 3) {
        put("NO2", a.id, ...os);
        continue;
      }
    }
  }

  // Pass 2: single-atom groups.
  for (const a of info.values()) {
    if (used.has(a.id)) continue;
    const nDouble = a.doubles.length + (a.aromatic ? 1 : 0);
    const nTriple = a.triples.length;
    switch (a.element) {
      case "C": {
        if (nTriple >= 1) put(a.h >= 1 ? "#CH" : "#C", a.id);
        else if (nDouble >= 2 && !a.aromatic) put("=C=", a.id);
        else if (nDouble >= 1) put(a.h >= 2 ? "=CH2" : a.h === 1 ? (a.ring ? "r=CH" : "=CH") : a.ring ? "r=C" : "=C", a.id);
        else put(a.h >= 3 ? "CH3" : a.h === 2 ? (a.ring ? "rCH2" : "CH2") : a.h === 1 ? (a.ring ? "rCH" : "CH") : a.ring ? "rC" : "C", a.id);
        break;
      }
      case "O": {
        if (a.doubles.length >= 1 || a.aromatic) put(a.aromatic ? "rO" : "=O", a.id);
        else if (a.h >= 1 && a.heavy.length === 1) put(info.get(a.heavy[0]!)?.aromatic ? "ArOH" : "OH", a.id);
        else if (a.heavy.length === 2) put(a.ring ? "rO" : "O", a.id);
        else unassigned.push(a.id);
        break;
      }
      case "N": {
        if (a.triples.length >= 1) unassigned.push(a.id);
        else if (a.aromatic) put(a.h >= 1 ? "rNH" : a.heavy.length === 3 ? "N" : "rN=", a.id);
        else if (a.doubles.length >= 1) put(a.h >= 1 ? "=NH" : a.ring ? "rN=" : "N=", a.id);
        else if (a.h >= 2) put("NH2", a.id);
        else if (a.h === 1) put(a.ring ? "rNH" : "NH", a.id);
        else put("N", a.id);
        break;
      }
      case "S": {
        if (a.doubles.length >= 1 || a.heavy.length > 2) unassigned.push(a.id);
        else if (a.h >= 1 && a.heavy.length === 1) put("SH", a.id);
        else if (a.heavy.length === 2) put(a.ring || a.aromatic ? "rS" : "S", a.id);
        else unassigned.push(a.id);
        break;
      }
      case "F":
      case "Cl":
      case "Br":
      case "I":
        if (a.heavy.length === 1) put(a.element, a.id);
        else unassigned.push(a.id);
        break;
      default:
        unassigned.push(a.id);
    }
  }

  const groups = [...found].map(([groupId, atomIds]) => ({ groupId, label: JOBACK_GROUPS[groupId]!.label, count: atomIds.length, atomIds })).sort((x, y) => y.count - x.count || x.groupId.localeCompare(y.groupId));
  const atomCount = mol.atoms.length + mol.atoms.reduce((s, a) => s + (a.element === "H" ? 0 : implicitHydrogenCount(mol, a.id)), 0);
  return { groups, unassigned, atomCount };
}

/** Joback estimates for the whole molecule. Returns nulls when a heavy atom is not covered. */
export function jobackEstimates(mol: Molecule): JobackResult {
  const { groups, unassigned, atomCount } = assignJobackGroups(mol);
  const heavy = mol.atoms.filter((a) => a.element !== "H").length;
  const empty: JobackResult = { groups, unassigned, atomCount, tb: null, tm: null, tc: null, pc: null, vc: null, hf: null, gf: null, hvap: null, hfus: null, cp298: null, contributions: { tb: [], tm: [], hvap: [], hf: [] } };
  if (heavy === 0 || unassigned.length > 0 || groups.length === 0) return empty;
  const sum = (key: keyof JobackGroup): number | null => {
    let s = 0;
    for (const g of groups) {
      const v = JOBACK_GROUPS[g.groupId]![key];
      if (v === null || typeof v !== "number") return null;
      s += v * g.count;
    }
    return s;
  };
  const stb = sum("tb")!;
  const stc = sum("tc")!;
  const spc = sum("pc")!;
  const tb = 198.2 + stb;
  const stm = sum("tm");
  const tm = stm === null ? null : 122.5 + stm;
  const tc = tb / (0.584 + 0.965 * stc - stc * stc);
  const pc = Math.pow(0.113 + 0.0032 * atomCount - spc, -2);
  const svc = sum("vc");
  const vc = svc === null ? null : 17.5 + svc;
  const hf = 68.29 + sum("hf")!;
  const sgf = sum("gf");
  const gf = sgf === null ? null : 53.88 + sgf;
  const hvap = 15.3 + sum("hvap")!;
  const shfus = sum("hfus");
  const hfus = shfus === null ? null : -0.88 + shfus;
  const a = sum("cpa");
  const b = sum("cpb");
  const c = sum("cpc");
  const d = sum("cpd");
  const T = 298.15;
  const cp298 = a === null || b === null || c === null || d === null ? null : a - 37.93 + (b + 0.21) * T + (c - 3.91e-4) * T * T + (d + 2.06e-7) * T * T * T;
  const contrib = (key: "tb" | "tm" | "hvap" | "hf") => groups.map((g) => ((JOBACK_GROUPS[g.groupId]![key] as number | null) ?? 0) * g.count);
  return { groups, unassigned, atomCount, tb, tm, tc, pc, vc, hf, gf, hvap, hfus, cp298, contributions: { tb: contrib("tb"), tm: contrib("tm"), hvap: contrib("hvap"), hf: contrib("hf") } };
}

/** Girolami scaled atomic volumes by period. */
function girolamiVolume(symbol: string): number | null {
  if (symbol === "H") return 1;
  const e = getElement(symbol);
  if (!e) return null;
  const z = e.atomicNumber;
  if (z >= 3 && z <= 9) return 2;
  if (z >= 11 && z <= 17) return 4;
  if (z >= 19 && z <= 35) return 5;
  if (z >= 37 && z <= 53) return 6;
  if (z >= 55 && z <= 83) return 7;
  return null;
}

export interface DensityEstimate {
  /** g/cm³ at room temperature, for a liquid or solid. */
  density: number;
  scaledVolume: number;
  molarMass: number;
  /** Girolami corrections applied (each +10 %, capped at +30 %). */
  corrections: string[];
}

/**
 * Girolami (1994): ρ = M / (5·Vs), Vs from scaled atomic volumes (H 1, Li–F 2, Na–Cl 4, K–Br 5,
 * Rb–I 6, Cs–Bi 7); +10 % for each hydroxyl, carboxylic acid, primary/secondary amine, amide,
 * sulfoxide or sulfone group, up to +30 % (the fused-ring correction is not applied). Typical
 * error ≈ 0.02–0.1 g/cm³.
 */
export function girolamiDensity(mol: Molecule, molarMass: number): DensityEstimate | null {
  let vs = 0;
  for (const a of mol.atoms) {
    const v = girolamiVolume(a.element);
    if (v === null) return null;
    vs += v;
    if (a.element !== "H") vs += implicitHydrogenCount(mol, a.id);
  }
  if (vs === 0) return null;
  const corrections: string[] = [];
  const isH = (id: AtomId) => getAtom(mol, id)?.element === "H";
  const hCount = (id: AtomId) => neighborsOf(mol, id).filter(isH).length + implicitHydrogenCount(mol, id);
  for (const a of mol.atoms) {
    const heavy = neighborsOf(mol, a.id).filter((n) => !isH(n));
    if (a.element === "O" && hCount(a.id) >= 1 && heavy.length <= 1) {
      const c = heavy[0] ? getAtom(mol, heavy[0]) : undefined;
      const acid = c?.element === "C" && bondsOfAtom(mol, c.id).some((b) => b.order === "double" && getAtom(mol, b.atomA === c.id ? b.atomB : b.atomA)?.element === "O");
      corrections.push(acid ? "carboxylic acid" : "hydroxyl");
    } else if (a.element === "N" && hCount(a.id) >= 1 && bondsOfAtom(mol, a.id).every((b) => b.order === "single")) {
      const amide = heavy.some((n) => getAtom(mol, n)?.element === "C" && bondsOfAtom(mol, n).some((b) => b.order === "double" && getAtom(mol, b.atomA === n ? b.atomB : b.atomA)?.element === "O"));
      corrections.push(amide ? "amide" : "amine (N–H)");
    } else if (a.element === "S") {
      const dO = bondsOfAtom(mol, a.id).filter((b) => b.order === "double" && getAtom(mol, b.atomA === a.id ? b.atomB : b.atomA)?.element === "O").length;
      if (dO === 1) corrections.push("sulfoxide");
      else if (dO === 2) corrections.push("sulfone");
    }
  }
  const factor = Math.min(1.3, 1 + 0.1 * corrections.length);
  return { density: (molarMass / (5 * vs)) * factor, scaledVolume: vs, molarMass, corrections };
}
