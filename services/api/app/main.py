"""Molecular CAD chemistry API.

A thin HTTP layer over ``chem_core``. Every endpoint takes an MCAD-JSON molecule
(schemaVersion 1) and returns deterministic, COMPUTED results tagged as such. There is no
prediction model and no synthesis planning here.

Run locally:  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from chem_core import basic_properties, molecule_from_dict, molecule_from_smiles, molecule_to_dict, molecule_to_smiles, validate_molecule
from chem_core.geometry import optimize_geometry
from chem_core.schema import SchemaError

from .ai import DisabledProvider, ExplanationProvider, provider_from_env

app = FastAPI(title="Molecular CAD chemistry API", version="0.1.0")
_provider: ExplanationProvider | None = None


def get_explanation_provider() -> ExplanationProvider:
    global _provider
    if _provider is None:
        _provider = provider_from_env()
    return _provider
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # development default; restrict per deployment
    allow_methods=["*"],
    allow_headers=["*"],
)


class MoleculeRequest(BaseModel):
    molecule: dict[str, Any]


class OptimizeRequest(MoleculeRequest):
    max_iters: int = Field(default=2000, ge=1, le=100000)
    embed: bool = False


class SmilesRequest(BaseModel):
    smiles: str = Field(min_length=1, max_length=10000)
    name: str | None = None
    add_hydrogens: bool = True


def _parse(raw: dict[str, Any]):
    try:
        return molecule_from_dict(raw)
    except (SchemaError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid molecule: {exc}") from exc


@app.get("/health")
def health() -> dict:
    from rdkit import rdBase

    return {"status": "ok", "engine": "rdkit", "rdkitVersion": rdBase.rdkitVersion}


@app.post("/validate")
def validate(req: MoleculeRequest) -> dict:
    return validate_molecule(_parse(req.molecule))


@app.post("/properties")
def properties(req: MoleculeRequest) -> dict:
    mol = _parse(req.molecule)
    result = validate_molecule(mol)
    if not result["valid"]:
        raise HTTPException(status_code=409, detail={"message": "Structure does not sanitise; fix validation errors first.", "validation": result})
    return basic_properties(mol)


@app.post("/optimize")
def optimize(req: OptimizeRequest) -> dict:
    mol = _parse(req.molecule)
    result = validate_molecule(mol)
    if not result["valid"]:
        raise HTTPException(status_code=409, detail={"message": "Structure does not sanitise; fix validation errors first.", "validation": result})
    try:
        out = optimize_geometry(mol, max_iters=req.max_iters, embed=req.embed)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "kind": "computed",
        "source": "rdkit " + out["forceField"],
        "molecule": molecule_to_dict(out["molecule"]),
        "forceField": out["forceField"],
        "converged": out["converged"],
        "energy": out["energy"],
        "energyUnit": out["energyUnit"],
    }


@app.post("/from_smiles")
def from_smiles(req: SmilesRequest) -> dict:
    """SMILES -> molecule with a deterministic 3D conformer (ETKDG + MMFF94/UFF)."""
    try:
        mol = molecule_from_smiles(req.smiles, mol_id="imported", name=req.name, add_hydrogens=req.add_hydrogens)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"kind": "computed", "source": "rdkit ETKDGv3", "molecule": molecule_to_dict(mol)}


@app.post("/to_smiles")
def to_smiles(req: MoleculeRequest) -> dict:
    mol = _parse(req.molecule)
    result = validate_molecule(mol)
    if not result["valid"]:
        raise HTTPException(status_code=409, detail={"message": "Structure does not sanitise; fix validation errors first.", "validation": result})
    return {"kind": "computed", "source": "rdkit", "smiles": molecule_to_smiles(mol)}


class ExplainRequest(BaseModel):
    report: dict[str, Any]


@app.get("/ai/status")
def ai_status() -> dict:
    p = get_explanation_provider()
    return {"enabled": not isinstance(p, DisabledProvider), "provider": p.name}


@app.post("/ai/explain")
def ai_explain(req: ExplainRequest) -> dict:
    """Explain a deterministic AnalysisReport. Suggestions are proposals the client validates."""
    provider = get_explanation_provider()
    if isinstance(provider, DisabledProvider):
        raise HTTPException(status_code=503, detail="No AI provider configured on the server (set MCAD_AI_PROVIDER=anthropic).")
    if req.report.get("kind") != "computed":
        raise HTTPException(status_code=422, detail="report.kind must be 'computed' (only deterministic reports are explained).")
    try:
        out = provider.explain(req.report)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"kind": "explanation", "model": provider.name, "text": out.text, "suggestions": [s.model_dump() for s in out.suggestions]}
