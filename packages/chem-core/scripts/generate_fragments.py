"""Generate the fragment library used by the editor's "attach fragment" tool.

Each fragment is a complete, hydrogen-saturated molecule embedded in 3D (ETKDGv3, seed 42,
MMFF94). ``attachAtomId`` is the atom whose hydrogen is replaced by the bond to the anchor when
the fragment is attached. Re-run whenever the list changes:

    <venv>/bin/python scripts/generate_fragments.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import AllChem

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from chem_core.rdkit_bridge import from_rdkit  # noqa: E402
from chem_core.schema import molecule_to_dict  # noqa: E402

SEED = 42

# (id, name, category, SMILES written so that atom 0 is the attachment atom)
FRAGMENTS: list[tuple[str, str, str, str]] = [
    ("methyl", "Methyl", "alkyl", "C"),
    ("ethyl", "Ethyl", "alkyl", "CC"),
    ("isopropyl", "Isopropyl", "alkyl", "C(C)C"),
    ("tert-butyl", "tert-Butyl", "alkyl", "C(C)(C)C"),
    ("vinyl", "Vinyl", "alkyl", "C=C"),
    ("ethynyl", "Ethynyl", "alkyl", "C#C"),
    ("propyl", "Propyl", "alkyl", "CCC"),
    ("butyl", "Butyl", "alkyl", "CCCC"),
    ("isobutyl", "Isobutyl", "alkyl", "CC(C)C"),
    ("sec-butyl", "sec-Butyl", "alkyl", "C(C)CC"),
    ("neopentyl", "Neopentyl", "alkyl", "CC(C)(C)C"),
    ("pentyl", "Pentyl", "alkyl", "CCCCC"),
    ("hexyl", "Hexyl", "alkyl", "CCCCCC"),
    ("octyl", "Octyl", "alkyl", "CCCCCCCC"),
    ("dodecyl", "Dodecyl", "alkyl", "CCCCCCCCCCCC"),
    ("allyl", "Allyl", "alkyl", "CC=C"),
    ("propargyl", "Propargyl", "alkyl", "CC#C"),
    ("isopropenyl", "Isopropenyl", "alkyl", "C(=C)C"),
    ("cyclopropylmethyl", "Cyclopropylmethyl", "alkyl", "CC1CC1"),
    ("benzyl", "Benzyl", "alkyl", "Cc1ccccc1"),
    ("phenethyl", "Phenethyl", "alkyl", "CCc1ccccc1"),
    ("cyclopropyl", "Cyclopropyl", "ring", "C1CC1"),
    ("cyclobutyl", "Cyclobutyl", "ring", "C1CCC1"),
    ("cyclopentyl", "Cyclopentyl", "ring", "C1CCCC1"),
    ("cyclohexyl", "Cyclohexyl", "ring", "C1CCCCC1"),
    ("cycloheptyl", "Cycloheptyl", "ring", "C1CCCCCC1"),
    ("cyclohex-1-enyl", "Cyclohex-1-enyl", "ring", "C1=CCCCC1"),
    ("adamantan-1-yl", "Adamantan-1-yl", "ring", "C12CC3CC(CC(C3)C1)C2"),
    ("phenyl", "Phenyl", "ring", "c1ccccc1"),
    ("p-tolyl", "p-Tolyl", "ring", "c1ccc(C)cc1"),
    ("4-methoxyphenyl", "4-Methoxyphenyl", "ring", "c1ccc(OC)cc1"),
    ("4-fluorophenyl", "4-Fluorophenyl", "ring", "c1ccc(F)cc1"),
    ("4-chlorophenyl", "4-Chlorophenyl", "ring", "c1ccc(Cl)cc1"),
    ("4-hydroxyphenyl", "4-Hydroxyphenyl", "ring", "c1ccc(O)cc1"),
    ("4-nitrophenyl", "4-Nitrophenyl", "ring", "c1ccc([N+](=O)[O-])cc1"),
    ("biphenyl-4-yl", "Biphenyl-4-yl", "ring", "c1ccc(-c2ccccc2)cc1"),
    ("naphthalen-1-yl", "Naphthalen-1-yl", "ring", "c1cccc2ccccc12"),
    ("naphthalen-2-yl", "Naphthalen-2-yl", "ring", "c1ccc2ccccc2c1"),
    ("pyridin-2-yl", "Pyridin-2-yl", "hetero", "c1ccccn1"),
    ("pyridin-3-yl", "Pyridin-3-yl", "hetero", "c1cccnc1"),
    ("pyridin-4-yl", "Pyridin-4-yl", "hetero", "c1ccncc1"),
    ("pyrimidin-2-yl", "Pyrimidin-2-yl", "hetero", "c1ncccn1"),
    ("pyrimidin-5-yl", "Pyrimidin-5-yl", "hetero", "c1cncnc1"),
    ("pyrazin-2-yl", "Pyrazin-2-yl", "hetero", "c1cnccn1"),
    ("furan-2-yl", "Furan-2-yl", "hetero", "c1ccoc1"),
    ("thiophen-2-yl", "Thiophen-2-yl", "hetero", "c1cccs1"),
    ("thiophen-3-yl", "Thiophen-3-yl", "hetero", "c1ccsc1"),
    ("pyrrol-2-yl", "Pyrrol-2-yl", "hetero", "c1ccc[nH]1"),
    ("pyrrol-1-yl", "Pyrrol-1-yl", "hetero", "[nH]1cccc1"),
    ("imidazol-1-yl", "Imidazol-1-yl", "hetero", "[nH]1ccnc1"),
    ("imidazol-2-yl", "Imidazol-2-yl", "hetero", "c1ncc[nH]1"),
    ("pyrazol-1-yl", "Pyrazol-1-yl", "hetero", "[nH]1nccc1"),
    ("1,2,4-triazol-1-yl", "1,2,4-Triazol-1-yl", "hetero", "[nH]1cncn1"),
    ("tetrazol-5-yl", "Tetrazol-5-yl", "hetero", "c1nnn[nH]1"),
    ("thiazol-2-yl", "Thiazol-2-yl", "hetero", "c1nccs1"),
    ("oxazol-2-yl", "Oxazol-2-yl", "hetero", "c1ncco1"),
    ("isoxazol-3-yl", "Isoxazol-3-yl", "hetero", "c1ccon1"),
    ("indol-3-yl", "Indol-3-yl", "hetero", "c1c[nH]c2ccccc12"),
    ("indol-1-yl", "Indol-1-yl", "hetero", "[nH]1ccc2ccccc12"),
    ("benzimidazol-2-yl", "Benzimidazol-2-yl", "hetero", "c1nc2ccccc2[nH]1"),
    ("benzofuran-2-yl", "Benzofuran-2-yl", "hetero", "c1cc2ccccc2o1"),
    ("benzothiophen-2-yl", "Benzothiophen-2-yl", "hetero", "c1cc2ccccc2s1"),
    ("quinolin-2-yl", "Quinolin-2-yl", "hetero", "c1ccc2ccccc2n1"),
    ("quinolin-4-yl", "Quinolin-4-yl", "hetero", "c1ccnc2ccccc12"),
    ("azetidin-1-yl", "Azetidin-1-yl", "hetero", "N1CCC1"),
    ("pyrrolidin-1-yl", "Pyrrolidin-1-yl", "hetero", "N1CCCC1"),
    ("piperidin-1-yl", "Piperidin-1-yl", "hetero", "N1CCCCC1"),
    ("piperidin-4-yl", "Piperidin-4-yl", "hetero", "C1CCNCC1"),
    ("piperazin-1-yl", "Piperazin-1-yl", "hetero", "N1CCNCC1"),
    ("4-methylpiperazin-1-yl", "4-Methylpiperazin-1-yl", "hetero", "N1CCN(C)CC1"),
    ("morpholin-4-yl", "Morpholin-4-yl", "hetero", "N1CCOCC1"),
    ("oxetan-3-yl", "Oxetan-3-yl", "hetero", "C1COC1"),
    ("tetrahydrofuran-2-yl", "Tetrahydrofuran-2-yl", "hetero", "C1CCCO1"),
    ("tetrahydropyran-4-yl", "Tetrahydropyran-4-yl", "hetero", "C1CCOCC1"),
    ("hydroxy", "Hydroxy (OH)", "group", "O"),
    ("methoxy", "Methoxy (OMe)", "group", "OC"),
    ("amino", "Amino (NH2)", "group", "N"),
    ("dimethylamino", "Dimethylamino", "group", "N(C)C"),
    ("thiol", "Thiol (SH)", "group", "S"),
    ("formyl", "Formyl (CHO)", "group", "C=O"),
    ("acetyl", "Acetyl", "group", "C(=O)C"),
    ("carboxy", "Carboxy (COOH)", "group", "C(=O)O"),
    ("methoxycarbonyl", "Methyl ester", "group", "C(=O)OC"),
    ("carbamoyl", "Amide (CONH2)", "group", "C(=O)N"),
    ("acetamido", "Acetamido", "group", "NC(C)=O"),
    ("nitrile", "Nitrile (CN)", "group", "C#N"),
    ("nitro", "Nitro", "group", "[NH+](=O)[O-]"),
    ("sulfonamide", "Sulfonamide", "group", "S(=O)(=O)N"),
    ("methylsulfonyl", "Methylsulfonyl", "group", "S(=O)(=O)C"),
    ("trifluoromethyl", "Trifluoromethyl (CF3)", "group", "C(F)(F)F"),
    ("difluoromethyl", "Difluoromethyl (CHF2)", "group", "C(F)F"),
    ("trifluoromethoxy", "Trifluoromethoxy (OCF3)", "group", "OC(F)(F)F"),
    ("ethoxy", "Ethoxy (OEt)", "group", "OCC"),
    ("isopropoxy", "Isopropoxy", "group", "OC(C)C"),
    ("phenoxy", "Phenoxy (OPh)", "group", "Oc1ccccc1"),
    ("benzyloxy", "Benzyloxy (OBn)", "group", "OCc1ccccc1"),
    ("methoxymethyl", "Methoxymethyl", "group", "COC"),
    ("hydroxymethyl", "Hydroxymethyl (CH2OH)", "group", "CO"),
    ("hydroxyethyl", "2-Hydroxyethyl", "group", "CCO"),
    ("aminomethyl", "Aminomethyl (CH2NH2)", "group", "CN"),
    ("methylamino", "Methylamino (NHMe)", "group", "NC"),
    ("acetoxy", "Acetoxy (OAc)", "group", "OC(C)=O"),
    ("benzoyl", "Benzoyl", "group", "C(=O)c1ccccc1"),
    ("carboxymethyl", "Carboxymethyl (CH2COOH)", "group", "CC(=O)O"),
    ("ethoxycarbonyl", "Ethyl ester", "group", "C(=O)OCC"),
    ("tert-butoxycarbonyl-ester", "tert-Butyl ester", "group", "C(=O)OC(C)(C)C"),
    ("n-methylcarbamoyl", "N-Methylamide", "group", "C(=O)NC"),
    ("n,n-dimethylcarbamoyl", "N,N-Dimethylamide", "group", "C(=O)N(C)C"),
    ("ureido", "Urea (NHCONH2)", "group", "NC(N)=O"),
    ("guanidino", "Guanidine", "group", "NC(=N)N"),
    ("amidino", "Amidine", "group", "C(=N)N"),
    ("oxime", "Oxime (CH=NOH)", "group", "C=NO"),
    ("methylthio", "Methylthio (SMe)", "group", "SC"),
    ("sulfonic-acid", "Sulfonic acid (SO3H)", "group", "S(=O)(=O)O"),
    ("methanesulfonamido", "Methanesulfonamido", "group", "NS(C)(=O)=O"),
    ("azido", "Azide (N3)", "group", "N=[N+]=[N-]"),
    ("boronic-acid", "Boronic acid (B(OH)2)", "group", "B(O)O"),
    ("trimethylsilyl", "Trimethylsilyl (TMS)", "group", "[SiH](C)(C)C"),
    ("boc-amino", "Boc-amino (NHBoc)", "protect", "NC(=O)OC(C)(C)C"),
    ("cbz-amino", "Cbz-amino (NHCbz)", "protect", "NC(=O)OCc1ccccc1"),
    ("fmoc-amino", "Fmoc-amino", "protect", "NC(=O)OCC1c2ccccc2-c2ccccc21"),
    ("acetamido-protect", "Acetamido (NHAc)", "protect", "NC(C)=O"),
    ("tbs-oxy", "TBS ether (OTBS)", "protect", "O[Si](C)(C)C(C)(C)C"),
    ("thp-oxy", "THP ether (OTHP)", "protect", "OC1CCCCO1"),
    ("mom-oxy", "MOM ether (OMOM)", "protect", "OCOC"),
    ("pivaloyloxy", "Pivalate (OPiv)", "protect", "OC(=O)C(C)(C)C"),
    ("acetal-dimethyl", "Dimethyl acetal", "protect", "C(OC)OC"),
    ("fluoro", "Fluoro", "halogen", "F"),
    ("chloro", "Chloro", "halogen", "Cl"),
    ("bromo", "Bromo", "halogen", "Br"),
    ("iodo", "Iodo", "halogen", "I"),
]

OUT = Path(__file__).resolve().parents[2] / "molecule-model" / "src" / "samples" / "fragments.ts"


def build(frag_id: str, name: str, category: str, smiles: str) -> dict:
    base = Chem.MolFromSmiles(smiles)
    if base is None:
        raise RuntimeError(f"bad SMILES for {frag_id}")
    mol = Chem.AddHs(base)
    params = AllChem.ETKDGv3()
    params.randomSeed = SEED
    if AllChem.EmbedMolecule(mol, params) != 0:
        raise RuntimeError(f"embedding failed for {frag_id}")
    if AllChem.MMFFHasAllMoleculeParams(mol):
        AllChem.MMFFOptimizeMolecule(mol, maxIters=2000)
    else:
        AllChem.UFFOptimizeMolecule(mol, maxIters=2000)
    attach = mol.GetAtomWithIdx(0)
    if not any(n.GetAtomicNum() == 1 for n in attach.GetNeighbors()):
        raise RuntimeError(f"attachment atom of {frag_id} carries no hydrogen to replace")
    conf = mol.GetConformer()
    pos = conf.GetPositions()
    origin = pos[0]
    for i, p in enumerate(pos - origin):
        conf.SetAtomPosition(i, p.tolist())
    m = from_rdkit(mol, mol_id=f"frag-{frag_id}", name=name)
    m.metadata = {"source": "fragment library", "smiles": smiles}
    d = molecule_to_dict(m)
    for a in d["atoms"]:
        a["position"] = {k: round(v, 3) + 0.0 for k, v in a["position"].items()}
    return {"id": frag_id, "name": name, "category": category, "smiles": smiles, "attachAtomId": d["atoms"][0]["id"], "molecule": d}


def main() -> None:
    entries = [build(*f) for f in FRAGMENTS]
    text = "\n".join(
        [
            "// GENERATED FILE - do not edit by hand.",
            "// Source: packages/chem-core/scripts/generate_fragments.py (RDKit ETKDGv3, seed 42, MMFF94).",
            'import type { Molecule } from "../types";',
            "",
            "export interface FragmentTemplate {",
            "  id: string;",
            "  name: string;",
            '  category: "alkyl" | "ring" | "hetero" | "group" | "halogen" | "protect";',
            "  smiles: string;",
            "  /** Atom whose hydrogen is replaced by the bond to the anchor. */",
            "  attachAtomId: string;",
            "  molecule: Molecule;",
            "}",
            "",
            "export const FRAGMENTS: readonly FragmentTemplate[] = " + json.dumps(entries, separators=(",", ":")) + ";",
            "",
        ]
    )
    OUT.write_text(text)
    print(f"wrote {OUT} ({len(entries)} fragments)")


if __name__ == "__main__":
    main()
