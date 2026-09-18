"""Stereochemistry perceived from 3D coordinates (COMPUTED)."""

from __future__ import annotations

from rdkit import Chem

from .rdkit_bridge import ID_PROP, to_rdkit
from .schema import Molecule


def stereo_info(mol: Molecule) -> dict:
    """CIP labels for stereocentres and double bonds, derived from the 3D coordinates."""
    rd = to_rdkit(mol, sanitize=True)
    Chem.AssignStereochemistryFrom3D(rd)
    atoms = []
    for idx, label in Chem.FindMolChiralCenters(rd, includeUnassigned=True, useLegacyImplementation=False):
        atoms.append({"atomId": rd.GetAtomWithIdx(idx).GetProp(ID_PROP), "label": label if label in ("R", "S", "r", "s") else "?"})
    bonds = []
    for b in rd.GetBonds():
        st = b.GetStereo()
        if st in (Chem.BondStereo.STEREOE, Chem.BondStereo.STEREOZ, Chem.BondStereo.STEREOTRANS, Chem.BondStereo.STEREOCIS):
            label = "E" if st in (Chem.BondStereo.STEREOE, Chem.BondStereo.STEREOTRANS) else "Z"
            bonds.append({"bondId": b.GetProp(ID_PROP), "label": label})
    return {"kind": "computed", "source": "rdkit AssignStereochemistryFrom3D", "atoms": atoms, "bonds": bonds}
