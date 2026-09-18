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
    ("cyclopropyl", "Cyclopropyl", "ring", "C1CC1"),
    ("cyclopentyl", "Cyclopentyl", "ring", "C1CCCC1"),
    ("cyclohexyl", "Cyclohexyl", "ring", "C1CCCCC1"),
    ("phenyl", "Phenyl", "ring", "c1ccccc1"),
    ("pyridin-2-yl", "Pyridin-2-yl", "ring", "c1ccccn1"),
    ("pyridin-4-yl", "Pyridin-4-yl", "ring", "c1ccncc1"),
    ("furan-2-yl", "Furan-2-yl", "ring", "c1ccoc1"),
    ("thiophen-2-yl", "Thiophen-2-yl", "ring", "c1cccs1"),
    ("pyrrol-2-yl", "Pyrrol-2-yl", "ring", "c1ccc[nH]1"),
    ("imidazol-1-yl", "Imidazol-1-yl", "ring", "[nH]1ccnc1"),
    ("piperidin-1-yl", "Piperidin-1-yl", "ring", "N1CCCCC1"),
    ("morpholin-4-yl", "Morpholin-4-yl", "ring", "N1CCOCC1"),
    ("naphthalen-2-yl", "Naphthalen-2-yl", "ring", "c1ccc2ccccc2c1"),
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
            '  category: "alkyl" | "ring" | "group" | "halogen";',
            "  smiles: string;",
            "  /** Atom whose hydrogen is replaced by the bond to the anchor. */",
            "  attachAtomId: string;",
            "  molecule: Molecule;",
            "}",
            "",
            "export const FRAGMENTS: readonly FragmentTemplate[] = " + json.dumps(entries, indent=2) + ";",
            "",
        ]
    )
    OUT.write_text(text)
    print(f"wrote {OUT} ({len(entries)} fragments)")


if __name__ == "__main__":
    main()
