/**
 * Hansen solubility parameters by group contribution, and a solvent table to match them against.
 *
 * Hoftyzer & Van Krevelen method (Van Krevelen & Te Nijenhuis, Properties of Polymers, 4th ed.,
 * 2009, ch. 7, table 7.10): δd = ΣFd/V, δp = √(ΣFp²)/V, δh = √(ΣEh/V), with Fd, Fp in
 * (J·cm³)^½/mol, Eh in J/mol and V the molar volume in cm³/mol. When several identical polar
 * groups sit on one carbon the book halves Fp for one plane of symmetry, quarters it for two and
 * drops it for more; here that is applied per carbon (2 groups ×0.5, 3 ×0.25, 4+ ×0). Typical
 * error of the method is 1–2 MPa^½ per component; δh is the least reliable.
 *
 * Solvent parameters are Hansen's own values (Hansen, Hansen Solubility Parameters: A User's
 * Handbook, 2nd ed., 2007, appendix A). The greenness class follows the CHEM21 selection guide
 * (Prat et al., Green Chem. 18 (2016) 288, table 1), transcribed here: check the source before
 * relying on a class for a decision.
 */
import { implicitHydrogenCount } from "./formula";
import { bondsOfAtom, getAtom, neighborsOf } from "./molecule";
import { bondInRing, findCycles } from "./perception";
import type { AtomId, Molecule } from "./types";

export interface HansenGroup {
  id: string;
  label: string;
  fd: number;
  fp: number;
  eh: number;
}

const H = (id: string, label: string, fd: number, fp: number, eh: number): HansenGroup => ({ id, label, fd, fp, eh });

/** Hoftyzer–Van Krevelen group values (Fd, Fp, Eh). A dash in the book is entered as 0. */
export const HANSEN_GROUPS: Record<string, HansenGroup> = Object.fromEntries(
  [
    H("CH3", "−CH3", 420, 0, 0),
    H("CH2", "−CH2−", 270, 0, 0),
    H("CH", ">CH−", 80, 0, 0),
    H("C", ">C<", -70, 0, 0),
    H("=CH2", "=CH2", 400, 0, 0),
    H("=CH", "=CH−", 200, 0, 0),
    H("=C", "=C<", 70, 0, 0),
    H("ring", "aliphatic ring", 190, 0, 0),
    H("Ph1", "phenyl (C6H5)", 1430, 110, 0),
    H("Ph2", "phenylene (C6H4)", 1270, 110, 0),
    H("Ph3", "phenyl, trisubstituted (C6H3)", 1110, 110, 0),
    H("Ph4", "phenyl, tetrasubstituted (extrapolated)", 950, 110, 0),
    H("Ph5", "phenyl, pentasubstituted (extrapolated)", 790, 110, 0),
    H("Ph6", "phenyl, hexasubstituted (extrapolated)", 630, 110, 0),
    H("F", "−F", 220, 0, 0),
    H("Cl", "−Cl", 450, 550, 400),
    H("Br", "−Br", 550, 0, 0),
    H("CN", "−C≡N", 430, 1100, 2500),
    H("OH", "−OH", 210, 500, 20000),
    H("O", "−O−", 100, 400, 3000),
    H("CHO", "−CHO", 470, 800, 4500),
    H("C=O", ">C=O", 290, 770, 2000),
    H("COOH", "−COOH", 530, 420, 10000),
    H("COO", "−COO−", 390, 490, 7000),
    H("NH2", "−NH2", 280, 0, 8400),
    H("NH", ">NH", 160, 210, 3100),
    H("N", ">N−", 20, 800, 5000),
    H("NO2", "−NO2", 500, 1070, 1500),
    H("S", "−S−", 440, 0, 0),
  ].map((g) => [g.id, g]),
);

export interface HansenAssignment {
  groupId: string;
  label: string;
  count: number;
  atomIds: AtomId[];
  /** Symmetry factor applied to Fp for this group's occurrences (1 unless identical polar groups share a carbon). */
  polarFactor: number;
}

