import json
from pathlib import Path

import pytest
from rdkit import Chem
from rdkit.Chem import AllChem

from chem_core import basic_properties, from_rdkit, molecule_from_dict, molecule_to_dict, to_rdkit, validate_molecule
from chem_core.schema import Atom, Bond, Molecule, SchemaError

SAMPLES_TS = Path(__file__).resolve().parents[2] / "molecule-model" / "src" / "samples" / "generated.ts"


def load_samples() -> list[dict]:
    text = SAMPLES_TS.read_text()
    start = text.index("= [")
    end = text.rindex("];")
    return json.loads(text[start + 2 : end + 1])


def embedded(smiles: str) -> Chem.Mol:
    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
    params = AllChem.ETKDGv3()
    params.randomSeed = 7
    assert AllChem.EmbedMolecule(mol, params) == 0
    return mol


def test_samples_file_exists_and_is_valid():
    samples = load_samples()
    assert len(samples) >= 5
    for raw in samples:
        mol = molecule_from_dict(raw)
        result = validate_molecule(mol)
        assert result["valid"], (raw["id"], result)


def test_schema_round_trip():
    mol = Molecule(
        id="t",
        name="test",
        atoms=[Atom("a", "C", 0.0, 0.0, 0.0, formal_charge=-1, isotope=13, implicit_hydrogens=3), Atom("b", "N", 1.5, 0.0, 0.0, formal_charge=1)],
        bonds=[Bond("ab", "a", "b", "single", stereo="either")],
        metadata={"k": 1},
    )
    d = molecule_to_dict(mol)
    assert d["schemaVersion"] == 1
    assert molecule_from_dict(d) == mol


@pytest.mark.parametrize(
    "raw, msg",
    [
        ({"schemaVersion": 2, "id": "x"}, "schemaVersion"),
        ({"schemaVersion": 1, "id": ""}, "id"),
        ({"schemaVersion": 1, "id": "x", "atoms": [{"id": "a", "element": "C"}]}, "position"),
        ({"schemaVersion": 1, "id": "x", "atoms": [{"id": "a", "element": "C", "position": {"x": "0", "y": 0, "z": 0}}]}, "position.x"),
        ({"schemaVersion": 1, "id": "x", "atoms": [], "bonds": [{"id": "b", "atomA": "a", "atomB": "b", "order": 2}]}, "order"),
    ],
)
def test_schema_rejects_malformed(raw, msg):
    with pytest.raises(SchemaError, match=msg):
        molecule_from_dict(raw)


def test_rdkit_round_trip_preserves_graph_and_coordinates():
    rd = embedded("CC(=O)Oc1ccccc1C(=O)O")  # aspirin
    mol = from_rdkit(rd, mol_id="asp", name="Aspirin")
    assert len(mol.atoms) == rd.GetNumAtoms()
    assert len(mol.bonds) == rd.GetNumBonds()
    back = to_rdkit(mol, sanitize=True)
    assert Chem.MolToSmiles(Chem.RemoveHs(back)) == Chem.MolToSmiles(Chem.RemoveHs(rd))
    # coordinates survive (rounded to 4 decimals in the schema)
    p0 = rd.GetConformer().GetAtomPosition(0)
    q0 = back.GetConformer().GetAtomPosition(0)
    assert abs(p0.x - q0.x) < 1e-3 and abs(p0.y - q0.y) < 1e-3 and abs(p0.z - q0.z) < 1e-3
    # ids are preserved as RDKit properties
    assert back.GetAtomWithIdx(0).GetProp("mcad_id") == mol.atoms[0].id


def test_aromatic_bonds_are_kept_when_not_kekulizing():
    mol = from_rdkit(embedded("c1ccccc1"), mol_id="bz", kekulize=False)
    assert sum(1 for b in mol.bonds if b.order == "aromatic") == 6
    assert validate_molecule(mol)["valid"]
    assert basic_properties(mol)["molecularFormula"] == "C6H6"


def test_validation_reports_valence_error_with_atom_id():
    mol = Molecule(
        id="bad",
        atoms=[Atom("c", "C", 0, 0, 0)] + [Atom(f"h{i}", "H", i, 0, 0) for i in range(5)],
        bonds=[Bond(f"b{i}", "c", f"h{i}") for i in range(5)],
    )
    result = validate_molecule(mol)
    assert not result["valid"]
    codes = {i["code"] for i in result["issues"]}
    assert "ATOMVALENCEEXCEPTION" in codes
    assert any(i["atomIds"] == ["c"] for i in result["issues"])


def test_validation_reports_unknown_element_and_dangling_bond():
    bad_element = Molecule(id="x", atoms=[Atom("a", "Xx", 0, 0, 0)])
    assert not validate_molecule(bad_element)["valid"]
    dangling = Molecule(id="y", atoms=[Atom("a", "C", 0, 0, 0)], bonds=[Bond("b", "a", "zzz")])
    result = validate_molecule(dangling)
    assert not result["valid"]
    assert result["issues"][0]["code"] == "GRAPH_ERROR"


def test_basic_properties_are_computed_from_rdkit():
    props = basic_properties(from_rdkit(embedded("Cn1cnc2c1c(=O)n(C)c(=O)n2C"), mol_id="caf"))
    assert props["kind"] == "computed"
    assert props["molecularFormula"] == "C8H10N4O2"
    assert abs(props["molecularWeight"] - 194.194) < 0.01
    assert props["heavyAtomCount"] == 14
    assert props["ringCount"] == 2
    assert props["formalCharge"] == 0
