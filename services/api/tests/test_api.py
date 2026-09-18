import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
SAMPLES_TS = Path(__file__).resolve().parents[3] / "packages" / "molecule-model" / "src" / "samples" / "generated.ts"


def sample(sample_id: str) -> dict:
    text = SAMPLES_TS.read_text()
    data = json.loads(text[text.index("= [") + 2 : text.rindex("];") + 1])
    return next(m for m in data if m["id"] == sample_id)


def sketched_ethanol() -> dict:
    """Heavy atoms only, deliberately poor geometry (all collinear)."""
    return {
        "schemaVersion": 1,
        "id": "etoh",
        "atoms": [
            {"id": "c1", "element": "C", "formalCharge": 0, "position": {"x": 0, "y": 0, "z": 0}},
            {"id": "c2", "element": "C", "formalCharge": 0, "position": {"x": 1.5, "y": 0, "z": 0}},
            {"id": "o", "element": "O", "formalCharge": 0, "position": {"x": 3.0, "y": 0, "z": 0}},
        ],
        "bonds": [
            {"id": "b1", "atomA": "c1", "atomB": "c2", "order": "single"},
            {"id": "b2", "atomA": "c2", "atomB": "o", "order": "single"},
        ],
        "metadata": {},
    }


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["engine"] == "rdkit"


def test_validate_reports_engine_issues():
    bad = sketched_ethanol()
    bad["bonds"][0]["order"] = "triple"
    bad["bonds"][1]["order"] = "triple"  # C2 valence 6
    r = client.post("/validate", json={"molecule": bad})
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is False
    assert any(i["atomIds"] == ["c2"] for i in body["issues"])


def test_properties_are_computed_and_tagged():
    r = client.post("/properties", json={"molecule": sample("caffeine")})
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "computed"
    assert body["molecularFormula"] == "C8H10N4O2"
    assert body["descriptors"]["hBondAcceptors"]["value"] == 6
    assert body["descriptors"]["aromaticRingCount"]["value"] == 2
    assert body["canonicalSmiles"] == "Cn1c(=O)c2c(ncn2C)n(C)c1=O"


def test_properties_refuses_unsanitisable_structures():
    bad = sketched_ethanol()
    bad["bonds"][0]["order"] = "triple"
    bad["bonds"][1]["order"] = "triple"
    r = client.post("/properties", json={"molecule": bad})
    assert r.status_code == 409
    assert r.json()["detail"]["validation"]["valid"] is False


def test_invalid_schema_is_422():
    r = client.post("/validate", json={"molecule": {"schemaVersion": 2}})
    assert r.status_code == 422


def test_optimize_bends_a_collinear_sketch():
    r = client.post("/optimize", json={"molecule": sketched_ethanol()})
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "computed"
    assert body["forceField"] in ("MMFF94", "UFF")
    atoms = {a["id"]: a["position"] for a in body["molecule"]["atoms"]}
    assert set(atoms) == {"c1", "c2", "o"}
    import math

    def vec(a, b):
        return [atoms[b][k] - atoms[a][k] for k in "xyz"]

    u, v = vec("c2", "c1"), vec("c2", "o")
    cos = sum(x * y for x, y in zip(u, v)) / (math.dist(u, [0, 0, 0]) * math.dist(v, [0, 0, 0]))
    angle = math.degrees(math.acos(max(-1, min(1, cos))))
    assert 100 < angle < 120  # no longer collinear; near tetrahedral
    assert 1.4 < math.dist([atoms["c1"][k] for k in "xyz"], [atoms["c2"][k] for k in "xyz"]) < 1.6


def test_optimize_keeps_atom_order_and_bonds_for_samples():
    src = sample("aspirin")
    r = client.post("/optimize", json={"molecule": src, "max_iters": 200})
    assert r.status_code == 200
    out = r.json()["molecule"]
    assert [a["id"] for a in out["atoms"]] == [a["id"] for a in src["atoms"]]
    assert out["bonds"] == src["bonds"]


def test_optimize_empty_is_422():
    r = client.post("/optimize", json={"molecule": {"schemaVersion": 1, "id": "e", "atoms": [], "bonds": []}})
    assert r.status_code == 422


def test_smiles_round_trip_with_stereo():
    smiles = "C[C@H](N)C(=O)O"  # L-alanine
    r = client.post("/from_smiles", json={"smiles": smiles})
    assert r.status_code == 200
    mol = r.json()["molecule"]
    assert len(mol["atoms"]) == 13  # with explicit hydrogens
    assert all(abs(a["position"]["z"]) < 10 for a in mol["atoms"])
    zs = [a["position"]["z"] for a in mol["atoms"]]
    assert max(zs) - min(zs) > 0.5  # genuinely 3D
    back = client.post("/to_smiles", json={"molecule": mol})
    assert back.status_code == 200
    assert back.json()["smiles"] == "C[C@H](N)C(=O)O"
    heavy = client.post("/from_smiles", json={"smiles": "c1ccccc1", "add_hydrogens": False}).json()["molecule"]
    assert len(heavy["atoms"]) == 6
    assert all(b["order"] in ("single", "double") for b in heavy["bonds"])  # kekulised


def test_from_smiles_rejects_garbage():
    r = client.post("/from_smiles", json={"smiles": "C(C"})
    assert r.status_code == 422
