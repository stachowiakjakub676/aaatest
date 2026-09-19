/**
 * PREDICTED properties: outputs of published models, never measurements. Each item names its
 * model, states its error, and (where the model allows it) carries a breakdown of how the value
 * is composed plus structure-based reasoning: which groups push it up or down and why. The
 * group-contribution and regression models run client-side from the graph and the descriptors
 * the in-browser engine computes, so they work offline; QED and synthetic accessibility come
 * from the server engine when it is available.
 */
import { JOBACK_GROUPS, acentricFactor, boilingPointAtPressure, detectFunctionalGroups, findCycles, getAtom, girolamiDensity, hansenParameters, implicitHydrogenCount, jobackEstimates, molecularWeight, neighborsOf, bondsOfAtom, rankSolvents, vapourPressure, watsonHvap } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { ChemistryEngine, ComputedProperties, Prediction, PredictionService } from "./engine";

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/** Atoms that sit in an aromatic six-membered ring (explicit aromatic bonds or a Kekulé pattern). */
export function aromaticAtoms(mol: Molecule): Set<string> {
  const aromatic = new Set<string>();
  for (const cycle of findCycles(mol, 6)) {
    const bonds = cycle.map((id, i) => mol.bonds.find((b) => (b.atomA === id && b.atomB === cycle[(i + 1) % 6]) || (b.atomB === id && b.atomA === cycle[(i + 1) % 6]))!);
    const arom = bonds.every((b) => b.order === "aromatic");
    const kekule = bonds.filter((b) => b.order === "double").length === 3 && bonds.every((b, i) => b.order !== "double" || bonds[(i + 1) % 6]!.order !== "double");
    if (arom || kekule) for (const id of cycle) if (getAtom(mol, id)?.element !== "H") aromatic.add(id);
  }
  return aromatic;
}

/** Fraction of heavy atoms that sit in an aromatic six-membered ring (ESOL's "aromatic proportion"). */
export function aromaticProportion(mol: Molecule): number {
  const heavy = mol.atoms.filter((a) => a.element !== "H");
  if (heavy.length === 0) return 0;
  return aromaticAtoms(mol).size / heavy.length;
}

// ---------------------------------------------------------------------------
// ESOL solubility
// ---------------------------------------------------------------------------

/**
 * ESOL (Delaney, J. Chem. Inf. Comput. Sci. 2004, 44, 1000):
 * log S = 0.16 − 0.63·cLogP − 0.0062·MW + 0.066·RB − 0.74·AP, with S in mol/L.
 * Reported error on the training set: about 1 log unit (RMSE ~0.97).
 */
