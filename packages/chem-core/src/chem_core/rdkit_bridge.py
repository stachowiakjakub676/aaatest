"""Conversion between the MCAD schema and RDKit molecules.

The bridge is lossless for: elements, formal charges, isotopes, bond orders, 3D coordinates.
Atom/bond ids are preserved as RDKit atom/bond properties (``mcad_id``) so results computed
on the RDKit side can be mapped back to the client's graph.
"""

from __future__ import annotations

from rdkit import Chem
from rdkit.Geometry import Point3D

from .schema import Atom, Bond, Molecule

_TO_RD_ORDER = {
    "single": Chem.BondType.SINGLE,
    "double": Chem.BondType.DOUBLE,
    "triple": Chem.BondType.TRIPLE,
    "aromatic": Chem.BondType.AROMATIC,
}
_FROM_RD_ORDER = {v: k for k, v in _TO_RD_ORDER.items()}

ID_PROP = "mcad_id"


def to_rdkit(mol: Molecule, *, sanitize: bool = False) -> Chem.Mol:
    """Build an RDKit molecule. Sanitisation is opt-in so validation can inspect raw input."""
    rw = Chem.RWMol()
    index: dict[str, int] = {}
    for a in mol.atoms:
        rd_atom = Chem.Atom(a.element)  # raises RuntimeError for unknown symbols
        rd_atom.SetFormalCharge(a.formal_charge)
        if a.isotope is not None:
            rd_atom.SetIsotope(a.isotope)
        if a.implicit_hydrogens is not None:
            rd_atom.SetNumExplicitHs(a.implicit_hydrogens)
            rd_atom.SetNoImplicit(True)
        rd_atom.SetProp(ID_PROP, a.id)
        index[a.id] = rw.AddAtom(rd_atom)

    for b in mol.bonds:
        if b.atom_a not in index or b.atom_b not in index:
            raise ValueError(f"Bond {b.id} references unknown atom")
        bi = rw.AddBond(index[b.atom_a], index[b.atom_b], _TO_RD_ORDER[b.order]) - 1
        rd_bond = rw.GetBondWithIdx(bi)
        rd_bond.SetProp(ID_PROP, b.id)
        if b.order == "aromatic":
            rd_bond.SetIsAromatic(True)
            rw.GetAtomWithIdx(index[b.atom_a]).SetIsAromatic(True)
            rw.GetAtomWithIdx(index[b.atom_b]).SetIsAromatic(True)

    conf = Chem.Conformer(rw.GetNumAtoms())
    conf.Set3D(True)
    for a in mol.atoms:
        conf.SetAtomPosition(index[a.id], Point3D(a.x, a.y, a.z))
    rw.AddConformer(conf, assignId=True)

    out = rw.GetMol()
    if sanitize:
        Chem.SanitizeMol(out)
    return out


def from_rdkit(rd: Chem.Mol, *, mol_id: str, name: str | None = None, kekulize: bool = True) -> Molecule:
    """Convert an RDKit molecule (with a 3D conformer) into the MCAD schema.

    By default aromatic bonds are converted to a Kekulé structure so the client has explicit
    integer bond orders; pass ``kekulize=False`` to keep ``aromatic`` bonds.
    """
    work = Chem.Mol(rd)
    if kekulize:
        Chem.Kekulize(work, clearAromaticFlags=True)
    if work.GetNumConformers() == 0:
        raise ValueError("RDKit molecule has no conformer; generate 3D coordinates first")
    conf = work.GetConformer()

    atoms: list[Atom] = []
    for rd_atom in work.GetAtoms():
        idx = rd_atom.GetIdx()
        pos = conf.GetAtomPosition(idx)
        aid = rd_atom.GetProp(ID_PROP) if rd_atom.HasProp(ID_PROP) else f"a{idx + 1}"
        atoms.append(
            Atom(
                id=aid,
                element=rd_atom.GetSymbol(),
                x=round(pos.x, 4) + 0.0,
                y=round(pos.y, 4) + 0.0,
                z=round(pos.z, 4) + 0.0,
                formal_charge=rd_atom.GetFormalCharge(),
                isotope=rd_atom.GetIsotope() or None,
            )
        )
    id_of = {a.GetIdx(): atoms[a.GetIdx()].id for a in work.GetAtoms()}

    bonds: list[Bond] = []
    for rd_bond in work.GetBonds():
        bid = rd_bond.GetProp(ID_PROP) if rd_bond.HasProp(ID_PROP) else f"b{rd_bond.GetIdx() + 1}"
        order = _FROM_RD_ORDER.get(rd_bond.GetBondType())
        if order is None:
            raise ValueError(f"Unsupported RDKit bond type {rd_bond.GetBondType()} on bond {bid}")
        bonds.append(Bond(id=bid, atom_a=id_of[rd_bond.GetBeginAtomIdx()], atom_b=id_of[rd_bond.GetEndAtomIdx()], order=order))

    return Molecule(id=mol_id, atoms=atoms, bonds=bonds, name=name)
