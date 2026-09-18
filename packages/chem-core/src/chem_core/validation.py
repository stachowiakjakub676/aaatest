"""Engine-side validation using RDKit's chemistry perception.

This complements (does not duplicate) the client-side graph checks in molecule-model:
RDKit decides valence, aromaticity and kekulisation problems.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from rdkit import Chem

from .rdkit_bridge import ID_PROP, to_rdkit
from .schema import Molecule


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    severity: str  # "error" | "warning"
    message: str
    atom_ids: tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict:
        return {"code": self.code, "severity": self.severity, "message": self.message, "atomIds": list(self.atom_ids)}


def validate_molecule(mol: Molecule) -> dict:
    """Return ``{"valid": bool, "issues": [...]}``. Never raises for chemically bad input."""
    issues: list[ValidationIssue] = []

    # Graph-level problems that would make RDKit construction itself fail.
    seen_atoms: set[str] = set()
    for a in mol.atoms:
        if a.id in seen_atoms:
            issues.append(ValidationIssue("DUPLICATE_ATOM_ID", "error", f'Duplicate atom id "{a.id}".', (a.id,)))
        seen_atoms.add(a.id)
    try:
        rd = to_rdkit(mol, sanitize=False)
    except (RuntimeError, ValueError) as exc:  # unknown element, dangling bond
        issues.append(ValidationIssue("GRAPH_ERROR", "error", str(exc)))
        return {"valid": False, "issues": [i.to_dict() for i in issues]}

    if mol.atoms == []:
        issues.append(ValidationIssue("EMPTY_MOLECULE", "warning", "Molecule has no atoms."))

    problems = Chem.DetectChemistryProblems(rd)
    for p in problems:
        atom_ids: tuple[str, ...] = ()
        if hasattr(p, "GetAtomIdx"):
            idx = p.GetAtomIdx()
            atom_ids = (rd.GetAtomWithIdx(idx).GetProp(ID_PROP),)
        elif hasattr(p, "GetAtomIndices"):
            atom_ids = tuple(rd.GetAtomWithIdx(i).GetProp(ID_PROP) for i in p.GetAtomIndices())
        issues.append(ValidationIssue(p.GetType().upper(), "error", p.Message(), atom_ids))

    return {"valid": not any(i.severity == "error" for i in issues), "issues": [i.to_dict() for i in issues]}
