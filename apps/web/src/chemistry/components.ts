/**
 * Pure components for the mixture tools: the drawn molecule from its Joback estimates (with optional
 * measured overrides) and a solvent from the SOLVENTS table, built with the same estimators on the
 * solvent's structure but anchored at its measured boiling point and Hansen parameters. Water has no
 * Joback groups and uses measured constants throughout.
 */
import { SOLVENTS, acentricFactor, girolamiDensity, hansenParameters, jobackEstimates, molecularWeight } from "@molecular-cad/molecule-model";
import type { Molecule, PureComponent, Solvent } from "@molecular-cad/molecule-model";
import type { ChemistryEngine } from "./engine";

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

/** Measured constants for solvents the group method cannot handle (Poling et al., appendix A). */
const MEASURED: Record<string, Pick<PureComponent, "tb" | "tc" | "pc" | "omega" | "hvapTb" | "tm" | "hfus">> = {
  water: { tb: 373.15, tc: 647.1, pc: 220.64, omega: 0.344, hvapTb: 40.66, tm: 273.15, hfus: 6.01 },
};

export interface SolventComponent {
  solvent: Solvent;
  component: PureComponent;
  /** Canonical SMILES from the engine, to recognise when the drawn molecule is this solvent. */
  canonicalSmiles: string | null;
}

const cache = new Map<string, Promise<SolventComponent | null>>();

/** Build (and cache) the pure component of a tabulated solvent. Null when it cannot be estimated. */
export function solventComponent(engine: ChemistryEngine, solventId: string): Promise<SolventComponent | null> {
  const key = `${engine.id}:${solventId}`;
  let p = cache.get(key);
  if (!p) {
    p = build(engine, solventId).catch(() => null);
    cache.set(key, p);
  }
  return p;
}

async function build(engine: ChemistryEngine, solventId: string): Promise<SolventComponent | null> {
  const s = SOLVENTS.find((x) => x.id === solventId);
  if (!s) return null;
  const hansen = { dd: s.dd, dp: s.dp, dh: s.dh };
  let canonicalSmiles: string | null = null;
  let mol: Molecule | null = null;
  try {
    mol = (await engine.fromSmiles(s.smiles, { name: s.name })).molecule;
    canonicalSmiles = await engine.toSmiles(mol);
  } catch {
    mol = null;
  }
  const measured = MEASURED[solventId];
  if (measured) return { solvent: s, component: { name: s.name, molarMass: s.molarMass, ...measured, hansen, provenance: "measured constants" }, canonicalSmiles };
  if (!mol) return null;
  const j = jobackEstimates(mol);
  if (j.tc === null || j.pc === null || j.hvap === null) return null;
  const tb = s.bp + 273.15;
  return {
    solvent: s,
    component: { name: s.name, molarMass: s.molarMass, tb, tc: j.tc, pc: j.pc, omega: acentricFactor(tb, j.tc, j.pc), hvapTb: j.hvap, tm: j.tm, hfus: j.hfus, hansen, provenance: "measured Tb and Hansen parameters; Joback Tc, pc, ΔHvap (vapour curve anchored at the measured boiling point)" },
    canonicalSmiles,
  };
}