/** Six-membered carbocyclic aromatic rings (explicit aromatic bonds or a Kekulé pattern). */
function benzeneRings(mol: Molecule): AtomId[][] {
  const out: AtomId[][] = [];
  for (const cycle of findCycles(mol, 6)) {
    if (!cycle.every((id) => getAtom(mol, id)?.element === "C")) continue;
    const bonds = cycle.map((id, i) => mol.bonds.find((b) => (b.atomA === id && b.atomB === cycle[(i + 1) % 6]) || (b.atomB === id && b.atomA === cycle[(i + 1) % 6]))!);
    const arom = bonds.every((b) => b.order === "aromatic");
    const kekule = bonds.filter((b) => b.order === "double").length === 3 && bonds.every((b, i) => b.order !== "double" || bonds[(i + 1) % 6]!.order !== "double");
    if (arom || kekule) out.push(cycle);
  }
  return out;
}

export function assignHansenGroups(mol: Molecule): { groups: HansenAssignment[]; unassigned: AtomId[] } {
  const used = new Set<AtomId>();
  const found = new Map<string, { atoms: AtomId[]; factors: number[] }>();
  const unassigned: AtomId[] = [];
  const put = (gid: string, atom: AtomId, factor = 1, ...consumed: AtomId[]) => {
    const e = found.get(gid) ?? { atoms: [], factors: [] };
    e.atoms.push(atom);
    e.factors.push(factor);
    found.set(gid, e);
    used.add(atom);
    for (const c of consumed) used.add(c);
  };
  const isH = (id: AtomId) => getAtom(mol, id)?.element === "H";
  const el = (id: AtomId) => getAtom(mol, id)?.element ?? "H";
  const heavy = (id: AtomId) => neighborsOf(mol, id).filter((n) => !isH(n));
  const hCount = (id: AtomId) => neighborsOf(mol, id).filter(isH).length + implicitHydrogenCount(mol, id);
  const dbl = (id: AtomId) => bondsOfAtom(mol, id).filter((b) => b.order === "double").map((b) => (b.atomA === id ? b.atomB : b.atomA));
  const tpl = (id: AtomId) => bondsOfAtom(mol, id).filter((b) => b.order === "triple").map((b) => (b.atomA === id ? b.atomB : b.atomA));
  const aromaticBond = (id: AtomId) => bondsOfAtom(mol, id).some((b) => b.order === "aromatic");

  // Benzene rings as one group each, by substitution count (fused rings share atoms: not covered).
  const rings = benzeneRings(mol);
  const ringAtoms = new Set<AtomId>();
  for (const ring of rings) {
    if (ring.some((id) => ringAtoms.has(id))) {
      for (const id of ring) if (!ringAtoms.has(id)) unassigned.push(id);
      for (const id of ring) ringAtoms.add(id);
      continue;
    }
    const subs = ring.reduce((s, id) => s + heavy(id).filter((n) => !ring.includes(n)).length, 0);
    const gid = subs <= 1 ? "Ph1" : `Ph${Math.min(6, subs)}`;
    put(gid, ring[0]!, 1, ...ring.slice(1));
    for (const id of ring) ringAtoms.add(id);
  }

  // Multi-atom groups centred on carbon or nitrogen.
  for (const a of mol.atoms) {
    if (a.element === "H" || used.has(a.id)) continue;
    if (a.element === "C") {
      const dO = dbl(a.id).filter((n) => el(n) === "O" && heavy(n).length === 1);
      if (dO.length === 1) {
        const o = dO[0]!;
        const sO = heavy(a.id).filter((n) => n !== o && el(n) === "O" && !dbl(a.id).includes(n));
        if (sO.length >= 1) {
          const ox = sO[0]!;
          if (hCount(ox) >= 1 && heavy(ox).length === 1) put("COOH", a.id, 1, o, ox);
          else put("COO", a.id, 1, o, ox);
          continue;
        }
        if (hCount(a.id) >= 1) put("CHO", a.id, 1, o);
        else put("C=O", a.id, 1, o);
        continue;
      }
      const tN = tpl(a.id).filter((n) => el(n) === "N" && heavy(n).length === 1);
      if (tN.length === 1) {
        put("CN", a.id, 1, tN[0]!);
        continue;
      }
    } else if (a.element === "N") {
      const os = heavy(a.id).filter((n) => el(n) === "O" && heavy(n).length === 1);
      if (os.length === 2 && heavy(a.id).length === 3) put("NO2", a.id, 1, ...os);
    }
  }

  // Single-atom groups; halogens get the symmetry factor when they share a carbon.
  for (const a of mol.atoms) {
    if (a.element === "H" || used.has(a.id)) continue;
    const h = hCount(a.id);
    const nd = dbl(a.id).length;
    switch (a.element) {
      case "C": {
        if (aromaticBond(a.id) || tpl(a.id).length > 0 || nd >= 2) unassigned.push(a.id);
        else if (nd === 1) put(h >= 2 ? "=CH2" : h === 1 ? "=CH" : "=C", a.id);
        else put(h >= 3 ? "CH3" : h === 2 ? "CH2" : h === 1 ? "CH" : "C", a.id);
        break;
      }
      case "O": {
        if (nd >= 1 || aromaticBond(a.id)) unassigned.push(a.id);
        else if (h >= 1 && heavy(a.id).length === 1) put("OH", a.id);
        else if (heavy(a.id).length === 2) put("O", a.id);
        else unassigned.push(a.id);
        break;
      }
      case "N": {
        if (nd >= 1 || tpl(a.id).length > 0 || aromaticBond(a.id)) unassigned.push(a.id);
        else if (h >= 2) put("NH2", a.id);
        else if (h === 1) put("NH", a.id);
        else put("N", a.id);
        break;
      }
      case "S": {
        if (nd === 0 && heavy(a.id).length === 2 && h === 0) put("S", a.id);
        else unassigned.push(a.id);
        break;
      }
      case "F":
      case "Cl":
      case "Br": {
        const c = heavy(a.id)[0];
        if (heavy(a.id).length !== 1 || c === undefined) {
          unassigned.push(a.id);
          break;
        }
        const same = heavy(c).filter((n) => el(n) === a.element).length;
        put(a.element, a.id, same >= 4 ? 0 : same === 3 ? 0.25 : same === 2 ? 0.5 : 1);
        break;
      }
      default:
        unassigned.push(a.id);
    }
  }

  // Aliphatic rings: cyclomatic number minus the benzene rings, each +190 to Fd.
  const cyclomatic = mol.bonds.filter((b) => bondInRing(mol, b.id)).length > 0 ? mol.bonds.length - mol.atoms.length + components(mol) : 0;
  const aliphaticRings = Math.max(0, cyclomatic - rings.length);
  const groups: HansenAssignment[] = [...found].map(([groupId, e]) => ({ groupId, label: HANSEN_GROUPS[groupId]!.label, count: e.atoms.length, atomIds: e.atoms, polarFactor: e.factors.reduce((s, f) => s + f, 0) / e.factors.length }));
  if (aliphaticRings > 0 && unassigned.length === 0) groups.push({ groupId: "ring", label: HANSEN_GROUPS.ring!.label, count: aliphaticRings, atomIds: [], polarFactor: 1 });
  groups.sort((x, y) => y.count - x.count || x.groupId.localeCompare(y.groupId));
  return { groups, unassigned };
}

