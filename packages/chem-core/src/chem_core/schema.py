"""Python mirror of the MCAD-JSON molecule schema (schemaVersion 1)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

BondOrder = Literal["single", "double", "triple", "aromatic"]
BOND_ORDERS: tuple[str, ...] = ("single", "double", "triple", "aromatic")


@dataclass(frozen=True)
class Atom:
    id: str
    element: str
    x: float
    y: float
    z: float
    formal_charge: int = 0
    isotope: int | None = None
    chirality: str | None = None
    implicit_hydrogens: int | None = None


@dataclass(frozen=True)
class Bond:
    id: str
    atom_a: str
    atom_b: str
    order: str = "single"
    stereo: str | None = None


@dataclass
class Molecule:
    id: str
    atoms: list[Atom] = field(default_factory=list)
    bonds: list[Bond] = field(default_factory=list)
    name: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class SchemaError(ValueError):
    pass


def _num(v: Any, path: str) -> float:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise SchemaError(f"{path}: expected number")
    return float(v)


def molecule_from_dict(raw: dict[str, Any]) -> Molecule:
    if not isinstance(raw, dict):
        raise SchemaError("$: expected object")
    if raw.get("schemaVersion") != 1:
        raise SchemaError("$.schemaVersion: expected 1")
    mol_id = raw.get("id")
    if not isinstance(mol_id, str) or not mol_id:
        raise SchemaError("$.id: expected non-empty string")

    atoms: list[Atom] = []
    for i, a in enumerate(raw.get("atoms", [])):
        p = f"$.atoms[{i}]"
        if not isinstance(a, dict):
            raise SchemaError(f"{p}: expected object")
        pos = a.get("position")
        if not isinstance(pos, dict):
            raise SchemaError(f"{p}.position: expected object")
        charge = a.get("formalCharge", 0)
        if isinstance(charge, bool) or not isinstance(charge, int):
            raise SchemaError(f"{p}.formalCharge: expected integer")
        atoms.append(
            Atom(
                id=str(a["id"]),
                element=str(a["element"]),
                x=_num(pos.get("x"), f"{p}.position.x"),
                y=_num(pos.get("y"), f"{p}.position.y"),
                z=_num(pos.get("z"), f"{p}.position.z"),
                formal_charge=charge,
                isotope=a.get("isotope"),
                chirality=a.get("chirality"),
                implicit_hydrogens=a.get("implicitHydrogens"),
            )
        )

    bonds: list[Bond] = []
    for i, b in enumerate(raw.get("bonds", [])):
        p = f"$.bonds[{i}]"
        if not isinstance(b, dict):
            raise SchemaError(f"{p}: expected object")
        order = b.get("order", "single")
        if order not in BOND_ORDERS:
            raise SchemaError(f"{p}.order: expected one of {BOND_ORDERS}")
        bonds.append(Bond(id=str(b["id"]), atom_a=str(b["atomA"]), atom_b=str(b["atomB"]), order=order, stereo=b.get("stereo")))

    return Molecule(id=mol_id, atoms=atoms, bonds=bonds, name=raw.get("name"), metadata=dict(raw.get("metadata", {})))


def molecule_to_dict(mol: Molecule) -> dict[str, Any]:
    atoms = []
    for a in mol.atoms:
        d: dict[str, Any] = {
            "id": a.id,
            "element": a.element,
            "formalCharge": a.formal_charge,
            "position": {"x": a.x, "y": a.y, "z": a.z},
        }
        if a.isotope is not None:
            d["isotope"] = a.isotope
        if a.chirality is not None:
            d["chirality"] = a.chirality
        if a.implicit_hydrogens is not None:
            d["implicitHydrogens"] = a.implicit_hydrogens
        atoms.append(d)
    bonds = []
    for b in mol.bonds:
        d = {"id": b.id, "atomA": b.atom_a, "atomB": b.atom_b, "order": b.order}
        if b.stereo is not None:
            d["stereo"] = b.stereo
        bonds.append(d)
    out: dict[str, Any] = {"schemaVersion": 1, "id": mol.id, "atoms": atoms, "bonds": bonds, "metadata": dict(mol.metadata)}
    if mol.name is not None:
        out["name"] = mol.name
    return out