export function esolLogS(props: ComputedProperties, mol: Molecule): Prediction | null {
  const logP = props.descriptors.cLogP?.value;
  const rb = props.descriptors.rotatableBonds?.value;
  const mw = props.molecularWeight;
  if (logP === undefined || rb === undefined || mw === undefined) return null;
  const ap = aromaticProportion(mol);
  const terms = [
    { label: "Intercept", contribution: 0.16, unit: "log units" },
    { label: `cLogP ${logP.toFixed(2)} × −0.63`, contribution: -0.63 * logP, unit: "log units" },
    { label: `MW ${mw.toFixed(1)} × −0.0062`, contribution: -0.0062 * mw, unit: "log units" },
    { label: `${rb} rotatable bond${rb === 1 ? "" : "s"} × +0.066`, contribution: 0.066 * rb, unit: "log units" },
    { label: `aromatic proportion ${ap.toFixed(2)} × −0.74`, contribution: -0.74 * ap, unit: "log units" },
  ];
  const logS = terms.reduce((s, t) => s + t.contribution, 0);
  const gPerL = 10 ** logS * mw;
  const reasoning: string[] = [];
  reasoning.push(logP > 3 ? `cLogP ${logP.toFixed(1)} is high: a lipophilic molecule prefers oil over water, which is the strongest term pulling solubility down.` : logP < 1 ? `cLogP ${logP.toFixed(1)} is low: the molecule is hydrophilic, which favours dissolution in water.` : `cLogP ${logP.toFixed(1)} is moderate: neither strongly hydrophilic nor strongly lipophilic.`);
  const hbd = props.descriptors.hBondDonors?.value;
  const hba = props.descriptors.hBondAcceptors?.value;
  if (hbd !== undefined && hba !== undefined) reasoning.push(hbd + hba === 0 ? "No hydrogen-bond donors or acceptors: water has nothing to bind to, so dissolution relies on weak dispersion forces only." : `${hbd} H-bond donor${hbd === 1 ? "" : "s"} and ${hba} acceptor${hba === 1 ? "" : "s"} let water solvate the molecule (this enters ESOL through cLogP).`);
  if (mw > 400) reasoning.push(`Molecular weight ${mw.toFixed(0)} g/mol: larger molecules need a bigger cavity in water, lowering solubility (−0.0062 per g/mol).`);
  if (ap > 0.4) reasoning.push(`${(ap * 100).toFixed(0)} % of heavy atoms are in aromatic rings: flat rings stack in the crystal and are hydrophobic, lowering solubility (−0.74 × proportion).`);
  reasoning.push(`log S ${logS.toFixed(2)} corresponds to roughly ${gPerL >= 100 ? "> 100" : gPerL >= 1 ? gPerL.toFixed(0) : gPerL >= 0.01 ? gPerL.toFixed(2) : gPerL.toExponential(1)} g/L (order of magnitude only).`);
  return {
    kind: "predicted",
    id: "esol-logs",
    group: "Solubility",
    model: "ESOL (Delaney, J. Chem. Inf. Comput. Sci. 2004)",
    label: "Aqueous solubility, log S",
    value: round(logS, 2),
    unit: "log(mol/L)",
    uncertainty: "±1 log unit (model RMSE ≈ 0.97 on its training set); linear regression on cLogP, MW, rotatable bonds and aromatic proportion",
    breakdown: terms.map((t) => ({ ...t, contribution: round(t.contribution, 3) })),
    reasoning,
  };
}

// ---------------------------------------------------------------------------
// Joback group contributions: Tb, Tm, Tc, Pc, ΔHvap, ΔHf, density, state, vapour pressure
// ---------------------------------------------------------------------------

const JOBACK_CITATION = "Joback & Reid group contributions (Chem. Eng. Commun. 1987)";

function jobackBreakdown(groups: ReturnType<typeof jobackEstimates>["groups"], contributions: number[], unit: string, intercept: number, interceptLabel: string) {
  return [{ label: interceptLabel, contribution: intercept, unit }, ...groups.map((g, i) => ({ label: g.label, count: g.count, contribution: round(contributions[i]!, 2), unit }))];
}