function components(mol: Molecule): number {
  const seen = new Set<AtomId>();
  let n = 0;
  for (const a of mol.atoms) {
    if (seen.has(a.id)) continue;
    n++;
    const stack = [a.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...neighborsOf(mol, id));
    }
  }
  return n;
}

export interface HansenTriple {
  /** Dispersion, MPa^½. */
  dd: number;
  /** Polar, MPa^½. */
  dp: number;
  /** Hydrogen bonding, MPa^½. */
  dh: number;
}

export interface HansenEstimate extends HansenTriple {
  /** Total (Hildebrand) parameter √(δd²+δp²+δh²). */
  dt: number;
  molarVolume: number;
  groups: HansenAssignment[];
  /** Per-group Fd, Fp (after the symmetry factor) and Eh sums, same order as `groups`. */
  contributions: Array<{ fd: number; fp: number; eh: number }>;
  notes: string[];
}

/** Hansen parameters from the group table and a liquid molar volume (cm³/mol). Null when a heavy atom is not covered. */
export function hansenParameters(mol: Molecule, molarVolume: number): HansenEstimate | null {
  const { groups, unassigned } = assignHansenGroups(mol);
  if (unassigned.length > 0 || groups.length === 0 || !(molarVolume > 0)) return null;
  const contributions = groups.map((g) => {
    const t = HANSEN_GROUPS[g.groupId]!;
    return { fd: t.fd * g.count, fp: t.fp * g.polarFactor, eh: t.eh * g.count };
  });
  // Fp enters as a root-sum-square over occurrences; each occurrence carries its own factor.
  let fp2 = 0;
  groups.forEach((g, i) => {
    const t = HANSEN_GROUPS[g.groupId]!;
    fp2 += g.count * (t.fp * g.polarFactor) ** 2;
    contributions[i]!.fp = Math.sqrt(g.count) * t.fp * g.polarFactor;
  });
  const fd = contributions.reduce((s, c) => s + c.fd, 0);
  const eh = contributions.reduce((s, c) => s + c.eh, 0);
  const dd = fd / molarVolume;
  const dp = Math.sqrt(fp2) / molarVolume;
  const dh = Math.sqrt(Math.max(0, eh) / molarVolume);
  const notes: string[] = [];
  if (groups.some((g) => g.groupId === "Ph1" && g.atomIds.length && mol.atoms.length <= 12)) notes.push("An unsubstituted benzene ring uses the phenyl value; the method underestimates δd for benzene itself.");
  if (groups.some((g) => g.polarFactor < 1)) notes.push("Identical halogens on one carbon: Fp reduced by the symmetry rule (×0.5 for two, ×0.25 for three, 0 for four).");
  if (groups.some((g) => ["Br", "NH2", "S", "F"].includes(g.groupId))) notes.push("The table gives no polar term for F, Br, NH2 or S (entered as 0), so δp is a lower bound for those groups.");
  if (groups.some((g) => g.groupId.startsWith("Ph") && Number(g.groupId[2]) >= 4)) notes.push("Phenyl with four or more substituents: value extrapolated from the C6H5/C6H4/C6H3 trend.");
  return { dd, dp, dh, dt: Math.sqrt(dd * dd + dp * dp + dh * dh), molarVolume, groups, contributions, notes };
}

