"""SMILES / MOL conversion with 3D coordinate generation (deterministic seed)."""

from __future__ import annotations

from rdkit import Chem
from rdkit.Chem import AllChem

from .rdkit_bridge import from_rdkit, to_rdkit
from .schema import Molecule

SEED = 42


def molecule_from_smiles(smiles: str, *, mol_id: str = "imported", name: str | None = None, add_hydrogens: bool = True) -> Molecule:
    """Parse SMILES, embed a 3D conformer (ETKDGv3, seed 42) and relax it with MMFF94/UFF.

    Stereochemistry encoded in the SMILES is honoured by the embedding.
    Raises ValueError for unparsable SMILES or failed embedding.
    """
    rd = Chem.MolFromSmiles(smiles)
    if rd is None:
        raise ValueError("RDKit could not parse this SMILES.")
    work = Chem.AddHs(rd)
    params = AllChem.ETKDGv3()
    params.randomSeed = SEED
    if AllChem.EmbedMolecule(work, params) != 0:
        raise ValueError("3D embedding failed for this structure.")
    if AllChem.MMFFHasAllMoleculeParams(work):
        AllChem.MMFFOptimizeMolecule(work, maxIters=2000)
    else:
        AllChem.UFFOptimizeMolecule(work, maxIters=2000)
    if not add_hydrogens:
        work = Chem.RemoveHs(work)
    conf = work.GetConformer()
    centre = conf.GetPositions().mean(axis=0)
    for i, p in enumerate(conf.GetPositions() - centre):
        conf.SetAtomPosition(i, p.tolist())
    mol = from_rdkit(work, mol_id=mol_id, name=name)
    mol.metadata = {"source": "smiles", "smiles": smiles}
    return mol


def molecule_to_smiles(mol: Molecule, *, canonical: bool = True) -> str:
    rd = to_rdkit(mol, sanitize=True)
    Chem.AssignStereochemistryFrom3D(rd)
    return Chem.MolToSmiles(Chem.RemoveHs(rd), canonical=canonical)
