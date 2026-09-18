/**
 * Rule-based synthesis planner: "what is the simplest textbook route to this target?"
 *
 * The planner applies a fixed set of retrosynthetic templates (functional-group disconnections
 * and interconversions taken from undergraduate organic chemistry) to the target graph, then
 * searches a few steps deep for precursors that are common building blocks. Every step names
 * the reaction class and the class of reagents; it never produces quantities, temperatures,
 * times, procedures or work-up. Its output is PREDICTED (model: rule templates), ranked by a
 * fixed heuristic (fewer steps, simpler precursors, more reliable reaction classes). The target
 * screener and the provenance policy from `types.ts` still apply: for a target the deployment's
 * screener does not permit, no route is produced.
 */
import { addAtom, addBond, bondInRing, bondsOfAtom, connectedComponents, getAtom, implicitHydrogenCount, molecularFormula, neighborsOf, placeBondedAtom, removeAtom, removeBond, setBondOrder, updateAtom, validateMolecule } from "@molecular-cad/molecule-model";
import type { AtomId, BondId, Molecule } from "@molecular-cad/molecule-model";
import { aromaticAtoms } from "../chemistry/predictions";
import { BUILDING_BLOCKS } from "./buildingBlocks";
import type { ScreeningResult, TargetScreener } from "./types";
import { NO_SCREENER } from "./types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReactionTemplate {
  id: string;
  name: string;
  /** "disconnection" forms a bond between two precursors; "fgi" changes a group on one precursor. */
  kind: "disconnection" | "fgi";
  /** Class-level description of the reagents (textbook level, no amounts or conditions). */
  reagentClass: string;
  description: string;
  reference: string;
  /** Reliability cost added to the route score (0 = routine, 1 = often problematic). */
  penalty: number;
  caveats: string[];
}

export interface RetroMove {
  template: ReactionTemplate;
  /** Bonds of the product formed or changed by this step. */
  bondIds: BondId[];
  precursors: Molecule[];
  /** Reagents that are not drawn as precursors (e.g. "NaCN", "CO2"). */
  reagents: string[];
  notes: string[];
  extraPenalty: number;
}

export type PrecursorStatus = "building-block" | "small-fragment" | "intermediate" | "unresolved";

export interface Precursor {
  molecule: Molecule;
  smiles: string | null;
  formula: string;
  heavyAtomCount: number;
  status: PrecursorStatus;
  /** Name from the building-block list, when known. */
  name: string | null;
}

export interface SynthesisStep {
  index: number;
  template: ReactionTemplate;
  reactants: Precursor[];
  reagents: string[];
  product: Precursor;
  bondIds: BondId[];
  notes: string[];
}

export interface SynthesisRoute {
  /** Forward order: step 1 starts from building blocks, the last step gives the target. */
  steps: SynthesisStep[];
  stepCount: number;
  /** Lower is simpler (steps + reliability penalties + unresolved precursors). */
  score: number;
  startingMaterials: Precursor[];
  unresolved: Precursor[];
  notes: string[];
}

export interface SynthesisPlan {
  kind: "predicted";
  model: string;
  target: Precursor;
  routes: SynthesisRoute[];
  screening: ScreeningResult;
  /** Number of intermediate structures the search examined. */
  searched: number;
  disclaimer: string;
  /** Why no route was produced (screening, no template, target too small). */
  reason: string | null;
  /** Remarks about the target itself (e.g. it is a common building block). */
  notes: string[];
}

export interface SynthesisPlanner {
  readonly label: string;
  readonly disclaimer: string;
  plan(target: Molecule, opts?: { maxDepth?: number }): Promise<SynthesisPlan>;
}

export const SYNTHESIS_DISCLAIMER =
  "Rule-based estimate of the simplest textbook route: fixed reaction templates, class-level reagents, no conditions, quantities or procedures. Stereochemistry is not tracked (precursors are shown without stereo marks); regiochemistry, protecting groups and functional-group compatibility are only partly checked. A route is a starting point for a chemist, not an instruction.";

// ---------------------------------------------------------------------------
// Graph helpers (explicit-hydrogen aware)
// ---------------------------------------------------------------------------

interface Ctx {
  mol: Molecule;
  arom: Set<AtomId>;
  ringBonds: Set<BondId>;
}

const isH = (m: Molecule, id: AtomId) => getAtom(m, id)?.element === "H";
const el = (m: Molecule, id: AtomId) => getAtom(m, id)?.element ?? "?";
const heavyNb = (m: Molecule, id: AtomId) => neighborsOf(m, id).filter((n) => !isH(m, n));
const hCount = (m: Molecule, id: AtomId) => neighborsOf(m, id).filter((n) => isH(m, n)).length + implicitHydrogenCount(m, id);
const bondTo = (m: Molecule, a: AtomId, b: AtomId) => m.bonds.find((x) => (x.atomA === a && x.atomB === b) || (x.atomA === b && x.atomB === a));
const other = (b: { atomA: AtomId; atomB: AtomId }, id: AtomId) => (b.atomA === id ? b.atomB : b.atomA);
const isSp3C = (m: Molecule, id: AtomId) => el(m, id) === "C" && bondsOfAtom(m, id).every((b) => b.order === "single");
const doubleTo = (m: Molecule, id: AtomId, element: string) =>
  bondsOfAtom(m, id)
    .filter((b) => b.order === "double")
    .map((b) => other(b, id))
    .filter((n) => el(m, n) === element);
/** Heavy atoms bonded by a single bond. */
const singleTo = (m: Molecule, id: AtomId, element: string) =>
  bondsOfAtom(m, id)
    .filter((b) => b.order === "single")
    .map((b) => other(b, id))
    .filter((n) => el(m, n) === element);
const isCarbonyl = (m: Molecule, c: AtomId) => el(m, c) === "C" && doubleTo(m, c, "O").length === 1;
const isCarboxylC = (m: Molecule, c: AtomId) => isCarbonyl(m, c) && singleTo(m, c, "O").some((o) => heavyNb(m, o).length === 1 && hCount(m, o) >= 1);
const isAmideC = (m: Molecule, c: AtomId) => isCarbonyl(m, c) && singleTo(m, c, "N").length > 0;
const isEsterC = (m: Molecule, c: AtomId) => isCarbonyl(m, c) && singleTo(m, c, "O").some((o) => heavyNb(m, o).length === 2);

