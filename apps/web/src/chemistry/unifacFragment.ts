/**
 * UNIFAC group assignment by SMARTS matching on RDKit (WebAssembly), a port of the priority
 * fragmentation in the thermo library (`smarts_fragment_priority`): every subgroup pattern is
 * matched, groups are taken greedily in priority order without atom overlap, and the result is
 * accepted only when every heavy atom and every hydrogen is accounted for. If the greedy pass
 * fails, small sets of matches are excluded and the pass repeated (up to 5000 tries), so that
 * e.g. an ester oxygen is not stolen by an ether group. The catalogue (SMARTS, priorities,
 * hydrogen counts) is the generated `UNIFAC_SUBGROUPS` table, so the assignments agree with the
 * reference implementation by construction (checked in apps/web/test/unifac.test.ts).
 */
import { UNIFAC_SUBGROUPS, getAtom, implicitHydrogenCount, neighborsOf, writeMolfile } from "@molecular-cad/molecule-model";
import type { Molecule, UnifacGroups, UnifacSubgroup } from "@molecular-cad/molecule-model";
import type { RDKitModule, RDKitMol } from "./wasmEngine";

export interface UnifacAssignment {
  groups: UnifacGroups;
  /** Atom indices (heavy atoms, in molecule order) per occurrence of each subgroup. */
  matches: Record<number, number[][]>;
  success: boolean;
  status: string;
}

const FAIL = (status: string): UnifacAssignment => ({ groups: {}, matches: {}, success: false, status });

const catalog: UnifacSubgroup[] = Object.values(UNIFAC_SUBGROUPS);
// Higher priority first; ties broken by higher id (the reference sorts (priority, id) descending).
const catalogByPriority = [...catalog].sort((a, b) => b.priority - a.priority || b.id - a.id);
const qmols = new Map<string, RDKitMol | null>();

function queryMol(RDKit: RDKitModule, smarts: string): RDKitMol | null {
  if (!qmols.has(smarts)) qmols.set(smarts, RDKit.get_qmol(smarts));
  return qmols.get(smarts) ?? null;
}

function parseMatches(text: string): number[][] {
  try {
    const raw = JSON.parse(text) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.map((m) => (m as { atoms?: number[] }).atoms ?? []).filter((a) => a.length > 0);
  } catch {
    return [];
  }
}

type Match = { key: string; atoms: number[] };

function runMatch(allMatches: Map<number, Match[]>, ignore: Set<string>, atomCount: number, hTotal: number) {
  const matched = new Set<number>();
  const counts: UnifacGroups = {};
  const assignments: Record<number, number[][]> = {};
  for (const g of catalogByPriority) {
    const list = allMatches.get(g.id);
    if (!list) continue;
    for (const m of list) {
      if (m.atoms.some((a) => matched.has(a))) continue;
      if (m.atoms.length === atomCount && hTotal && g.hydrogens !== hTotal && !g.hydrogenFromSmarts) continue;
      if (ignore.has(m.key)) continue;
      for (const a of m.atoms) matched.add(a);
      counts[g.id] = (counts[g.id] ?? 0) + 1;
      (assignments[g.id] ??= []).push(m.atoms);
    }
  }
  return { matched, counts, assignments };
}

function hydrogensFound(assignments: Record<number, number[][]>, hPerAtom: number[]): number {
  let h = 0;
  for (const [id, list] of Object.entries(assignments)) {
    const g = UNIFAC_SUBGROUPS[Number(id)]!;
    for (const atoms of list) h += g.hydrogenFromSmarts ? atoms.reduce((s, a) => s + (hPerAtom[a] ?? 0), 0) : g.hydrogens;
  }
  return h;
}

function* combinations<T>(items: T[], k: number, start = 0, prefix: T[] = []): Generator<T[]> {
  if (prefix.length === k) {
    yield prefix;
    return;
  }
  for (let i = start; i <= items.length - (k - prefix.length); i++) yield* combinations(items, k, i + 1, [...prefix, items[i]!]);
}

/** Sets of match keys to exclude: whole multi-match groups and individual matches, up to `maxRemove` units. */
function* ignoreCombinations(allMatches: Map<number, Match[]>, maxRemove = 4): Generator<Set<string>> {
  const units: string[][] = [];
  for (const list of allMatches.values()) if (list.length > 1) units.push(list.map((m) => m.key));
  for (const list of allMatches.values()) if (list.length === 1) units.push([list[0]!.key]);
  for (const list of allMatches.values()) if (list.length > 1) for (const m of list) units.push([m.key]);
  for (let k = 1; k <= Math.min(units.length, maxRemove); k++) for (const combo of combinations(units, k)) yield new Set(combo.flat());
}

/** Fragment a molecule into UNIFAC subgroups. */
export function fragmentUnifac(RDKit: RDKitModule, mol: Molecule): UnifacAssignment {
  const heavy = mol.atoms.filter((a) => a.element !== "H");
  if (heavy.length === 0) return FAIL("Empty molecule");
  const rd = RDKit.get_mol(writeMolfile(mol), JSON.stringify({ removeHs: false }));
  if (!rd || !rd.is_valid()) {
    rd?.delete();
    return FAIL("RDKit rejected the structure");
  }
  try {
    rd.remove_hs_in_place();
    const atomCount = rd.get_num_atoms();
    if (atomCount !== heavy.length) return FAIL("Atom count mismatch after hydrogen removal");
    const hPerAtom = heavy.map((a) => neighborsOf(mol, a.id).filter((n) => getAtom(mol, n)?.element === "H").length + implicitHydrogenCount(mol, a.id));
    const hTotal = hPerAtom.reduce((s, h) => s + h, 0);

    const allMatches = new Map<number, Match[]>();
    const coveredByAny = new Set<number>();
    for (const g of catalog) {
      const seen = new Map<string, Match>();
      for (const smarts of g.smarts) {
        const q = queryMol(RDKit, smarts);
        if (!q) continue;
        for (const atoms of parseMatches(rd.get_substruct_matches(q))) {
          const key = `${g.id}:${atoms.join(",")}`;
          if (!seen.has(key)) seen.set(key, { key, atoms });
        }
      }
      if (seen.size) {
        allMatches.set(g.id, [...seen.values()]);
        for (const m of seen.values()) for (const a of m.atoms) coveredByAny.add(a);
      }
    }
    if (coveredByAny.size !== atomCount) return FAIL("Did not match all atoms present");

    let { matched, counts, assignments } = runMatch(allMatches, new Set(), atomCount, hTotal);
    let success = matched.size === atomCount && hydrogensFound(assignments, hPerAtom) === hTotal;
    if (!success) {
      let tries = 0;
      for (const ignore of ignoreCombinations(allMatches)) {
        if (++tries > 5000) break;
        const r = runMatch(allMatches, ignore, atomCount, hTotal);
        if (r.matched.size !== atomCount) continue;
        if (hydrogensFound(r.assignments, hPerAtom) === hTotal) {
          ({ matched, counts, assignments } = r);
          success = true;
          break;
        }
      }
    }
    return success ? { groups: counts, matches: assignments, success: true, status: "OK" } : FAIL("Did not match all atoms present");
  } finally {
    rd.delete();
  }
}
