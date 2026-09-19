/**
 * Pure components for the mixture tools: the drawn molecule from its Joback estimates (with optional
 * measured overrides) and a solvent from the SOLVENTS table, built with the same estimators on the
 * solvent's structure but anchored at its measured boiling point and Hansen parameters. Water has no
 * Joback groups and uses measured constants throughout.
 */
import { SOLVENTS, acentricFactor, girolamiDensity, hansenParameters, jobackEstimates, molecularWeight } from "@molecular-cad/molecule-model";
import type { Molecule, PureComponent, Solvent, UnifacGroups } from "@molecular-cad/molecule-model";
import type { ChemistryEngine } from "./engine";
import type { UnifacAssignment } from "./unifacFragment";

/** Something that can split a molecule into UNIFAC subgroups (the WebAssembly engine). */
export interface UnifacFragmenter {
  unifacGroups(mol: Molecule): Promise<UnifacAssignment>;
}

const targetGroupCache = new WeakMap<Molecule, Promise<UnifacGroups | null>>();

/** UNIFAC groups of the drawn molecule (null when it cannot be fragmented); cached per molecule object. */
export function targetUnifacGroups(fragmenter: UnifacFragmenter, mol: Molecule): Promise<UnifacGroups | null> {
  let p = targetGroupCache.get(mol);
  if (!p) {
    p = fragmenter
      .unifacGroups(mol)
      .then((r) => (r.success ? r.groups : null))
      .catch(() => null);
    targetGroupCache.set(mol, p);
  }
  return p;
}

/** Measured values that replace the estimates; null or absent keeps the estimate. */
export interface TargetOverrides {
  /** Measured normal boiling point, K. */
  tb?: number | null;
  /** Measured melting point, K. */
  tm?: number | null;
  /** Measured enthalpy of fusion, kJ/mol. */
  hfus?: number | null;
}

/** The drawn molecule as a pure component; null when Joback cannot supply the critical constants. */
export function targetComponent(mol: Molecule, name: string, molarMass: number | undefined, overrides: TargetOverrides = {}): PureComponent | null {
  const j = jobackEstimates(mol);
  if (j.tc === null || j.pc === null || j.hvap === null || j.tb === null) return null;
  const mw = molarMass ?? molecularWeight(mol, { includeImplicitHydrogens: true }).value;
  if (mw === undefined) return null;
  const tb = overrides.tb ?? j.tb;
  const tm = overrides.tm ?? j.tm;
  const hfus = overrides.hfus ?? j.hfus;
  const dens = girolamiDensity(mol, mw);
  const h = dens ? hansenParameters(mol, mw / dens.density) : null;
  const measured = [overrides.tb != null ? "Tb" : null, overrides.tm != null ? "Tm" : null, overrides.hfus != null ? "ΔHfus" : null].filter(Boolean);
  return {
    name,
    molarMass: mw,
    tb,
    tc: j.tc,
    pc: j.pc,
    omega: acentricFactor(tb, j.tc, j.pc),
    hvapTb: j.hvap,
    tm,
    hfus,
    hansen: h ? { dd: h.dd, dp: h.dp, dh: h.dh } : null,
    provenance: measured.length ? `measured ${measured.join(", ")}; Joback for the rest` : "Joback estimates",
  };
}

/**
 * Measured constants for solvents the group method cannot handle (Poling et al., appendix A). ω is
 * back-calculated from Tb so the Lee–Kesler curve passes through the normal boiling point (with the
 * literature ω = 0.344 the correlation is 9 % low for water at 100 °C: water is not a Lee–Kesler fluid).
 */
const MEASURED: Record<string, Pick<PureComponent, "tb" | "tc" | "pc" | "omega" | "hvapTb" | "tm" | "hfus">> = {
  water: { tb: 373.15, tc: 647.1, pc: 220.64, omega: acentricFactor(373.15, 647.1, 220.64), hvapTb: 40.66, tm: 273.15, hfus: 6.01 },
};

export interface SolventComponent {
  solvent: Solvent;
  component: PureComponent;
  /** Canonical SMILES from the engine, to recognise when the drawn molecule is this solvent. */
  canonicalSmiles: string | null;
}

const cache = new Map<string, Promise<SolventComponent | null>>();

/** Build (and cache) the pure component of a tabulated solvent. Null when it cannot be estimated. */
export function solventComponent(engine: ChemistryEngine, fragmenter: UnifacFragmenter, solventId: string): Promise<SolventComponent | null> {
  const key = `${engine.id}:${solventId}`;
  let p = cache.get(key);
  if (!p) {
    p = build(engine, fragmenter, solventId).catch(() => null);
    cache.set(key, p);
  }
  return p;
}

async function build(engine: ChemistryEngine, fragmenter: UnifacFragmenter, solventId: string): Promise<SolventComponent | null> {
  const s = SOLVENTS.find((x) => x.id === solventId);
  if (!s) return null;
  const hansen = { dd: s.dd, dp: s.dp, dh: s.dh };
  let canonicalSmiles: string | null = null;
  let mol: Molecule | null = null;
  let unifac: UnifacGroups | null = null;
  try {
    mol = (await engine.fromSmiles(s.smiles, { name: s.name })).molecule;
    canonicalSmiles = await engine.toSmiles(mol);
    const r = await fragmenter.unifacGroups(mol);
    unifac = r.success ? r.groups : null;
  } catch {
    mol = null;
  }
  const measured = MEASURED[solventId];
  if (measured) return { solvent: s, component: { name: s.name, molarMass: s.molarMass, ...measured, hansen, unifac, provenance: "measured constants (ω anchored at Tb)" }, canonicalSmiles };
  if (!mol) return null;
  const j = jobackEstimates(mol);
  if (j.tc === null || j.pc === null || j.hvap === null) return null;
  const tb = s.bp + 273.15;
  return {
    solvent: s,
    component: { name: s.name, molarMass: s.molarMass, tb, tc: j.tc, pc: j.pc, omega: acentricFactor(tb, j.tc, j.pc), hvapTb: j.hvap, tm: j.tm, hfus: j.hfus, hansen, unifac, provenance: "measured Tb and Hansen parameters; Joback Tc, pc, ΔHvap (vapour curve anchored at the measured boiling point)" },
    canonicalSmiles,
  };
}