/** Structure-based reasoning about boiling point from the assigned groups. */
function boilingPointReasoning(groups: ReturnType<typeof jobackEstimates>["groups"], tb: number): string[] {
  const count = (id: string) => groups.find((g) => g.groupId === id)?.count ?? 0;
  const out: string[] = [];
  const ch2 = count("CH2") + count("rCH2");
  if (ch2 >= 2) out.push(`Homologous-series trend: ${ch2} CH2 units contribute ${round(ch2 * 22.88)} K. Every extra carbon in a chain raises the boiling point by roughly 20–30 K because dispersion forces grow with molecular surface.`);
  const oh = count("OH");
  if (oh) out.push(`${oh} alcohol OH group${oh > 1 ? "s" : ""}: hydrogen bonding is why an OH adds +92.9 K, four times a CH2. Compare ethanol (351 K) with propane (231 K), which has the same size.`);
  const aroh = count("ArOH");
  if (aroh) out.push(`Phenolic OH (+76.3 K each): hydrogen bonding, slightly weaker per group than an aliphatic alcohol in the scheme.`);
  const cooh = count("COOH");
  if (cooh) out.push(`Carboxylic acid (+169.1 K each, the largest group): acids form hydrogen-bonded dimers, which is why acetic acid (391 K) boils far above its isomer methyl formate (305 K).`);
  const nh2 = count("NH2") + count("NH") + count("rNH");
  if (nh2) out.push(`N–H groups hydrogen bond (NH2 +73.2 K, NH +50.2 K), less strongly than O–H because nitrogen is less electronegative.`);
  const cho = count("CHO");
  if (cho) out.push(`Aldehyde C=O (+72.2 K): a strong dipole raises the boiling point above the corresponding alkane, but with no O–H there is no hydrogen bonding, so aldehydes boil below alcohols of the same size.`);
  const ketone = count("C=O") + count("rC=O");
  if (ketone) out.push(`Ketone C=O (+76.8 K): dipole–dipole attraction, no hydrogen-bond donor.`);
  const ester = count("COO");
  if (ester) out.push(`Ester COO (+81.1 K): polar but without an O–H; esters boil well below the acids they derive from.`);
  const ether = count("O") + count("rO");
  if (ether) out.push(`Ether oxygen (+22.4 K): barely more than a CH2, since ethers are weakly polar and cannot donate hydrogen bonds.`);
  const branch = count("CH") + count("C");
  if (branch) out.push(`Branching (${branch} tertiary/quaternary carbon${branch > 1 ? "s" : ""}): >CH− (+21.7 K) and >C< (+18.3 K) count for less than a CH2; a compact shape has less surface for dispersion forces, so branched isomers boil lower than linear ones.`);
  const halo = [
    ["F", -0.03],
    ["Cl", 38.13],
    ["Br", 66.86],
    ["I", 93.84],
  ] as const;
  const present = halo.filter(([id]) => count(id) > 0);
  if (present.length) out.push(`Halogens: ${present.map(([id, v]) => `${id} ${v >= 0 ? "+" : ""}${v} K`).join(", ")}. Heavier halogens are more polarisable, so the boiling point rises down the group.`);
  const arom = count("r=CH") + count("r=C");
  if (arom) out.push(`${arom} aromatic ring carbon${arom > 1 ? "s" : ""} (+26.7 / +31.0 K each): flat, rigid rings pack and stack well.`);
  const nitro = count("NO2");
  if (nitro) out.push(`Nitro group (+152.5 K): very polar.`);
  const cn = count("CN");
  if (cn) out.push(`Nitrile (+125.7 K): a large dipole; acetonitrile boils at 355 K despite only two carbons.`);
  if (tb > 550) out.push("Above about 500 K the Joback method tends to overestimate boiling points; many such compounds decompose before boiling.");
  return out;
}

function meltingPointReasoning(groups: ReturnType<typeof jobackEstimates>["groups"]): string[] {
  const count = (id: string) => groups.find((g) => g.groupId === id)?.count ?? 0;
  const out = ["Melting depends on crystal packing (symmetry, hydrogen-bond networks), which a group scheme cannot see; Joback's own average error for Tm is about 23 K and errors of 50 K or more are common. Treat this as a rough guide."];
  if (count("COOH") + count("OH") + count("ArOH") + count("NH2") + count("NH") + count("rNH")) out.push("Hydrogen-bonding groups build ordered lattices and raise the melting point.");
  const flex = count("CH2");
  if (flex >= 4) out.push(`${flex} flexible CH2 units lower the melting point relative to a rigid molecule of the same weight (more conformations in the melt).`);
  if (count("r=CH") + count("r=C") >= 6) out.push("Flat aromatic rings stack efficiently; symmetric aromatics (benzene, naphthalene) melt higher than their size suggests. Symmetry itself is not in the scheme.");
  return out;
}

