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

from chem_core import basic_properties, molecule_from_dict, molecule_to_dict, validate_molecule
from chem_core.geometry import optimize_geometry
from chem_core.schema import SchemaError

app = FastAPI(title="Molecular CAD chemistry API", version="0.1.0")
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
