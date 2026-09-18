# services/api

Planned FastAPI service (phase 4). It will be a thin HTTP layer over `packages/chem-core`:

- `POST /validate` — engine-side validation of an MCAD-JSON molecule
- `POST /properties` — computed descriptors (RDKit), tagged `kind: "computed"`
- `POST /convert` — SMILES / MOL / SDF import and export (phase 5)

No chemistry logic lives here; everything is delegated to `chem_core` so the same functions can be
unit-tested without HTTP and reused by a desktop sidecar.