/** Remove one explicit hydrogen from an atom (no-op when hydrogens are implicit). */
function removeOneH(m: Molecule, id: AtomId): Molecule {
  const h = neighborsOf(m, id).find((n) => isH(m, n));
  if (h) return removeAtom(m, h);
  const a = getAtom(m, id)!;
  if (a.implicitHydrogens !== undefined && a.implicitHydrogens > 0) return updateAtom(m, id, { implicitHydrogens: a.implicitHydrogens - 1 });
  return m;
}

function addCapAtom(m: Molecule, anchor: AtomId, element: string, order: "single" | "double" = "single"): { molecule: Molecule; id: AtomId } {
  const pos = placeBondedAtom(m, anchor, element, order);
  const added = addAtom(m, { element, position: pos });
  return { molecule: addBond(added.molecule, { atomA: anchor, atomB: added.atom.id, order }).molecule, id: added.atom.id };
}

type Cap = "H" | "OH" | "Br" | "Cl" | "NH2" | "B(OH)2" | "=O" | "NO2" | "SO3H";

/** Attach a capping group to an atom that just lost a bond. */
function cap(m: Molecule, anchor: AtomId, spec: Cap): Molecule {
  switch (spec) {
    case "H":
      return addCapAtom(m, anchor, "H").molecule;
    case "Br":
    case "Cl":
      return addCapAtom(m, anchor, spec).molecule;
    case "OH": {
      const o = addCapAtom(m, anchor, "O");
      return addCapAtom(o.molecule, o.id, "H").molecule;
    }
    case "NH2": {
      const n = addCapAtom(m, anchor, "N");
      const h1 = addCapAtom(n.molecule, n.id, "H");
      return addCapAtom(h1.molecule, n.id, "H").molecule;
    }
    case "=O":
      return addCapAtom(m, anchor, "O", "double").molecule;
    case "B(OH)2": {
      const b = addCapAtom(m, anchor, "B");
      let mm = b.molecule;
      for (let i = 0; i < 2; i++) {
        const o = addCapAtom(mm, b.id, "O");
        mm = addCapAtom(o.molecule, o.id, "H").molecule;
      }
      return mm;
    }
    case "NO2": {
      const n = addCapAtom(m, anchor, "N");
      let mm = updateAtom(n.molecule, n.id, { formalCharge: 1 });
      mm = addCapAtom(mm, n.id, "O", "double").molecule;
      const o2 = addCapAtom(mm, n.id, "O");
      return updateAtom(o2.molecule, o2.id, { formalCharge: -1 });
    }
    case "SO3H": {
      const s = addCapAtom(m, anchor, "S");
      let mm = addCapAtom(s.molecule, s.id, "O", "double").molecule;
      mm = addCapAtom(mm, s.id, "O", "double").molecule;
      const o = addCapAtom(mm, s.id, "O");
      return addCapAtom(o.molecule, o.id, "H").molecule;
    }
  }
}

/** Turn a C–OH into C=O (drops the O–H and one H on carbon if explicit). */
function oxidiseCarbinol(m: Molecule, c: AtomId, o: AtomId): Molecule {
  let mm = removeOneH(m, o);
  mm = removeOneH(mm, c);
  return setBondOrder(mm, bondTo(mm, c, o)!.id, "double");
}

/** Turn a C=O into CH–OH. */
function reduceCarbonyl(m: Molecule, c: AtomId, o: AtomId): Molecule {
  let mm = setBondOrder(m, bondTo(m, c, o)!.id, "single");
  mm = cap(mm, o, "H");
  return cap(mm, c, "H");
}

/** Split into connected pieces with fresh ids and metadata. */
function pieces(m: Molecule, parent: Molecule, label: string): Molecule[] {
  return connectedComponents(m).map((ids, i) => {
    const set = new Set(ids);
    const { name: _name, ...rest } = m;
    void _name;
    return { ...rest, id: `${parent.id}-${label}-${i + 1}`, atoms: m.atoms.filter((a) => set.has(a.id)), bonds: m.bonds.filter((b) => set.has(b.atomA) && set.has(b.atomB)), metadata: { source: "synthesis-planner", parent: parent.id, step: label } };
  });
}

