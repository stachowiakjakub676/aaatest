# services/api

FastAPI service over `packages/chem-core`. No chemistry logic lives here; everything is delegated
to `chem_core` so the same functions can be unit-tested without HTTP and reused by a desktop sidecar.

```bash
uv venv && uv pip install -e ".[dev]"
.venv/bin/python -m pytest
.venv/bin/uvicorn app.main:app --reload --port 8000
```

| Endpoint            | Body                                   | Result                                              |
| ------------------- | -------------------------------------- | --------------------------------------------------- |
| `GET /health`       |                                        | engine name and RDKit version                       |
| `POST /validate`    | `{ molecule }`                         | `{ valid, issues[] }` with the client's atom ids    |
| `POST /properties`  | `{ molecule }`                         | computed formula, weights, SMILES, InChI, descriptors (409 if the structure does not sanitise) |
| `POST /optimize`    | `{ molecule, max_iters?, embed? }`     | molecule with optimised coordinates, force field, energy, converged flag |
| `POST /from_smiles` | `{ smiles, name?, add_hydrogens? }`    | molecule with an ETKDG 3D conformer (stereo honoured)  |
| `POST /to_smiles`   | `{ molecule }`                         | canonical SMILES                                        |
| `GET /ai/status`    |                                        | whether an explanation provider is configured           |
| `POST /ai/explain`  | `{ report }` (AnalysisReport)          | prose + structured suggestions from a language model; 503 unless `MCAD_AI_PROVIDER=anthropic` (install with `uv pip install -e ".[ai]"`, credentials via the Anthropic SDK's environment resolution) |

`molecule` is MCAD-JSON (schemaVersion 1) as defined in `packages/molecule-model/src/types.ts`.
CORS is wide open for development; restrict `allow_origins` per deployment.
