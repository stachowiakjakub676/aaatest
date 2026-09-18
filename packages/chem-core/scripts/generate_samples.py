"""Generate the built-in sample molecules for the client.

Deterministic: ETKDGv3 embedding with a fixed random seed followed by MMFF94 optimisation.
Output is a TypeScript module consumed by packages/molecule-model. Re-run whenever the list
below changes:

    uv run --with rdkit python scripts/generate_samples.py
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

# (id, display name, SMILES). Everyday, non-hazardous molecules only.
SAMPLES: list[tuple[str, str, str]] = [
    ("water", "Water", "O"),
    ("methane", "Methane", "C"),
    ("ethylene", "Ethylene", "C=C"),
    ("acetylene", "Acetylene", "C#C"),
    ("ethanol", "Ethanol", "CCO"),
    ("acetic-acid", "Acetic acid", "CC(=O)O"),
    ("benzene", "Benzene", "c1ccccc1"),
    ("aspirin", "Aspirin", "CC(=O)Oc1ccccc1C(=O)O"),
    ("caffeine", "Caffeine", "Cn1cnc2c1c(=O)n(C)c(=O)n2C"),
    ("glucose", "beta-D-Glucose", "OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@@H]1O"),
]

OUT = Path(__file__).resolve().parents[2] / "molecule-model" / "src" / "samples" / "generated.ts"


def build(sample_id: str, name: str, smiles: str) -> dict:
    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
    params = AllChem.ETKDGv3()
    params.randomSeed = SEED
    if AllChem.EmbedMolecule(mol, params) != 0:
        raise RuntimeError(f"Embedding failed for {sample_id}")
    AllChem.MMFFOptimizeMolecule(mol, maxIters=2000)
    # Centre on the origin so the viewer's default camera is sensible.
    conf = mol.GetConformer()
    pos = conf.GetPositions()
    centre = pos.mean(axis=0)
    for i, p in enumerate(pos - centre):
        conf.SetAtomPosition(i, p.tolist())
    m = from_rdkit(mol, mol_id=sample_id, name=name)
    m.metadata = {"source": "rdkit ETKDGv3 seed 42 + MMFF94", "smiles": smiles}
    return molecule_to_dict(m)


def main() -> None:
    entries = [build(*s) for s in SAMPLES]
    lines = [
        "// GENERATED FILE - do not edit by hand.",
        "// Source: packages/chem-core/scripts/generate_samples.py (RDKit ETKDGv3, seed 42, MMFF94).",
        'import type { Molecule } from "../types";',
        "",
        "export const GENERATED_SAMPLES: readonly Molecule[] = " + json.dumps(entries, indent=2) + ";",
        "",
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines))
    print(f"wrote {OUT} ({len(entries)} molecules)")


if __name__ == "__main__":
    main()