/** Hansen distance Ra = √(4Δδd² + Δδp² + Δδh²), MPa^½. */
export function hansenDistance(a: HansenTriple, b: HansenTriple): number {
  return Math.sqrt(4 * (a.dd - b.dd) ** 2 + (a.dp - b.dp) ** 2 + (a.dh - b.dh) ** 2);
}

export type Chem21Class = "recommended" | "problematic" | "hazardous" | "highly hazardous";

export interface Solvent extends HansenTriple {
  id: string;
  /** Structure, so the same estimators that run on the drawn molecule can run on the solvent. */
  smiles: string;
  /** g/mol */
  molarMass: number;
  name: string;
  /** Normal boiling point, °C. */
  bp: number;
  chem21: Chem21Class;
  /** Main reason for a non-recommended class (short, from the guide's criteria). */
  note?: string;
}

const S = (id: string, smiles: string, molarMass: number, name: string, dd: number, dp: number, dh: number, bp: number, chem21: Chem21Class, note?: string): Solvent => (note === undefined ? { id, smiles, molarMass, name, dd, dp, dh, bp, chem21 } : { id, smiles, molarMass, name, dd, dp, dh, bp, chem21, note });

export const SOLVENTS: readonly Solvent[] = [
  S("water", "O", 18.015, "Water", 15.5, 16.0, 42.3, 100, "recommended"),
  S("ethanol", "CCO", 46.07, "Ethanol", 15.8, 8.8, 19.4, 78.4, "recommended"),
  S("2-propanol", "CC(C)O", 60.1, "2-Propanol", 15.8, 6.1, 16.4, 82.6, "recommended"),
  S("1-butanol", "CCCCO", 74.12, "1-Butanol", 16.0, 5.7, 15.8, 117.7, "recommended"),
  S("ethyl-acetate", "CCOC(C)=O", 88.11, "Ethyl acetate", 15.8, 5.3, 7.2, 77.1, "recommended"),
  S("isopropyl-acetate", "CC(C)OC(C)=O", 102.13, "Isopropyl acetate", 14.9, 4.5, 8.2, 88.6, "recommended"),
  S("butyl-acetate", "CCCCOC(C)=O", 116.16, "n-Butyl acetate", 15.8, 3.7, 6.3, 126.1, "recommended"),
  S("anisole", "COc1ccccc1", 108.14, "Anisole", 17.8, 4.4, 6.9, 153.7, "recommended"),
  S("sulfolane", "O=S1(=O)CCCC1", 120.17, "Sulfolane", 20.3, 18.2, 10.9, 285, "recommended"),
  S("methanol", "CO", 32.04, "Methanol", 15.1, 12.3, 22.3, 64.7, "problematic", "acute toxicity"),
  S("tert-butanol", "CC(C)(C)O", 74.12, "tert-Butanol", 15.2, 5.1, 14.7, 82.4, "problematic", "low flash point"),
  S("benzyl-alcohol", "OCc1ccccc1", 108.14, "Benzyl alcohol", 18.4, 6.3, 13.7, 205.3, "problematic", "high boiling point"),
  S("ethylene-glycol", "OCCO", 62.07, "Ethylene glycol", 17.0, 11.0, 26.0, 197.3, "problematic", "high boiling point"),
  S("acetone", "CC(C)=O", 58.08, "Acetone", 15.5, 10.4, 7.0, 56.1, "problematic", "low flash point"),
  S("mek", "CCC(C)=O", 72.11, "2-Butanone (MEK)", 16.0, 9.0, 5.1, 79.6, "problematic", "low flash point"),
  S("mibk", "CC(C)CC(C)=O", 100.16, "Methyl isobutyl ketone", 15.3, 6.1, 4.1, 116.5, "problematic", "flammability"),
  S("cyclohexanone", "O=C1CCCCC1", 98.14, "Cyclohexanone", 17.8, 6.3, 5.1, 155.6, "problematic", "high boiling point"),
  S("methyl-acetate", "COC(C)=O", 74.08, "Methyl acetate", 15.5, 7.2, 7.6, 56.9, "problematic", "low flash point"),
  S("acetic-acid", "CC(O)=O", 60.05, "Acetic acid", 14.5, 8.0, 13.5, 117.9, "problematic", "corrosive"),
  S("acetic-anhydride", "CC(=O)OC(C)=O", 102.09, "Acetic anhydride", 16.0, 11.7, 10.2, 139.8, "problematic", "corrosive"),
  S("thf", "C1CCOC1", 72.11, "Tetrahydrofuran", 16.8, 5.7, 8.0, 66, "problematic", "peroxide formation, low flash point"),
  S("2-methf", "CC1CCCO1", 86.13, "2-Methyltetrahydrofuran", 16.9, 5.0, 4.3, 80.2, "problematic", "peroxide formation"),
  S("heptane", "CCCCCCC", 100.2, "Heptane", 15.3, 0.0, 0.0, 98.4, "problematic", "flammability"),
  S("methylcyclohexane", "CC1CCCCC1", 98.19, "Methylcyclohexane", 16.0, 0.0, 1.0, 100.9, "problematic", "flammability"),
  S("toluene", "Cc1ccccc1", 92.14, "Toluene", 18.0, 1.4, 2.0, 110.6, "problematic", "reproductive toxicity concern"),
  S("xylene", "Cc1ccccc1C", 106.17, "Xylenes", 17.8, 1.0, 3.1, 139, "problematic", "flammability, toxicity"),
  S("chlorobenzene", "Clc1ccccc1", 112.56, "Chlorobenzene", 19.0, 4.3, 2.0, 131.7, "problematic", "halogenated, aquatic toxicity"),
  S("acetonitrile", "CC#N", 41.05, "Acetonitrile", 15.3, 18.0, 6.1, 81.6, "problematic", "toxicity"),
  S("dmso", "CS(C)=O", 78.13, "Dimethyl sulfoxide", 18.4, 16.4, 10.2, 189, "problematic", "high boiling point"),
  S("mtbe", "COC(C)(C)C", 88.15, "MTBE", 15.2, 3.4, 5.0, 55.2, "hazardous", "low flash point, groundwater contaminant"),
  S("cyclohexane", "C1CCCCC1", 84.16, "Cyclohexane", 16.8, 0.0, 0.2, 80.7, "hazardous", "flammability, aquatic toxicity"),
  S("dcm", "ClCCl", 84.93, "Dichloromethane", 17.0, 7.3, 7.1, 39.6, "hazardous", "suspected carcinogen, volatile halogenated"),
  S("formic-acid", "OC=O", 46.03, "Formic acid", 14.3, 11.9, 16.6, 100.8, "hazardous", "corrosive"),
  S("pyridine", "c1ccncc1", 79.1, "Pyridine", 19.0, 8.8, 5.9, 115.2, "hazardous", "toxicity, low flash point"),
  S("dmf", "CN(C)C=O", 73.09, "N,N-Dimethylformamide", 17.4, 13.7, 11.3, 153, "hazardous", "reproductive toxicity (H360)"),
  S("dmac", "CC(=O)N(C)C", 87.12, "N,N-Dimethylacetamide", 16.8, 11.5, 10.2, 165, "hazardous", "reproductive toxicity (H360)"),
  S("nmp", "CN1CCCC1=O", 99.13, "N-Methylpyrrolidone", 18.0, 12.3, 7.2, 202, "hazardous", "reproductive toxicity (H360)"),
  S("dioxane", "C1COCCO1", 88.11, "1,4-Dioxane", 17.5, 1.8, 9.0, 101.1, "hazardous", "suspected carcinogen, peroxides"),
  S("dme", "COCCOC", 90.12, "1,2-Dimethoxyethane", 15.4, 6.3, 6.0, 85, "hazardous", "reproductive toxicity, peroxides"),
  S("pentane", "CCCCC", 72.15, "Pentane", 14.5, 0.0, 0.0, 36.1, "hazardous", "very low flash point"),
  S("hexane", "CCCCCC", 86.18, "Hexane", 14.9, 0.0, 0.0, 68.7, "hazardous", "neurotoxicity, reproductive toxicity concern"),
  S("diethyl-ether", "CCOCC", 74.12, "Diethyl ether", 14.5, 2.9, 4.6, 34.6, "highly hazardous", "extremely flammable, peroxides"),
  S("benzene", "c1ccccc1", 78.11, "Benzene", 18.4, 0.0, 2.0, 80.1, "highly hazardous", "carcinogen"),
  S("chloroform", "ClC(Cl)Cl", 119.38, "Chloroform", 17.8, 3.1, 5.7, 61.2, "highly hazardous", "suspected carcinogen, toxic"),
  S("ccl4", "ClC(Cl)(Cl)Cl", 153.82, "Carbon tetrachloride", 17.8, 0.0, 0.6, 76.7, "highly hazardous", "toxic, ozone depleting"),
  S("dce", "ClCCCl", 98.96, "1,2-Dichloroethane", 19.0, 7.4, 4.1, 83.5, "highly hazardous", "carcinogen"),
  S("nitromethane", "C[N+](=O)[O-]", 61.04, "Nitromethane", 15.8, 18.8, 5.1, 101.2, "highly hazardous", "explosive hazard"),
];

