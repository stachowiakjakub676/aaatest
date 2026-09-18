"""Deterministic chemistry core.

Everything in this package is a pure function of its input: no randomness without an
explicit seed, no network, no model predictions. The JSON schema mirrors
``packages/molecule-model/src/types.ts`` and is the contract between the TypeScript
client and the Python engine.
"""

from .schema import Atom, Bond, Molecule, molecule_from_dict, molecule_to_dict
from .rdkit_bridge import from_rdkit, to_rdkit
from .validation import ValidationIssue, validate_molecule
from .properties import basic_properties

__all__ = [
    "Atom",
    "Bond",
    "Molecule",
    "molecule_from_dict",
    "molecule_to_dict",
    "from_rdkit",
    "to_rdkit",
    "ValidationIssue",
    "validate_molecule",
    "basic_properties",
]
