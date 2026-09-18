# Molecular CAD

A desktop-first, cross-platform application that treats molecular structures the way CAD software
treats mechanical parts: an interactive 3D viewport, a deterministic molecular graph as the single
source of truth, and computed properties from established cheminformatics libraries.

**Status: prototype, phases 0–2 complete** (analysis, domain model, 3D viewer). See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the architecture, dependency choices, risks and
the roadmap. Editing (phase 3), the chemistry API (phase 4) and import/export (phase 5) are next.

## Layout

```
apps/web                 React + Three.js client (runs in any modern browser incl. iPad Safari)
packages/molecule-model  TypeScript domain model: Atom, Bond, Molecule, Conformer, validation,
                         formula/weight, JSON serialization, built-in samples
packages/chem-core       Python chemistry core: schema mirror, RDKit bridge, engine-side
                         validation, computed properties, sample generator
services/api             FastAPI service exposing chem-core (phase 4, not yet implemented)
docs                     Architecture and decisions
```

## Quick start

Requirements: Node 22+, pnpm 10, Python 3.11+ with [uv](https://docs.astral.sh/uv/).

```bash
pnpm install
pnpm test          # TypeScript unit tests (domain model + viewer scene builder)
pnpm typecheck
pnpm dev           # web client at http://localhost:5173
pnpm build         # apps/web/dist/ (multi-file) and apps/web/dist/molecular-cad.html (single file)

cd packages/chem-core
uv venv && uv pip install -e ".[dev]"
.venv/bin/python -m pytest
.venv/bin/python scripts/generate_samples.py   # regenerates the built-in sample molecules
```

The single-file build `apps/web/dist/molecular-cad.html` needs no server: open it in Safari on an
iPad, in any desktop browser, or host it as a static page.

## Viewer controls

| Action            | Mouse / keyboard              | Touch (iPad)               |
| ----------------- | ----------------------------- | -------------------------- |
| Rotate            | left drag                     | one-finger drag            |
| Zoom              | wheel / middle drag           | pinch                      |
| Pan               | right drag                    | two-finger drag            |
| Select atom/bond  | click, Shift+click adds       | tap, "Add to selection"    |
| Fit / reset / labels / clear | F / R / L / Esc    | Toolbox buttons            |

Selecting two atoms shows their distance, three atoms the angle at the middle one.

## Principles

- The molecular graph (`packages/molecule-model`) is the source of truth; the renderer is derived from it.
- Chemistry is deterministic and comes from RDKit; nothing an LLM says is treated as chemical truth.
- Every value shown is labelled **computed** (follows from the structure) or, later, **predicted** (from a model).
- No operational synthesis instructions; the future reaction-planning module is a research abstraction only.