export function physicalPredictions(mol: Molecule, props: ComputedProperties | null): Prediction[] {
  const out: Prediction[] = [];
  const heavy = mol.atoms.filter((a) => a.element !== "H").length;
  if (heavy === 0) return out;
  const j = jobackEstimates(mol);
  if (j.unassigned.length > 0 || j.tb === null) {
    const els = [...new Set(j.unassigned.map((id) => getAtom(mol, id)?.element ?? "?"))];
    out.push({ kind: "predicted", id: "joback-na", group: "Physical (group contribution)", model: JOBACK_CITATION, label: "Boiling / melting point", value: "not available", uncertainty: `the Joback table has no group for ${els.join(", ")} in this bonding pattern (${j.unassigned.length} atom${j.unassigned.length > 1 ? "s" : ""}); the method refuses rather than guess` });
    return out;
  }
  const tb = j.tb;
  out.push({
    kind: "predicted",
    id: "joback-tb",
    group: "Physical (group contribution)",
    model: JOBACK_CITATION,
    label: "Normal boiling point",
    value: round(tb - 273.15),
    unit: `°C (${round(tb)} K)`,
    uncertainty: "average absolute error ≈ 13 K on Joback's data set, larger for polyfunctional or heavy molecules; systematic overestimate above ~500 K",
    breakdown: jobackBreakdown(j.groups, j.contributions.tb, "K", 198.2, "Base value"),
    reasoning: boilingPointReasoning(j.groups, tb),
  });
  if (j.tm !== null) {
    out.push({
      kind: "predicted",
      id: "joback-tm",
      group: "Physical (group contribution)",
      model: JOBACK_CITATION,
      label: "Melting point",
      value: round(j.tm - 273.15),
      unit: `°C (${round(j.tm)} K)`,
      uncertainty: "average absolute error ≈ 23 K, often much worse: crystal packing and symmetry are not captured",
      breakdown: jobackBreakdown(j.groups, j.contributions.tm, "K", 122.5, "Base value"),
      reasoning: meltingPointReasoning(j.groups),
    });
  }
  // Physical state at 25 °C from the two estimates.
  const T = 298.15;
  const margin = 20;
  let state: string;
  let stateWhy: string;
  if (j.tm !== null && j.tm > T + margin) {
    state = "solid";
    stateWhy = `estimated melting point ${round(j.tm - 273.15)} °C is above room temperature`;
  } else if (tb < T - margin) {
    state = "gas";
    stateWhy = `estimated boiling point ${round(tb - 273.15)} °C is below room temperature`;
  } else if (tb > T + margin && (j.tm === null || j.tm < T - margin)) {
    state = "liquid";
    stateWhy = `estimated melting point ${j.tm === null ? "unknown" : `${round(j.tm - 273.15)} °C`} is below and boiling point ${round(tb - 273.15)} °C above room temperature`;
  } else {
    state = "uncertain (near a phase boundary)";
    stateWhy = "an estimate lies within ±20 K of 25 °C, inside the method's error";
  }
  out.push({ kind: "predicted", id: "joback-state", group: "Physical (group contribution)", model: `derived from the ${JOBACK_CITATION} estimates`, label: "Physical state at 25 °C", value: state, uncertainty: "follows the Tb/Tm estimates and inherits their errors", reasoning: [`${state[0]!.toUpperCase()}${state.slice(1)}: ${stateWhy}.`] });
  if (j.hvap !== null) {
    out.push({ kind: "predicted", id: "joback-hvap", group: "Physical (group contribution)", model: JOBACK_CITATION, label: "Enthalpy of vaporisation at Tb", value: round(j.hvap), unit: "kJ/mol", uncertainty: "average absolute error ≈ 1.3 kJ/mol", breakdown: jobackBreakdown(j.groups, j.contributions.hvap, "kJ/mol", 15.3, "Base value"), reasoning: ["Energy to separate the molecules of the liquid: hydrogen-bonding groups (OH +16.8, COOH +19.5 kJ/mol) dominate, hydrocarbon groups add ~2 kJ/mol each."] });
  }
  if (j.tc !== null && j.pc !== null && j.hvap !== null) out.push(...phasePredictions(j, mol, props));
  if (j.tc !== null && j.pc !== null) {
    out.push({ kind: "predicted", id: "joback-tc", group: "Physical (group contribution)", model: JOBACK_CITATION, label: "Critical temperature / pressure", value: `${round(j.tc)} K / ${round(j.pc)} bar`, uncertainty: "Tc average error ≈ 0.8 %, Pc ≈ 5 %; Tc is scaled from the Tb estimate", reasoning: ["Above the critical temperature no pressure can liquefy the vapour; relevant for supercritical extraction and for equation-of-state work."] });
  }
  if (j.hf !== null) {
    out.push({ kind: "predicted", id: "joback-hf", group: "Physical (group contribution)", model: JOBACK_CITATION, label: "Enthalpy of formation (ideal gas, 298 K)", value: round(j.hf), unit: "kJ/mol", uncertainty: "average absolute error ≈ 9 kJ/mol", breakdown: jobackBreakdown(j.groups, j.contributions.hf, "kJ/mol", 68.29, "Base value"), reasoning: [j.hf < -200 ? "Strongly negative: oxygen-rich groups (C=O, COOH, ester, OH) make the molecule thermodynamically stable relative to the elements." : j.hf > 100 ? "Positive: unsaturation (alkynes, allenes, aromatic carbons without heteroatoms) stores energy relative to the elements." : "Moderate enthalpy of formation."] });
  }
  if (j.cp298 !== null) {
    out.push({ kind: "predicted", id: "joback-cp", group: "Physical (group contribution)", model: JOBACK_CITATION, label: "Ideal-gas heat capacity (298 K)", value: round(j.cp298), unit: "J/(mol·K)", uncertainty: "average error ≈ 1.4 %" });
  }
  const mw = props?.molecularWeight;
  if (mw !== undefined) {
    const d = girolamiDensity(mol, mw);
    if (d) {
      out.push({ kind: "predicted", id: "girolami-density", group: "Physical (group contribution)", model: "Girolami scaled-volume method (J. Chem. Educ. 1994)", label: "Density (liquid or solid, room temperature)", value: round(d.density, 2), unit: "g/cm³", uncertainty: "typical error 0.02–0.1 g/cm³; meaningless for gases", breakdown: [{ label: `M / (5 × Vs), Vs = ${d.scaledVolume}`, contribution: round(d.molarMass / (5 * d.scaledVolume), 3), unit: "g/cm³" }, ...(d.corrections.length ? [{ label: `+${Math.min(30, 10 * d.corrections.length)} % for ${d.corrections.join(", ")}`, contribution: round(d.density - d.molarMass / (5 * d.scaledVolume), 3), unit: "g/cm³" }] : [])], reasoning: ["Density rises with heavy atoms per volume (halogens, sulfur) and with hydrogen bonding (tighter packing), and falls with bulky hydrocarbon content.", d.density < 1 ? "Below 1 g/cm³: would float on water (if immiscible)." : "Above 1 g/cm³: would sink in water (if immiscible)."] });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lee–Kesler vapour pressure, boiling point under vacuum, Hansen parameters
// ---------------------------------------------------------------------------

const LK_CITATION = "Lee–Kesler correlation (AIChE J. 1975) on the Joback Tc, pc and Tb";

/** Vapour pressure at 25 °C, ΔHvap at 25 °C and the boiling point on a rotary evaporator (20 mbar). */
function phasePredictions(j: ReturnType<typeof jobackEstimates>, _mol: Molecule, _props: ComputedProperties | null): Prediction[] {
  const out: Prediction[] = [];
  const { tb, tc, pc, hvap } = j;
  if (tb === null || tc === null || pc === null || hvap === null) return out;
  const omega = acentricFactor(tb, tc, pc);
  const T = 298.15;
  const vp = vapourPressure(T, tc, pc, omega);
  if (vp !== null) {
    const pKpa = vp * 100;
    out.push({
      kind: "predicted",
      id: "lk-vp",
      group: "Physical (group contribution)",
      model: LK_CITATION,
      label: "Vapour pressure at 25 °C",
      value: pKpa >= 1 ? round(pKpa, 1) : pKpa >= 0.001 ? round(pKpa, 4) : Number(pKpa.toExponential(2)),
      unit: "kPa",
      uncertainty: "the correlation itself is good to a few percent for ordinary organics; the Joback inputs dominate the error (10 K in Tb ≈ factor 1.5–2 in pressure)",
      reasoning: [`ln(p/pc) = f0(Tr) + ω·f1(Tr) with ω = ${round(omega, 3)} from Tb/Tc = ${round(tb / tc, 3)}.`, pKpa > 10 ? "Volatile: evaporates readily at room temperature." : pKpa > 0.1 ? "Moderately volatile." : "Low volatility: little vapour at room temperature."],
    });
  }
  const tVac = boilingPointAtPressure(0.02, tc, pc, omega);
  if (tVac !== null) {
    out.push({
      kind: "predicted",
      id: "lk-tb-vac",
      group: "Physical (group contribution)",
      model: LK_CITATION,
      label: "Boiling point at 20 mbar (rotary evaporator)",
      value: round(tVac - 273.15),
      unit: `°C (${round(tVac)} K)`,
      uncertainty: "inherits the Tb error; the vacuum boiling point is typically 10–20 K less certain than the normal one. See the Phase tab for other pressures",
      reasoning: [`The vapour curve is inverted at 20 mbar; lowering the pressure from 1013 to 20 mbar drops the boiling point by about ${round(tb - tVac)} K for this molecule.`],
    });
  }
  const hvap25 = watsonHvap(T, tb, tc, hvap);
  if (hvap25 !== null && tb > T) {
    out.push({ kind: "predicted", id: "watson-hvap25", group: "Physical (group contribution)", model: "Watson scaling of the Joback ΔHvap(Tb)", label: "Enthalpy of vaporisation at 25 °C", value: round(hvap25), unit: "kJ/mol", uncertainty: "Watson's exponent 0.38 is a typical value; ±2 kJ/mol on top of the Joback error", reasoning: ["ΔHvap grows as the liquid cools away from the critical point: ΔHvap(T) = ΔHvap(Tb)·((1−T/Tc)/(1−Tb/Tc))^0.38."] });
  }
  return out;
}

/** Hansen solubility parameters (group contribution) with the closest solvents from the table. */
export function hansenPrediction(mol: Molecule, molarMass: number | undefined): Prediction | null {
  const mw = molarMass ?? molecularWeight(mol, { includeImplicitHydrogens: true }).value;
  if (mw === undefined) return null;
  const dens = girolamiDensity(mol, mw);
  if (!dens) return null;
  const h = hansenParameters(mol, mw / dens.density);
  if (!h) return null;
  const top = rankSolvents(h).slice(0, 3);
  return {
    kind: "predicted",
    id: "hansen",
    group: "Solvents (Hansen)",
    model: "Hoftyzer–Van Krevelen group contributions (Properties of Polymers, 2009) with the Girolami molar volume",
    label: "Hansen parameters δd / δp / δh",
    value: `${round(h.dd)} / ${round(h.dp)} / ${round(h.dh)}`,
    unit: "MPa½",
    uncertainty: "typically 1–2 MPa½ per component, δh the least reliable; the molar volume adds ~5 %",
    breakdown: h.groups.map((g, i) => ({ label: `${g.label}: Fd ${round(h.contributions[i]!.fd, 0)}, Fp ${round(h.contributions[i]!.fp, 0)}, Eh ${round(h.contributions[i]!.eh, 0)}`, count: g.count, contribution: round(h.contributions[i]!.fd / h.molarVolume, 2), unit: "MPa½ to δd" })),
    reasoning: [
      `Dispersion δd ${round(h.dd)}: ΣFd ${round(h.contributions.reduce((s, c) => s + c.fd, 0), 0)} over V = ${round(h.molarVolume)} cm³/mol. Polar δp ${round(h.dp)} and hydrogen bonding δh ${round(h.dh)} come from the polar and H-bonding groups.`,
      `Closest solvents by Hansen distance: ${top.map((m) => `${m.solvent.name} (Ra ${round(m.ra)})`).join(", ")}. Small Ra means similar cohesion energy, which favours miscibility ("like dissolves like"); see the Materials tab.`,
      ...h.notes,
    ],
  };
}

// ---------------------------------------------------------------------------
// Acid / base character from functional-group classes (textbook pKa ranges)
// ---------------------------------------------------------------------------

interface AcidBaseSite {
  name: string;
  kind: "acid" | "base" | "neutral";
  pKa: string;
  note: string;
}

export function acidBaseSites(mol: Molecule): AcidBaseSite[] {
  const sites: AcidBaseSite[] = [];
  const arom = aromaticAtoms(mol);
  const isH = (id: string) => getAtom(mol, id)?.element === "H";
  const hCount = (id: string) => neighborsOf(mol, id).filter(isH).length + implicitHydrogenCount(mol, id);
  const heavyN = (id: string) => neighborsOf(mol, id).filter((n) => !isH(n));
  const seen = new Set<string>();
  for (const g of detectFunctionalGroups(mol)) {
    if (g.id === "carboxylic-acid") sites.push({ name: "Carboxylic acid", kind: "acid", pKa: "≈ 4–5", note: "ionised (carboxylate) at physiological pH 7.4; soluble as its salt" });
    if (g.id === "amine") {
      const n = g.atomIds[0]!;
      seen.add(n);
      const onAromatic = heavyN(n).some((c) => arom.has(c));
      const amide = heavyN(n).some((c) => bondsOfAtom(mol, c).some((b) => b.order === "double" && getAtom(mol, b.atomA === c ? b.atomB : b.atomA)?.element === "O"));
      if (amide) sites.push({ name: "Amide N", kind: "neutral", pKa: "conjugate acid ≈ −1", note: "the lone pair is delocalised into the carbonyl; not basic in water" });
      else if (onAromatic) sites.push({ name: "Aniline-type amine", kind: "base", pKa: "conjugate acid ≈ 4–5", note: "weak base: the lone pair is delocalised into the ring; mostly neutral at pH 7.4" });
      else sites.push({ name: g.name, kind: "base", pKa: "conjugate acid ≈ 9–11", note: "protonated (ammonium) at pH 7.4; forms water-soluble salts" });
    }
    if (g.id === "alcohol") {
      const o = g.atomIds[0]!;
      const c = g.atomIds[1]!;
      if (arom.has(c)) sites.push({ name: "Phenol", kind: "acid", pKa: "≈ 8–10", note: "weakly acidic; the phenoxide is stabilised by the ring; mostly neutral at pH 7.4 unless electron-poor" });
      else sites.push({ name: "Alcohol", kind: "neutral", pKa: "≈ 16–18", note: "effectively neutral in water; still a hydrogen-bond donor and acceptor" });
      seen.add(o);
    }
  }
  for (const a of mol.atoms) {
    if (seen.has(a.id)) continue;
    if (a.element === "N" && arom.has(a.id) && hCount(a.id) === 0 && heavyN(a.id).length === 2) sites.push({ name: "Pyridine-type N", kind: "base", pKa: "conjugate acid ≈ 5", note: "weak base; partly protonated in acid, neutral at pH 7.4" });
    if (a.element === "S" && hCount(a.id) >= 1 && heavyN(a.id).length === 1) sites.push({ name: "Thiol", kind: "acid", pKa: "≈ 10", note: "more acidic than an alcohol (larger, more polarisable sulfur)" });
    if (a.element === "S" && heavyN(a.id).length === 4) {
      const os = heavyN(a.id).filter((n) => getAtom(mol, n)?.element === "O");
      if (os.length === 3 && os.some((o) => hCount(o) >= 1)) sites.push({ name: "Sulfonic acid", kind: "acid", pKa: "< 0", note: "strong acid; fully ionised in water" });
      else if (os.length === 2 && heavyN(a.id).some((n) => getAtom(mol, n)?.element === "N" && hCount(n) >= 1)) sites.push({ name: "Sulfonamide N–H", kind: "acid", pKa: "≈ 10", note: "weakly acidic" });
    }
  }
  // Five-membered aromatic N–H / imidazole are beyond the ring perception; keep the list honest.
  return sites;
}

export function acidBasePrediction(mol: Molecule): Prediction | null {
  const sites = acidBaseSites(mol);
  if (mol.atoms.filter((a) => a.element !== "H").length === 0) return null;
  const acids = sites.filter((s) => s.kind === "acid");
  const bases = sites.filter((s) => s.kind === "base");
  const value = acids.length && bases.length ? "amphoteric (acidic and basic sites)" : acids.length ? `acidic (${acids.map((s) => s.name.toLowerCase()).join(", ")})` : bases.length ? `basic (${bases.map((s) => s.name.toLowerCase()).join(", ")})` : "neutral (no ionisable group recognised)";
  return {
    kind: "predicted",
    id: "acid-base",
    group: "Acid/base",
    model: "Class-typical pKa ranges (textbook values for the functional group class, not computed for this molecule)",
    label: "Acid/base character in water",
    value,
    uncertainty: "substituent effects shift pKa by several units; ranges are for the unsubstituted class",
    reasoning: sites.length ? sites.map((s) => `${s.name}: pKa ${s.pKa}. ${s.note[0]!.toUpperCase()}${s.note.slice(1)}.`) : ["No carboxylic acid, phenol, amine, pyridine, thiol or sulfonic acid group was recognised, so the molecule should stay un-ionised across the usual pH range."],
  };
}

// ---------------------------------------------------------------------------
// Composite service
// ---------------------------------------------------------------------------

export class CompositePredictionService implements PredictionService {
  readonly label: string;
  constructor(
    private readonly engine: ChemistryEngine,
    private readonly propsRef: () => ComputedProperties | null,
  ) {
    this.label = engine.capabilities.estimates ? "Joback, Lee–Kesler, Girolami, Hansen, ESOL and class pKa (client) + QED and SA score (server)" : "Joback, Lee–Kesler, Girolami, Hansen, ESOL and class pKa (client); QED and SA score need the server engine";
  }

  async predict(mol: Molecule): Promise<Prediction[]> {
    const out: Prediction[] = [];
    const props = this.propsRef();
    out.push(...physicalPredictions(mol, props));
    if (props) {
      const esol = esolLogS(props, mol);
      if (esol) out.push(esol);
    }
    const ab = acidBasePrediction(mol);
    if (ab) out.push(ab);
    const hansen = hansenPrediction(mol, props?.molecularWeight);
    if (hansen) out.push(hansen);
    if (this.engine.capabilities.estimates) {
      try {
        out.push(...(await this.engine.estimates(mol)).map((p) => ({ group: "Drug-likeness (server)", ...p })));
      } catch {
        /* server estimates are optional */
      }
    }
    return out;
  }
}

/** One-paragraph "property sheet" assembled from the predictions (for the panel and the assistant). */
export function summarizePredictions(preds: Prediction[]): string[] {
  const by = (id: string) => preds.find((p) => p.id === id);
  const lines: string[] = [];
  const state = by("joback-state");
  const tb = by("joback-tb");
  const tm = by("joback-tm");
  if (tb) lines.push(`Likely ${state ? String(state.value) : "phase unknown"} at room temperature; estimated boiling point ${tb.value} °C${tm ? `, melting point ${tm.value} °C` : ""} (group contribution, ±13 K / ±25 K typical).`);
  const dens = by("girolami-density");
  if (dens) lines.push(`Estimated density ${dens.value} g/cm³.`);
  const vac = by("lk-tb-vac");
  if (vac) lines.push(`On a rotary evaporator (20 mbar) it should boil near ${vac.value} °C.`);
  const hansen = by("hansen");
  if (hansen) lines.push(`Hansen parameters δd/δp/δh ≈ ${hansen.value} MPa½.`);
  const sol = by("esol-logs");
  if (sol) {
    const v = Number(sol.value);
    lines.push(`Water solubility ${v > -1 ? "high" : v > -3 ? "moderate" : v > -5 ? "low" : "very low"} (ESOL log S ${sol.value}, ±1 log unit).`);
  }
  const ab = by("acid-base");
  if (ab) lines.push(`Acid/base: ${ab.value}.`);
  const qed = by("qed");
  if (qed) lines.push(`Drug-likeness QED ${qed.value}.`);
  const sa = by("sa-score");
  if (sa) lines.push(`Synthetic accessibility score ${sa.value} (1 easy – 10 hard).`);
  return lines;
}