function hasAcidicProtons(m: Molecule, except: AtomId[] = []): string[] {
  const out: string[] = [];
  for (const a of m.atoms) {
    if (except.includes(a.id)) continue;
    if ((a.element === "O" || a.element === "N" || a.element === "S") && hCount(m, a.id) >= 1 && heavyNb(m, a.id).length >= 1) out.push(`${a.element}–H at ${a.id}`);
    if (a.element === "C" && bondsOfAtom(m, a.id).some((b) => b.order === "triple") && hCount(m, a.id) >= 1) out.push(`terminal alkyne at ${a.id}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const T = (t: Omit<ReactionTemplate, "caveats"> & { caveats?: string[] }): ReactionTemplate => ({ caveats: [], ...t });

const TEMPLATES = {
  ester: T({ id: "fischer-ester", name: "Fischer esterification", kind: "disconnection", reagentClass: "carboxylic acid + alcohol with an acid catalyst; or the acyl chloride/anhydride + alcohol with a base", description: "Forms the ester C(=O)–O bond.", reference: "Clayden et al., Organic Chemistry, ch. 10", penalty: 0.2, caveats: ["Equilibrium reaction: needs excess alcohol or water removal; hindered (tertiary) alcohols react poorly."] }),
  amide: T({ id: "amide-coupling", name: "Amide coupling", kind: "disconnection", reagentClass: "carboxylic acid + amine with a coupling reagent (carbodiimide type), or the acyl chloride + amine with a base", description: "Forms the amide C(=O)–N bond.", reference: "Clayden et al., ch. 10", penalty: 0.2 }),
  williamson: T({ id: "williamson", name: "Williamson ether synthesis", kind: "disconnection", reagentClass: "alcohol or phenol deprotonated with a base, then an alkyl halide (SN2)", description: "Forms the ether C–O bond at an sp3 carbon.", reference: "Clayden et al., ch. 15", penalty: 0.3, caveats: ["SN2: works best with primary halides; secondary halides give elimination; tertiary halides fail."] }),
  thioether: T({ id: "thiolate-alkylation", name: "Thiolate alkylation", kind: "disconnection", reagentClass: "thiol + base, then an alkyl halide (SN2)", description: "Forms the sulfide C–S bond.", reference: "Clayden et al., ch. 15", penalty: 0.3 }),
  reductiveAmination: T({ id: "reductive-amination", name: "Reductive amination", kind: "disconnection", reagentClass: "aldehyde or ketone + amine, then a mild hydride reducing agent", description: "Forms the amine C–N bond via the imine/iminium.", reference: "Clayden et al., ch. 11", penalty: 0.3, caveats: ["Direct N-alkylation with the alkyl halide is the alternative but over-alkylates."] }),
  buchwald: T({ id: "buchwald-hartwig", name: "Buchwald–Hartwig amination", kind: "disconnection", reagentClass: "aryl halide + amine with a palladium catalyst, phosphine ligand and base", description: "Forms the aryl C–N bond.", reference: "Hartwig, Acc. Chem. Res. 2008", penalty: 0.5, caveats: ["Catalyst/ligand choice depends on the amine class."] }),
  grignard: T({ id: "grignard", name: "Grignard addition to a carbonyl", kind: "disconnection", reagentClass: "alkyl/aryl halide + magnesium (Grignard reagent) added to the aldehyde or ketone, then aqueous work-up", description: "Forms the C–C bond next to the alcohol carbon.", reference: "Clayden et al., ch. 9", penalty: 0.4, caveats: ["Grignard reagents are destroyed by acidic O–H/N–H groups and add to other carbonyls: protect or sequence accordingly."] }),
  grignardCO2: T({ id: "grignard-co2", name: "Grignard carboxylation", kind: "disconnection", reagentClass: "alkyl/aryl halide + magnesium, then carbon dioxide, then aqueous acid", description: "Forms the C–COOH bond.", reference: "Clayden et al., ch. 9", penalty: 0.4, caveats: ["Not compatible with acidic groups or other electrophiles in the halide."] }),
  carbonylReduction: T({ id: "carbonyl-reduction", name: "Carbonyl reduction", kind: "fgi", reagentClass: "sodium borohydride (or catalytic hydrogenation) on the aldehyde/ketone", description: "C=O → CH–OH.", reference: "Clayden et al., ch. 6", penalty: 0.4 }),
  alcoholOxidation: T({ id: "alcohol-oxidation", name: "Alcohol oxidation", kind: "fgi", reagentClass: "a mild oxidant (Swern, Dess–Martin or PCC type) for aldehydes; chromium(VI) or hypochlorite type for ketones", description: "CH–OH → C=O.", reference: "Clayden et al., ch. 23", penalty: 0.4 }),
  acidFromAlcohol: T({ id: "acid-from-alcohol", name: "Oxidation of a primary alcohol to the acid", kind: "fgi", reagentClass: "a strong oxidant (permanganate or chromium(VI) type)", description: "CH2–OH → COOH.", reference: "Clayden et al., ch. 23", penalty: 0.5 }),
  nitrileHydrolysis: T({ id: "nitrile-hydrolysis", name: "Nitrile hydrolysis", kind: "fgi", reagentClass: "aqueous acid or base with heating", description: "C≡N → COOH.", reference: "Clayden et al., ch. 10", penalty: 0.4 }),
  cyanideSubstitution: T({ id: "cyanide-sn2", name: "Cyanide substitution", kind: "disconnection", reagentClass: "alkyl halide + an alkali cyanide (SN2)", description: "Forms the C–CN bond and adds one carbon.", reference: "Clayden et al., ch. 15", penalty: 0.3 }),
  sandmeyer: T({ id: "sandmeyer", name: "Sandmeyer reaction", kind: "fgi", reagentClass: "diazotisation of the aryl amine (nitrite, acid) then a copper(I) salt (CuCN, CuCl, CuBr)", description: "Ar–NH2 → Ar–CN / Ar–Cl / Ar–Br.", reference: "Clayden et al., ch. 22", penalty: 0.6 }),
  wittig: T({ id: "wittig", name: "Wittig olefination", kind: "disconnection", reagentClass: "phosphonium ylide (alkyl halide + triphenylphosphine, then base) + aldehyde or ketone", description: "Forms the C=C bond.", reference: "Clayden et al., ch. 27", penalty: 0.4, caveats: ["E/Z selectivity depends on the ylide (stabilised → E, unstabilised → Z)."] }),
  dehydration: T({ id: "dehydration", name: "Alcohol dehydration", kind: "fgi", reagentClass: "acid catalyst with heating (or E2 from the alkyl halide with a strong base)", description: "CH–C–OH → C=C.", reference: "Clayden et al., ch. 17", penalty: 0.6, caveats: ["Zaitsev regiochemistry and carbocation rearrangements are not checked."] }),
  alkynylation: T({ id: "alkynide-alkylation", name: "Alkynide alkylation", kind: "disconnection", reagentClass: "terminal alkyne + a strong base (amide or organolithium), then a primary alkyl halide", description: "Forms the C(sp)–C(sp3) bond.", reference: "Clayden et al., ch. 9", penalty: 0.3 }),
  nitration: T({ id: "nitration", name: "Aromatic nitration", kind: "disconnection", reagentClass: "nitric acid / sulfuric acid mixture", description: "Installs Ar–NO2.", reference: "Clayden et al., ch. 21", penalty: 0.4, caveats: ["Position relative to existing substituents follows directing effects, which are not checked."] }),
  halogenation: T({ id: "aromatic-halogenation", name: "Aromatic halogenation", kind: "disconnection", reagentClass: "elemental halogen with a Lewis-acid catalyst (or N-halosuccinimide)", description: "Installs Ar–Cl / Ar–Br.", reference: "Clayden et al., ch. 21", penalty: 0.4, caveats: ["Regiochemistry follows directing effects (not checked); activated rings over-halogenate."] }),
  sulfonation: T({ id: "sulfonation", name: "Aromatic sulfonation", kind: "disconnection", reagentClass: "fuming sulfuric acid", description: "Installs Ar–SO3H.", reference: "Clayden et al., ch. 21", penalty: 0.5, caveats: ["Reversible; regiochemistry not checked."] }),
  nitroReduction: T({ id: "nitro-reduction", name: "Nitro reduction", kind: "fgi", reagentClass: "catalytic hydrogenation, or iron/tin in acid", description: "Ar–NO2 → Ar–NH2.", reference: "Clayden et al., ch. 21", penalty: 0.3 }),
  fcAcylation: T({ id: "friedel-crafts-acylation", name: "Friedel–Crafts acylation", kind: "disconnection", reagentClass: "arene + acyl chloride (or anhydride) with aluminium chloride", description: "Forms the aryl C–C(=O) bond.", reference: "Clayden et al., ch. 21", penalty: 0.4, caveats: ["Fails on strongly deactivated rings; regiochemistry follows directing effects (not checked)."] }),
  fcAlkylation: T({ id: "friedel-crafts-alkylation", name: "Friedel–Crafts alkylation", kind: "disconnection", reagentClass: "arene + alkyl halide with aluminium chloride", description: "Forms the aryl C–C(sp3) bond.", reference: "Clayden et al., ch. 21", penalty: 0.8, caveats: ["Carbocation rearrangements and poly-alkylation are common; acylation followed by reduction is usually cleaner."] }),
  suzuki: T({ id: "suzuki", name: "Suzuki–Miyaura coupling", kind: "disconnection", reagentClass: "aryl halide + aryl boronic acid with a palladium catalyst and base", description: "Forms the biaryl C–C bond.", reference: "Miyaura & Suzuki, Chem. Rev. 1995", penalty: 0.3 }),
  sulfonamide: T({ id: "sulfonamide", name: "Sulfonamide formation", kind: "disconnection", reagentClass: "sulfonyl chloride + amine with a base", description: "Forms the S(=O)2–N bond.", reference: "Clayden et al., ch. 10", penalty: 0.2 }),
  aldol: T({ id: "aldol", name: "Aldol addition", kind: "disconnection", reagentClass: "enolisable carbonyl compound + aldehyde/ketone with base (or a preformed enolate)", description: "Forms the Cα–Cβ bond of a β-hydroxy carbonyl.", reference: "Clayden et al., ch. 26", penalty: 0.4, caveats: ["Crossed aldols need one non-enolisable partner or a directed enolate to avoid self-condensation."] }),
  aldolCondensation: T({ id: "aldol-condensation", name: "Aldol condensation", kind: "disconnection", reagentClass: "enolisable carbonyl compound + aldehyde/ketone with base and heating (dehydration in situ)", description: "Forms the C=C of an α,β-unsaturated carbonyl.", reference: "Clayden et al., ch. 26", penalty: 0.4 }),
  halideFromAlcohol: T({ id: "halide-from-alcohol", name: "Alkyl halide from the alcohol", kind: "fgi", reagentClass: "hydrogen bromide, phosphorus tribromide or thionyl chloride", description: "C–OH → C–Br / C–Cl.", reference: "Clayden et al., ch. 15", penalty: 0.3 }),
  epoxidation: T({ id: "epoxidation", name: "Alkene epoxidation", kind: "fgi", reagentClass: "a peroxy acid (mCPBA type)", description: "C=C → epoxide.", reference: "Clayden et al., ch. 19", penalty: 0.3 }),
} as const;

export const REACTION_TEMPLATES: readonly ReactionTemplate[] = Object.values(TEMPLATES);

type Matcher = (ctx: Ctx) => RetroMove[];

const move = (ctx: Ctx, template: ReactionTemplate, edited: Molecule, bondIds: BondId[], label: string, reagents: string[] = [], notes: string[] = [], extraPenalty = 0): RetroMove => ({ template, bondIds, precursors: pieces(edited, ctx.mol, label), reagents, notes, extraPenalty });

const MATCHERS: Matcher[] = [
  // Ester → acid + alcohol; amide → acid + amine.
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const c of m.atoms) {
      if (!isCarbonyl(m, c.id)) continue;
      for (const x of [...singleTo(m, c.id, "O"), ...singleTo(m, c.id, "N")]) {
        const b = bondTo(m, c.id, x)!;
        if (ctx.ringBonds.has(b.id)) continue;
        const isO = el(m, x) === "O";
        if (isO && heavyNb(m, x).length !== 2) continue; // acid OH, not an ester
        if (!isO && bondsOfAtom(m, x).some((bb) => bb.order !== "single")) continue;
        let e = removeBond(m, b.id);
        e = cap(e, c.id, "OH");
        e = cap(e, x, "H");
        out.push(move(ctx, isO ? TEMPLATES.ester : TEMPLATES.amide, e, [b.id], isO ? "ester" : "amide"));
      }
    }
    return out;
  },
  // Ether / thioether at an sp3 carbon → alcohol/thiol + alkyl halide.
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const x of m.atoms) {
      if ((x.element !== "O" && x.element !== "S") || bondsOfAtom(m, x.id).some((b) => b.order !== "single")) continue;
      const heavy = heavyNb(m, x.id);
      if (heavy.length !== 2 || !heavy.every((n) => el(m, n) === "C")) continue;
      if (heavy.some((n) => isCarbonyl(m, n))) continue; // ester, handled above
      for (const c of heavy) {
        if (!isSp3C(m, c)) continue;
        const b = bondTo(m, x.id, c)!;
        if (ctx.ringBonds.has(b.id)) continue;
        const degree = heavyNb(m, c).length - 1;
        if (degree >= 3) continue; // tertiary: no SN2
        let e = removeBond(m, b.id);
        e = cap(e, x.id, "H");
        e = cap(e, c, "Br");
        out.push(move(ctx, x.element === "O" ? TEMPLATES.williamson : TEMPLATES.thioether, e, [b.id], "ether", [], degree === 2 ? ["Secondary halide: expect competing elimination."] : [], degree === 2 ? 0.4 : 0));
      }
    }
    return out;
  },
  // Amine C–N: reductive amination (sp3 C with H) or Buchwald–Hartwig (aryl C).
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const n of m.atoms) {
      if (n.element !== "N" || n.formalCharge !== 0 || bondsOfAtom(m, n.id).some((b) => b.order !== "single")) continue;
      const heavy = heavyNb(m, n.id);
      if (!heavy.every((c) => el(m, c) === "C") || heavy.some((c) => isCarbonyl(m, c) || el(m, c) === "S")) continue;
      for (const c of heavy) {
        const b = bondTo(m, n.id, c)!;
        if (ctx.ringBonds.has(b.id)) continue;
        if (isSp3C(m, c) && hCount(m, c) >= 1) {
          let e = removeBond(m, b.id);
          e = cap(e, n.id, "H");
          e = cap(removeOneH(e, c), c, "=O");
          out.push(move(ctx, TEMPLATES.reductiveAmination, e, [b.id], "amine"));
        } else if (ctx.arom.has(c)) {
          let e = removeBond(m, b.id);
          e = cap(e, n.id, "H");
          e = cap(e, c, "Br");
          out.push(move(ctx, TEMPLATES.buchwald, e, [b.id], "arylamine"));
        }
      }
    }
    return out;
  },
  // Alcohols: Grignard disconnection and carbonyl-reduction FGI.
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const o of m.atoms) {
      if (o.element !== "O" || hCount(m, o.id) < 1 || heavyNb(m, o.id).length !== 1) continue;
      const c = heavyNb(m, o.id)[0]!;
      if (!isSp3C(m, c) || ctx.arom.has(c)) continue;
      const others = heavyNb(m, c).filter((n) => n !== o.id);
      if (others.length >= 1 && hCount(m, c) >= 1) {
        // Secondary/primary alcohol ← carbonyl reduction.
        const e = oxidiseCarbinol(m, c, o.id);
        out.push(move(ctx, TEMPLATES.carbonylReduction, e, [bondTo(m, c, o.id)!.id], "reduce"));
      }
      for (const r of others) {
        if (el(m, r) !== "C") continue;
        const b = bondTo(m, c, r)!;
        if (ctx.ringBonds.has(b.id) || isCarbonyl(m, r)) continue;
        let e = removeBond(m, b.id);
        e = oxidiseCarbinol(e, c, o.id);
        e = cap(e, r, "Br");
        const acidic = hasAcidicProtons(m, [o.id]);
        out.push(move(ctx, TEMPLATES.grignard, e, [b.id], "grignard", ["Mg (forms the Grignard reagent from the bromide)"], acidic.length ? [`Acidic groups present (${acidic.join(", ")}): they quench Grignard reagents, protect them first.`] : [], acidic.length ? 0.8 : 0));
      }
    }
    return out;
  },
  // Ketones/aldehydes: alcohol oxidation (FGI) and Friedel–Crafts acylation (aryl ketones).
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const c of m.atoms) {
      if (!isCarbonyl(m, c.id) || isCarboxylC(m, c.id) || isEsterC(m, c.id) || isAmideC(m, c.id)) continue;
      const o = doubleTo(m, c.id, "O")[0]!;
      if (singleTo(m, c.id, "O").length || singleTo(m, c.id, "N").length) continue; // acid derivative
      const subs = heavyNb(m, c.id).filter((n) => n !== o);
      out.push(move(ctx, TEMPLATES.alcoholOxidation, reduceCarbonyl(m, c.id, o), [bondTo(m, c.id, o)!.id], "oxidise"));
      for (const ar of subs) {
        if (!ctx.arom.has(ar)) continue;
        const b = bondTo(m, c.id, ar)!;
        if (ctx.ringBonds.has(b.id)) continue;
        let e = removeBond(m, b.id);
        e = cap(e, ar, "H");
        e = cap(e, c.id, "Cl");
        out.push(move(ctx, TEMPLATES.fcAcylation, e, [b.id], "fc-acyl"));
      }
    }
    return out;
  },
  // Carboxylic acids: from primary alcohol, from nitrile, from Grignard + CO2.
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const c of m.atoms) {
      if (!isCarboxylC(m, c.id)) continue;
      const o = doubleTo(m, c.id, "O")[0]!;
      const oh = singleTo(m, c.id, "O").find((x) => heavyNb(m, x).length === 1)!;
      const r = heavyNb(m, c.id).find((n) => n !== o && n !== oh);
      if (r === undefined) continue; // formic acid
      // ← primary alcohol: drop the =O, add two H on carbon.
      let e = removeAtom(m, o);
      e = cap(e, c.id, "H");
      e = cap(e, c.id, "H");
      out.push(move(ctx, TEMPLATES.acidFromAlcohol, e, [bondTo(m, c.id, o)!.id], "acid-ox"));
      // ← nitrile: remove OH, make the =O a triple-bonded N.
      let n = removeAtom(m, oh);
      n = updateAtom(n, o, { element: "N" });
      n = setBondOrder(n, bondTo(n, c.id, o)!.id, "triple");
      out.push(move(ctx, TEMPLATES.nitrileHydrolysis, n, [bondTo(m, c.id, o)!.id], "nitrile"));
      // ← R–Br + Mg + CO2.
      if (el(m, r) === "C" && !ctx.ringBonds.has(bondTo(m, c.id, r)!.id)) {
        let g = removeAtom(removeAtom(removeAtom(m, o), oh), c.id);
        g = cap(g, r, "Br");
        const acidic = hasAcidicProtons(m, [oh]);
        out.push(move(ctx, TEMPLATES.grignardCO2, g, [bondTo(m, c.id, r)!.id], "co2", ["Mg", "CO2"], acidic.length ? [`Acidic groups present (${acidic.join(", ")}): protect before forming the Grignard reagent.`] : [], acidic.length ? 0.8 : 0));
      }
    }
    return out;
  },
  // Nitriles: alkyl–CN ← alkyl bromide + cyanide; aryl–CN ← aryl amine (Sandmeyer).
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const c of m.atoms) {
      if (c.element !== "C") continue;
      const n = bondsOfAtom(m, c.id)
        .filter((b) => b.order === "triple")
        .map((b) => other(b, c.id))
        .find((x) => el(m, x) === "N" && heavyNb(m, x).length === 1);
      if (n === undefined) continue;
      const r = heavyNb(m, c.id).find((x) => x !== n);
      if (r === undefined) continue;
      const b = bondTo(m, c.id, r)!;
      if (isSp3C(m, r) && hCount(m, r) >= 1 && heavyNb(m, r).length <= 2) {
        let e = removeAtom(removeAtom(m, n), c.id);
        e = cap(e, r, "Br");
        out.push(move(ctx, TEMPLATES.cyanideSubstitution, e, [b.id], "cn", ["NaCN"]));
      } else if (ctx.arom.has(r)) {
        let e = removeAtom(removeAtom(m, n), c.id);
        e = cap(e, r, "NH2");
        out.push(move(ctx, TEMPLATES.sandmeyer, e, [b.id], "sandmeyer", ["NaNO2 / acid, then CuCN"]));
      }
    }
    return out;
  },
  // Alkenes: Wittig (both orientations) and dehydration; α,β-unsaturated carbonyls: aldol condensation.
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const b of m.bonds) {
      if (b.order !== "double" || ctx.ringBonds.has(b.id)) continue;
      const [p, q] = [b.atomA, b.atomB];
      if (el(m, p) !== "C" || el(m, q) !== "C") continue;
      const carbonylNb = (x: AtomId) => heavyNb(m, x).find((n) => isCarbonyl(m, n) && n !== p && n !== q);
      const enone = carbonylNb(p) ? [p, q] : carbonylNb(q) ? [q, p] : null;
      if (enone) {
        const [alpha, beta] = enone as [AtomId, AtomId];
        let e = removeBond(m, b.id);
        e = cap(e, alpha, "H");
        e = cap(e, alpha, "H");
        e = cap(e, beta, "=O");
        out.push(move(ctx, TEMPLATES.aldolCondensation, e, [b.id], "aldol-cond"));
        continue;
      }
      for (const [carbonylSide, ylideSide] of [
        [p, q],
        [q, p],
      ] as Array<[AtomId, AtomId]>) {
        let e = removeBond(m, b.id);
        e = cap(e, carbonylSide, "=O");
        e = cap(e, ylideSide, "H");
        e = cap(e, ylideSide, "Br");
        out.push(move(ctx, TEMPLATES.wittig, e, [b.id], "wittig", ["PPh3, then base"]));
      }
      // Dehydration: OH on the more substituted carbon (Zaitsev), H on the other.
      const more = heavyNb(m, p).length >= heavyNb(m, q).length ? p : q;
      const less = more === p ? q : p;
      let d = setBondOrder(m, b.id, "single");
      d = cap(d, more, "OH");
      d = cap(d, less, "H");
      out.push(move(ctx, TEMPLATES.dehydration, d, [b.id], "dehydrate"));
    }
    return out;
  },
  // β-Hydroxy carbonyl ← aldol addition.
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const c of m.atoms) {
      if (!isCarbonyl(m, c.id) || isCarboxylC(m, c.id) || isEsterC(m, c.id) || isAmideC(m, c.id)) continue;
      const o = doubleTo(m, c.id, "O")[0]!;
      for (const alpha of heavyNb(m, c.id).filter((n) => n !== o && isSp3C(m, n))) {
        for (const beta of heavyNb(m, alpha).filter((n) => n !== c.id && isSp3C(m, n))) {
          const oh = singleTo(m, beta, "O").find((x) => heavyNb(m, x).length === 1 && hCount(m, x) >= 1);
          if (oh === undefined) continue;
          const b = bondTo(m, alpha, beta)!;
          if (ctx.ringBonds.has(b.id)) continue;
          let e = removeBond(m, b.id);
          e = cap(e, alpha, "H");
          e = oxidiseCarbinol(e, beta, oh);
          out.push(move(ctx, TEMPLATES.aldol, e, [b.id], "aldol"));
        }
      }
    }
    return out;
  },
  // Alkynes: internal C≡C–CH2R ← terminal alkyne + primary halide.
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const b of m.bonds) {
      if (b.order !== "triple" || el(m, b.atomA) !== "C" || el(m, b.atomB) !== "C") continue;
      for (const sp of [b.atomA, b.atomB]) {
        const r = heavyNb(m, sp).find((n) => n !== other(b, sp));
        if (r === undefined || !isSp3C(m, r) || heavyNb(m, r).length > 2 || hCount(m, r) < 2) continue;
        const cb = bondTo(m, sp, r)!;
        if (ctx.ringBonds.has(cb.id)) continue;
        let e = removeBond(m, cb.id);
        e = cap(e, sp, "H");
        e = cap(e, r, "Br");
        out.push(move(ctx, TEMPLATES.alkynylation, e, [cb.id], "alkyne"));
      }
    }
    return out;
  },
  // Aromatic substituents: NO2, Cl/Br, SO3H, NH2 (via NO2), alkyl (Friedel–Crafts); biaryl (Suzuki).
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    const substituents = m.atoms.filter((a) => ctx.arom.has(a.id)).reduce((s, a) => s + heavyNb(m, a.id).filter((n) => !ctx.arom.has(n)).length, 0);
    const crowd = substituents >= 3 ? ["Several ring substituents already present: the regiochemistry of a further substitution is not verified."] : [];
    for (const ar of m.atoms) {
      if (!ctx.arom.has(ar.id)) continue;
      for (const x of heavyNb(m, ar.id)) {
        const b = bondTo(m, ar.id, x)!;
        if (ctx.ringBonds.has(b.id)) continue;
        const xe = el(m, x);
        const xHeavy = heavyNb(m, x);
        if (xe === "N" && xHeavy.length === 3 && getAtom(m, x)!.formalCharge === 1 && xHeavy.filter((n) => el(m, n) === "O").length === 2) {
          // Nitro group.
          let e = m;
          for (const o of xHeavy.filter((n) => n !== ar.id)) e = removeAtom(e, o);
          e = removeAtom(e, x);
          e = cap(e, ar.id, "H");
          out.push(move(ctx, TEMPLATES.nitration, e, [b.id], "nitro", ["HNO3 / H2SO4"], crowd));
        } else if ((xe === "Cl" || xe === "Br") && xHeavy.length === 1) {
          let e = removeAtom(m, x);
          e = cap(e, ar.id, "H");
          out.push(move(ctx, TEMPLATES.halogenation, e, [b.id], "halo", [`${xe}2 / Lewis acid`], crowd));
        } else if (xe === "S" && xHeavy.length === 4 && xHeavy.filter((n) => el(m, n) === "O").length === 3) {
          let e = m;
          for (const o of xHeavy.filter((n) => n !== ar.id)) {
            for (const h of neighborsOf(e, o).filter((n) => isH(e, n))) e = removeAtom(e, h);
            e = removeAtom(e, o);
          }
          e = removeAtom(e, x);
          e = cap(e, ar.id, "H");
          out.push(move(ctx, TEMPLATES.sulfonation, e, [b.id], "sulfo", ["SO3 / H2SO4"], crowd));
        } else if (xe === "N" && xHeavy.length === 1 && hCount(m, x) === 2 && getAtom(m, x)!.formalCharge === 0) {
          // Aniline ← nitroarene.
          let e = m;
          for (const h of neighborsOf(m, x).filter((n) => isH(m, n))) e = removeAtom(e, h);
          e = removeAtom(e, x);
          e = cap(e, ar.id, "NO2");
          out.push(move(ctx, TEMPLATES.nitroReduction, e, [b.id], "nitro-red"));
        } else if (xe === "C" && isSp3C(m, x) && hCount(m, x) >= 1 && !xHeavy.some((n) => n !== ar.id && (["O", "N", "S"].includes(el(m, n)) || isCarbonyl(m, n)))) {
          let e = removeBond(m, b.id);
          e = cap(e, ar.id, "H");
          e = cap(e, x, "Cl");
          out.push(move(ctx, TEMPLATES.fcAlkylation, e, [b.id], "fc-alkyl", ["AlCl3"], crowd));
        } else if (xe === "C" && ctx.arom.has(x)) {
          let e = removeBond(m, b.id);
          e = cap(e, ar.id, "Br");
          e = cap(e, x, "B(OH)2");
          out.push(move(ctx, TEMPLATES.suzuki, e, [b.id], "suzuki", ["Pd catalyst, base"]));
        }
      }
    }
    // Dedupe symmetric duplicates (same precursor key set) later in the search.
    return out;
  },
  // Sulfonamides.
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const s of m.atoms) {
      if (s.element !== "S" || doubleTo(m, s.id, "O").length !== 2) continue;
      for (const n of singleTo(m, s.id, "N")) {
        const b = bondTo(m, s.id, n)!;
        if (ctx.ringBonds.has(b.id)) continue;
        let e = removeBond(m, b.id);
        e = cap(e, s.id, "Cl");
        e = cap(e, n, "H");
        out.push(move(ctx, TEMPLATES.sulfonamide, e, [b.id], "sulfonamide"));
      }
    }
    return out;
  },
  // Alkyl halides ← alcohols; epoxides ← alkenes.
  (ctx) => {
    const out: RetroMove[] = [];
    const m = ctx.mol;
    for (const x of m.atoms) {
      if ((x.element === "Br" || x.element === "Cl" || x.element === "I") && heavyNb(m, x.id).length === 1) {
        const c = heavyNb(m, x.id)[0]!;
        if (!isSp3C(m, c)) continue;
        let e = removeAtom(m, x.id);
        e = cap(e, c, "OH");
        out.push(move(ctx, TEMPLATES.halideFromAlcohol, e, [bondTo(m, x.id, c)!.id], "halide"));
      }
      if (x.element === "O" && heavyNb(m, x.id).length === 2) {
        const [a, b] = heavyNb(m, x.id) as [AtomId, AtomId];
        const cc = bondTo(m, a, b);
        if (cc && cc.order === "single" && el(m, a) === "C" && el(m, b) === "C") {
          let e = removeAtom(m, x.id);
          e = setBondOrder(e, cc.id, "double");
          out.push(move(ctx, TEMPLATES.epoxidation, e, [cc.id], "epoxide"));
        }
      }
    }
    return out;
  },
];

/** All retrosynthetic moves that apply to one structure. */
export function enumerateMoves(mol: Molecule): RetroMove[] {
  const ctx: Ctx = { mol, arom: aromaticSet(mol), ringBonds: new Set(mol.bonds.filter((b) => bondInRing(mol, b.id)).map((b) => b.id)) };
  const out: RetroMove[] = [];
  for (const matcher of MATCHERS) {
    try {
      out.push(...matcher(ctx));
    } catch {
      /* a malformed local pattern must not kill the whole search */
    }
  }
  // Safety net: a template that produced an over-valent or otherwise invalid precursor is dropped.
  return out.filter((mv) => mv.precursors.every((p) => validateMolecule(p).valid));
}

function aromaticSet(mol: Molecule): Set<AtomId> {
  const s = aromaticAtoms(mol);
  for (const b of mol.bonds) if (b.order === "aromatic") s.add(b.atomA).add(b.atomB);
  return s;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const SMALL_FRAGMENT = 6;
const MAX_MOVES_PER_NODE = 6;
const MAX_NODES = 160;

interface Node {
  precursor: Precursor;
  cost: number;
  /** Move that produced `precursor` from its children (undefined for leaves). */
  move?: RetroMove;
  children: Node[];
}

/** Canonical SMILES without stereo marks: the planner compares constitutions only. */
const stripStereo = (s: string) => s.replace(/[@/\\]/g, "");

export class RuleBasedSynthesisPlanner implements SynthesisPlanner {
  readonly label = "Rule-based route planner (textbook templates)";
  readonly disclaimer = SYNTHESIS_DISCLAIMER;
  private searched = 0;

  constructor(
    private readonly smilesOf: ((mol: Molecule) => Promise<string>) | null,
    private readonly screener: TargetScreener = NO_SCREENER,
  ) {}

  private async describe(mol: Molecule, status: PrecursorStatus): Promise<Precursor> {
    let smiles: string | null = null;
    if (this.smilesOf) {
      try {
        smiles = await this.smilesOf(mol);
      } catch {
        smiles = null;
      }
    }
    // The planner tracks constitution only, so precursors are shown without stereo marks.
    if (smiles) smiles = stripStereo(smiles);
    const key = smiles;
    const name = key ? (BUILDING_BLOCKS.get(key) ?? null) : null;
    const heavyAtomCount = mol.atoms.filter((a) => a.element !== "H").length;
    const finalStatus: PrecursorStatus = name ? "building-block" : status === "intermediate" ? "intermediate" : heavyAtomCount <= SMALL_FRAGMENT ? "small-fragment" : status;
    return { molecule: mol, smiles, formula: molecularFormula(mol, { includeImplicitHydrogens: true }), heavyAtomCount, status: finalStatus, name };
  }

  private keyOf(p: Precursor): string {
    return p.smiles ? stripStereo(p.smiles) : `${p.formula}|${p.molecule.bonds.length}`;
  }

  private async solve(mol: Molecule, depth: number, path: Set<string>, memo: Map<string, Node>): Promise<Node> {
    const p = await this.describe(mol, "unresolved");
    const key = this.keyOf(p);
    if (p.status === "building-block" || p.status === "small-fragment") return { precursor: p, cost: p.status === "building-block" ? 0 : 0.5, children: [] };
    const unresolved: Node = { precursor: { ...p, status: "unresolved" }, cost: 3 + p.heavyAtomCount / 5, children: [] };
    if (depth === 0 || path.has(key) || this.searched >= MAX_NODES) return unresolved;
    const cached = memo.get(key);
    if (cached && cached.precursor.status !== "unresolved") return cached;
    this.searched += 1;
    const moves = rankMoves(enumerateMoves(mol)).slice(0, MAX_MOVES_PER_NODE);
    let best = unresolved;
    const nextPath = new Set(path).add(key);
    for (const mv of moves) {
      const children: Node[] = [];
      let cost = 1 + mv.template.penalty + mv.extraPenalty;
      for (const pre of mv.precursors) {
        const child = await this.solve(pre, depth - 1, nextPath, memo);
        children.push(child);
        cost += child.cost;
        if (cost >= best.cost) break;
      }
      if (children.length === mv.precursors.length && cost < best.cost) best = { precursor: { ...p, status: "intermediate" }, cost, move: mv, children };
    }
    memo.set(key, best);
    return best;
  }

  async plan(target: Molecule, opts: { maxDepth?: number } = {}): Promise<SynthesisPlan> {
    const maxDepth = opts.maxDepth ?? 3;
    this.searched = 0;
    const screening = this.screener.screen(target);
    const targetP = await this.describe(target, "intermediate");
    const base: Omit<SynthesisPlan, "routes" | "reason"> = { kind: "predicted", model: "rule templates v1 (fixed textbook disconnections, heuristic ranking)", target: targetP, screening, searched: 0, disclaimer: this.disclaimer, notes: targetP.name ? [`${targetP.name} is itself a common building block (commercially available); the route below shows how it is typically made.`] : [] };
    if (!screening.permitted) return { ...base, routes: [], reason: `Synthesis planning withheld: target not permitted by ${screening.screener}.` };
    if (target.atoms.filter((a) => a.element !== "H").length < 2) return { ...base, routes: [], reason: "Target too small to plan." };
    const memo = new Map<string, Node>();
    const moves = rankMoves(enumerateMoves(target)).slice(0, MAX_MOVES_PER_NODE);
    if (moves.length === 0) return { ...base, routes: [], reason: "No reaction template applies to this target (the planner covers esters, amides, ethers, amines, alcohols, carbonyls, acids, nitriles, alkenes, alkynes, aromatic substitution, biaryls, sulfonamides, aldols, epoxides)." };
    const roots: Node[] = [];
    const path = new Set<string>([this.keyOf(targetP)]);
    for (const mv of moves) {
      const children: Node[] = [];
      let cost = 1 + mv.template.penalty + mv.extraPenalty;
      for (const pre of mv.precursors) {
        const child = await this.solve(pre, maxDepth - 1, path, memo);
        children.push(child);
        cost += child.cost;
      }
      roots.push({ precursor: targetP, cost, move: mv, children });
    }
    roots.sort((a, b) => a.cost - b.cost);
    const routes = dedupeRoutes(roots.map((r) => toRoute(r))).slice(0, 3);
    return { ...base, searched: this.searched, routes, reason: null };
  }
}

function rankMoves(moves: RetroMove[]): RetroMove[] {
  const seen = new Set<string>();
  const out: RetroMove[] = [];
  for (const mv of moves) {
    const sig = `${mv.template.id}|${mv.precursors.map((p) => molecularFormula(p, { includeImplicitHydrogens: true }) + p.bonds.length).sort().join("+")}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(mv);
  }
  const biggest = (mv: RetroMove) => Math.max(...mv.precursors.map((p) => p.atoms.filter((a) => a.element !== "H").length));
  return out.sort((a, b) => biggest(a) - biggest(b) || a.template.penalty + a.extraPenalty - (b.template.penalty + b.extraPenalty));
}

/** Flatten a solved tree into forward steps (leaves first). */
function toRoute(root: Node): SynthesisRoute {
  const steps: SynthesisStep[] = [];
  const startingMaterials: Precursor[] = [];
  const unresolved: Precursor[] = [];
  const walk = (n: Node): void => {
    if (!n.move) {
      (n.precursor.status === "unresolved" ? unresolved : startingMaterials).push(n.precursor);
      return;
    }
    for (const c of n.children) walk(c);
    steps.push({ index: steps.length + 1, template: n.move.template, reactants: n.children.map((c) => c.precursor), reagents: n.move.reagents, product: n.precursor, bondIds: n.move.bondIds, notes: [...n.move.notes, ...n.move.template.caveats] });
  };
  walk(root);
  const notes: string[] = [];
  if (unresolved.length) notes.push(`${unresolved.length} precursor${unresolved.length > 1 ? "s" : ""} could not be traced to a building block within the search depth; plan ${unresolved.length > 1 ? "them" : "it"} separately or source ${unresolved.length > 1 ? "them" : "it"}.`);
  if (startingMaterials.some((p) => p.status === "small-fragment")) notes.push("Small fragments (≤ 6 heavy atoms) are assumed to be available without checking a catalogue.");
  return { steps, stepCount: steps.length, score: Math.round(root.cost * 100) / 100, startingMaterials, unresolved, notes };
}

function dedupeRoutes(routes: SynthesisRoute[]): SynthesisRoute[] {
  const seen = new Set<string>();
  return routes.filter((r) => {
    const sig = r.steps.map((s) => `${s.template.id}:${s.reactants.map((p) => p.formula).sort().join("+")}`).join(">");
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

/** Human-readable forward sentences for the assistant report. */
export function describeRoute(route: SynthesisRoute): string[] {
  const label = (p: Precursor) => (p.name ? `${p.name} (${p.smiles ?? p.formula})` : p.smiles ?? p.formula);
  return route.steps.map((s) => `Step ${s.index}: ${s.reactants.map(label).join(" + ")}${s.reagents.length ? ` [${s.reagents.join(", ")}]` : ""} → ${label(s.product)} via ${s.template.name.toLowerCase()} (${s.template.reagentClass}).`);
}