export const CHEM21_ORDER: Record<Chem21Class, number> = { recommended: 0, problematic: 1, hazardous: 2, "highly hazardous": 3 };

export interface SolventMatch {
  solvent: Solvent;
  /** Hansen distance to the target, MPa^½. */
  ra: number;
}

/** Solvents sorted by Hansen distance to the target; smaller Ra means more similar cohesion. */
export function rankSolvents(target: HansenTriple, solvents: readonly Solvent[] = SOLVENTS): SolventMatch[] {
  return solvents.map((solvent) => ({ solvent, ra: hansenDistance(target, solvent) })).sort((a, b) => a.ra - b.ra);
}

/**
 * Greener substitutes for a solvent: entries of at most `maxClass` sorted by Hansen distance to it.
 * The candidate list is a starting point (similar cohesion energy), not a guarantee of equal
 * performance in a given reaction or crystallisation.
 */
export function greenerAlternatives(solventId: string, maxClass: Chem21Class = "problematic", solvents: readonly Solvent[] = SOLVENTS): SolventMatch[] {
  const ref = solvents.find((s) => s.id === solventId);
  if (!ref) return [];
  return rankSolvents(ref, solvents.filter((s) => s.id !== solventId && CHEM21_ORDER[s.chem21] <= CHEM21_ORDER[maxClass]));
}
