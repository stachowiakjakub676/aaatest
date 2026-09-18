"""COMPUTED molecular properties (deterministic, from RDKit). No predictions live here."""

from __future__ import annotations

from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors

from .rdkit_bridge import to_rdkit
from .schema import Molecule


def basic_properties(mol: Molecule) -> dict:
    """Formula, weights and counts. Raises if the molecule does not sanitise."""
    rd = to_rdkit(mol, sanitize=True)
    return {
        "kind": "computed",
        "source": "rdkit",
        "molecularFormula": rdMolDescriptors.CalcMolFormula(rd),
        "molecularWeight": round(Descriptors.MolWt(rd), 4),
        "exactMass": round(Descriptors.ExactMolWt(rd), 6),
        "heavyAtomCount": rd.GetNumHeavyAtoms(),
        "atomCount": rd.GetNumAtoms(),
        "bondCount": rd.GetNumBonds(),
        "formalCharge": Chem.GetFormalCharge(rd),
        "ringCount": rdMolDescriptors.CalcNumRings(rd),
        "canonicalSmiles": Chem.MolToSmiles(Chem.RemoveHs(rd)),
    }
