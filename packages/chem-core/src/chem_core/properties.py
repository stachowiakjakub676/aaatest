"""COMPUTED molecular properties (deterministic, from RDKit). No predictions live here."""

from __future__ import annotations

from rdkit import Chem
from rdkit.Chem import Crippen, Descriptors, Lipinski, rdMolDescriptors

from .rdkit_bridge import to_rdkit
from .schema import Molecule

# (key, label, unit, function). Every entry is a deterministic function of the graph.
DESCRIPTORS = [
    ("exactMass", "Exact mass", "Da", Descriptors.ExactMolWt),
    ("heavyAtomCount", "Heavy atoms", "", lambda m: m.GetNumHeavyAtoms()),
    ("ringCount", "Rings", "", rdMolDescriptors.CalcNumRings),
    ("aromaticRingCount", "Aromatic rings", "", rdMolDescriptors.CalcNumAromaticRings),
    ("rotatableBonds", "Rotatable bonds", "", lambda m: Lipinski.NumRotatableBonds(m)),
    ("hBondDonors", "H-bond donors (Lipinski NH+OH)", "", rdMolDescriptors.CalcNumLipinskiHBD),
    ("hBondAcceptors", "H-bond acceptors (Lipinski N+O)", "", rdMolDescriptors.CalcNumLipinskiHBA),
    ("tpsa", "Topological polar surface area", "Å²", rdMolDescriptors.CalcTPSA),
    ("cLogP", "Crippen cLogP", "", Crippen.MolLogP),
    ("fractionCsp3", "Fraction Csp3", "", rdMolDescriptors.CalcFractionCSP3),
]


def basic_properties(mol: Molecule) -> dict:
    """Formula, weights, counts and standard descriptors. Raises if the molecule does not sanitise."""
    rd = to_rdkit(mol, sanitize=True)
    descriptors = {}
    for key, label, unit, fn in DESCRIPTORS:
        value = fn(rd)
        descriptors[key] = {"label": label, "unit": unit, "value": round(float(value), 4)}
    try:
        inchi = Chem.MolToInchi(rd)
        inchikey = Chem.InchiToInchiKey(inchi) if inchi else ""
    except Exception:  # InChI support is optional in some RDKit builds
        inchi, inchikey = "", ""
    return {
        "kind": "computed",
        "source": f"rdkit {Chem.rdBase.rdkitVersion}",
        "molecularFormula": rdMolDescriptors.CalcMolFormula(rd),
        "molecularWeight": round(Descriptors.MolWt(rd), 4),
        "exactMass": round(Descriptors.ExactMolWt(rd), 6),
        "heavyAtomCount": rd.GetNumHeavyAtoms(),
        "atomCount": rd.GetNumAtoms(),
        "bondCount": rd.GetNumBonds(),
        "formalCharge": Chem.GetFormalCharge(rd),
        "ringCount": rdMolDescriptors.CalcNumRings(rd),
        "canonicalSmiles": Chem.MolToSmiles(Chem.RemoveHs(rd)),
        "inchi": inchi,
        "inchiKey": inchikey,
        "descriptors": descriptors,
    }
