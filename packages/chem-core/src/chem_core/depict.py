"""2D depiction (SVG) of a molecule: hydrogens removed, fresh 2D coordinates, RDKit drawer."""

from __future__ import annotations

from rdkit import Chem
from rdkit.Chem import AllChem
from rdkit.Chem.Draw import rdMolDraw2D

from .rdkit_bridge import to_rdkit
from .schema import Molecule


def depict_svg(mol: Molecule, width: int = 220, height: int = 150) -> str:
    rd = Chem.RemoveHs(to_rdkit(mol))
    AllChem.Compute2DCoords(rd)
    drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
    drawer.drawOptions().clearBackground = False
    drawer.DrawMolecule(rd)
    drawer.FinishDrawing()
    return drawer.GetDrawingText()
