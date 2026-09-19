"""Geometry optimisation (COMPUTED, deterministic given the same input and seed).

Force fields: MMFF94 when parameters exist for the molecule, otherwise UFF. Hydrogens are
added temporarily so the force field sees a complete molecule; only the coordinates of the
atoms the caller supplied are returned, in the caller's atom order.
"""

from __future__ import annotations

from dataclasses import replace

from rdkit import Chem
from rdkit.Chem import AllChem

from .rdkit_bridge import to_rdkit
from .schema import Molecule

SEED = 42


def optimize_geometry(mol: Molecule, *, max_iters: int = 2000, embed: bool = False) -> dict:
    """Return ``{"molecule": Molecule, "forceField": str, "converged": bool, "energy": float}``.

    ``embed=True`` discards the input coordinates and generates a fresh ETKDG conformer first
    (useful when atoms were sketched on top of each other).
    """
    if not mol.atoms:
        raise ValueError("Cannot optimise an empty molecule.")
    rd = to_rdkit(mol, sanitize=True)
    n_input = rd.GetNumAtoms()
    rdh = Chem.AddHs(rd, addCoords=True)

    if embed:
        params = AllChem.ETKDGv3()
        params.randomSeed = SEED
        if AllChem.EmbedMolecule(rdh, params) != 0:
            raise ValueError("3D embedding failed for this structure.")

    if AllChem.MMFFHasAllMoleculeParams(rdh):
        props = AllChem.MMFFGetMoleculeProperties(rdh)
        ff = AllChem.MMFFGetMoleculeForceField(rdh, props)
        name = "MMFF94"
    else:
        ff = AllChem.UFFGetMoleculeForceField(rdh)
        name = "UFF"
    if ff is None:
        raise ValueError("No force field parameters available for this structure.")
    ff.Initialize()
    not_converged = ff.Minimize(maxIts=max_iters)
    energy = float(ff.CalcEnergy())

    conf = rdh.GetConformer()
    atoms = []
    for i, a in enumerate(mol.atoms):
        p = conf.GetAtomPosition(i)
        atoms.append(replace(a, x=round(p.x, 4) + 0.0, y=round(p.y, 4) + 0.0, z=round(p.z, 4) + 0.0))
    assert len(atoms) == n_input
    out = Molecule(id=mol.id, atoms=atoms, bonds=list(mol.bonds), name=mol.name, metadata=dict(mol.metadata))
    return {"molecule": out, "forceField": name, "converged": not_converged == 0, "energy": round(energy, 4), "energyUnit": "kcal/mol"}
