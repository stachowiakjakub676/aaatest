import { addAtom, addBond, bondInRing, connectedComponents, detectFunctionalGroups, getAtom, placeBondedAtom, removeBond, ringCount } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { ChemistryEngine } from "../chemistry/engine";
import type { DisconnectionCandidate, Fragment, RetrosynthesisService, SafetyPolicy, TargetAnalysis, TargetScreener } from "./types";
import { NO_SCREENER, PROVENANCE_POLICY, applySafetyDecision } from "./types";

interface Strategy {
  label: string;
  description: string;
  base: number;
}

const STRATEGIES: Record<string, Strategy> = {
  ester: { label: "Ester C(=O)–O disconnection", description: "Conceptually splits the ester into an acid-derived and an alcohol-derived fragment.", base: 3 },
  amide: { label: "Amide C(=O)–N disconnection", description: "Conceptually splits the amide into an acid-derived and an amine-derived fragment.", base: 3 },
  ether: { label: "Ether C–O disconnection", description: "Conceptually splits the ether at a C–O bond.", base: 2 },
  amine: { label: "Amine C–N disconnection", description: "Conceptually splits the amine at a C–N bond.", base: 2 },
  ketone: { label: "α-Carbonyl C–C disconnection", description: "Conceptually splits a C–C bond next to a carbonyl group.", base: 1.5 },
  generic: { label: "Generic C–C disconnection", description: "Conceptual C–C bond split with no recognised retron; low priority.", base: 1 },
};

/** Cut one bond, cap both ends with hydrogen, return the two fragment molecules. */
export function splitAtBond(mol: Molecule, bondId: string): Molecule[] {
  const bond = mol.bonds.find((b) => b.id === bondId);
  if (!bond) throw new Error(`Unknown bond ${bondId}`);
  let m = removeBond(mol, bondId);
  for (const end of [bond.atomA, bond.atomB]) {
    const pos = placeBondedAtom(m, end, "H");
    const added = addAtom(m, { element: "H", position: pos });
    m = addBond(added.molecule, { atomA: end, atomB: added.atom.id }).molecule;
  }
  return connectedComponents(m).map((ids, i) => {
    const set = new Set(ids);
    return { ...m, id: `${mol.id}-frag${i + 1}`, atoms: m.atoms.filter((a) => set.has(a.id)), bonds: m.bonds.filter((b) => set.has(b.atomA) && set.has(b.atomB)), metadata: { source: "retro-fragment", parent: mol.id, cutBond: bondId } };
  });
}

export class MockRetrosynthesisService implements RetrosynthesisService {
  readonly id = "mock";
  readonly label = "Mock disconnection analysis";
  readonly disclaimer =
    "Research abstraction only. This mock lists bonds that could conceptually be disconnected and the H-capped fragments that would result. It has no reaction knowledge base, so it never proposes reagents, conditions, yields or procedures; those fields can be filled from your own notes or by a future data-backed implementation, always with provenance. Ranking is a fixed heuristic, not a model.";

  constructor(
    private readonly engine: ChemistryEngine | null,
    private readonly policy: SafetyPolicy = PROVENANCE_POLICY,
    private readonly screener: TargetScreener = NO_SCREENER,
  ) {}

  async analyzeTarget(target: Molecule): Promise<TargetAnalysis> {
    const groups = detectFunctionalGroups(target);
    const heavy = target.atoms.filter((a) => a.element !== "H");
    const disconnectable = target.bonds.filter((b) => this.isCandidateBond(target, b.id)).length;
    const notes: string[] = [];
    if (heavy.length < 4) notes.push("Target is too small for a meaningful disconnection analysis.");
    if (groups.length === 0) notes.push("No functional groups recognised; only generic C–C disconnections are available.");
    if (ringCount(target) > 0) notes.push("Ring bonds are never disconnected by this mock (ring-forming strategies are out of scope).");
    const screening = this.screener.screen(target);
    if (!screening.permitted) notes.push(`Target screening (${screening.screener}): operational details will be withheld.`);
    return { kind: "computed", heavyAtomCount: heavy.length, ringCount: ringCount(target), functionalGroups: groups, disconnectableBondCount: disconnectable, screening, notes };
  }

  private isCandidateBond(mol: Molecule, bondId: string): boolean {
    const b = mol.bonds.find((x) => x.id === bondId);
    if (!b || b.order !== "single") return false;
    const a = getAtom(mol, b.atomA);
    const c = getAtom(mol, b.atomB);
    if (!a || !c || a.element === "H" || c.element === "H") return false;
    return !bondInRing(mol, bondId);
  }

  async generateCandidates(target: Molecule, analysis: TargetAnalysis): Promise<DisconnectionCandidate[]> {
    const strategyByBond = new Map<string, string>();
    for (const g of analysis.functionalGroups) for (const bid of g.keyBondIds) if (!strategyByBond.has(bid)) strategyByBond.set(bid, g.id);
    const out: DisconnectionCandidate[] = [];
    for (const bond of target.bonds) {
      if (!this.isCandidateBond(target, bond.id)) continue;
      const strategyId = strategyByBond.get(bond.id) ?? (getAtom(target, bond.atomA)!.element === "C" && getAtom(target, bond.atomB)!.element === "C" ? "generic" : null);
      if (!strategyId) continue;
      const strategy = STRATEGIES[strategyId] ?? STRATEGIES.generic!;
      const pieces = splitAtBond(target, bond.id);
      if (pieces.length !== 2) continue;
      const fragments: Fragment[] = [];
      for (const piece of pieces) {
        const heavyAtomCount = piece.atoms.filter((a) => a.element !== "H").length;
        let smiles: string | null = null;
        if (this.engine) {
          try {
            smiles = await this.engine.toSmiles(piece);
          } catch {
            smiles = null;
          }
        }
        fragments.push({ atomIds: piece.atoms.map((a) => a.id).filter((id) => getAtom(target, id) !== undefined), heavyAtomCount, smiles });
      }
      if (fragments.some((f) => f.heavyAtomCount < 2)) continue; // cutting off a single atom is not a disconnection
      const sizes = fragments.map((f) => f.heavyAtomCount);
      const balance = Math.min(...sizes) / Math.max(...sizes);
      const rationale = [`${strategy.description}`, `Fragment sizes ${sizes.join(" + ")} heavy atoms (balance ${balance.toFixed(2)}).`];
      const candidate: DisconnectionCandidate = { id: `cut-${bond.id}`, bondId: bond.id, strategy: strategy.label, description: strategy.description, fragments, score: strategy.base + balance, rank: 0, rationale };
      const decision = this.policy.screen(candidate, analysis.screening);
      if (decision.allowed) out.push(applySafetyDecision(candidate, decision));
    }
    return out;
  }

  async rankCandidates(candidates: DisconnectionCandidate[]): Promise<DisconnectionCandidate[]> {
    return [...candidates]
      .sort((a, b) => b.score - a.score || a.bondId.localeCompare(b.bondId))
      .map((c, i) => ({ ...c, rank: i + 1, rationale: [...c.rationale, "Rank from a fixed heuristic (retron class + fragment balance), not a learned or literature-based model."] }));
  }
}
