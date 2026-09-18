# Molecular CAD

A desktop-first, cross-platform application that treats molecular structures the way CAD software
treats mechanical parts: an interactive 3D viewport, a deterministic molecular graph as the single
source of truth, and computed properties from established cheminformatics libraries.

**Status: prototype, phases 0–6 complete** (analysis, domain model, 3D viewer, editor, chemistry
engine, import/export, UX). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the
architecture, dependency choices, risks and the roadmap. The AI-assistant interfaces (phase 7) and
the retrosynthesis abstraction (phase 8) are next.

The editor is open-ended: start from an empty canvas, place any of the 118 elements, grow
structures atom by atom without limit, bond, re-order, move, delete, undo and redo. The built-in
sample molecules are optional starting points, not a catalogue.

## Layout

```
apps/web                 React + Three.js client (runs in any modern browser incl. iPad Safari)
packages/molecule-model  TypeScript domain model: Atom, Bond, Molecule, Conformer, validation,
                         formula/weight, JSON serialization, built-in samples
packages/chem-core       Python chemistry core: schema mirror, RDKit bridge, engine-side
                         validation, computed properties, geometry optimisation, sample generator
services/api             FastAPI service exposing chem-core (validate, properties, optimize)
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

cd services/api
uv venv && uv pip install -e ".[dev]"
.venv/bin/python -m pytest
.venv/bin/uvicorn app.main:app --port 8000     # chemistry API for the "RDKit server" engine
```

## Chemistry engines

The client talks to chemistry through one `ChemistryEngine` interface with two implementations:

| Engine                          | Runs where            | Validate | Properties | Geometry optimisation |
| ------------------------------- | --------------------- | -------- | ---------- | --------------------- |
| RDKit in browser (WebAssembly)  | inside the page, offline (iPad OK) | yes | yes | no (no force fields in the WASM build) |
| RDKit server (FastAPI)          | `services/api`        | yes      | yes        | MMFF94 / UFF, optional ETKDG re-embedding |

Everything an engine returns is labelled **computed**. The Predictions section is a placeholder
for phase 7 and states that no models are configured.

The single-file build `apps/web/dist/molecular-cad.html` needs no server: open it in Safari on an
iPad, in any desktop browser, or host it as a static page.

## Controls

| Action                    | Mouse / keyboard                     | Touch (iPad)               |
| ------------------------- | ------------------------------------ | -------------------------- |
| Rotate / zoom / pan       | left drag / wheel / right drag       | one finger / pinch / two fingers |
| Tool                      | S select · A add atom · B bond · M move · X delete | Toolbox buttons |
| Add atom (tool A)         | click empty space = free atom; click an atom = attach to it | tap |
| Bond (tool B)             | click two atoms; click a bond to set its order | tap |
| Move (tool M)             | drag an atom in the screen plane     | drag                       |
| Delete (tool X)           | click atom or bond; Delete key removes the selection | tap |
| Undo / redo               | Ctrl+Z / Ctrl+Shift+Z (⌘ on Mac)     | Toolbox buttons            |
| Select                    | click, Shift+click adds              | tap, "Add to selection"    |
| Fit / reset / labels / clear | F / R / L / Esc                   | Toolbox buttons            |

Selecting two atoms shows their distance, three atoms the angle at the middle one. The inspector
edits the selected atom's element and formal charge and the selected bond's order.

**Geometry while drawing.** After every bonding change the sketch clean-up (a small deterministic
force field: ideal bond lengths, VSEPR angles, planar sp2 centres, staggered/planar torsions, soft
repulsion) relaxes the structure inside the same undo step, so chains zig-zag, rings close cleanly
and aromatic rings go flat as you build. It is a drawing aid with arbitrary energy units, not a
validated force field; turn it off in the toolbox or run it explicitly with **Tidy** (T). MMFF94
optimisation is available through the server engine.

**Import / export** (Ctrl+O / Ctrl+S): MCAD JSON (lossless), MOL V2000, SDF (multi-record with data
items) and SMILES. Every import is parsed, validated and shown with its issues before it reaches
the editor; imports with errors are blocked. SMILES import through the in-browser engine yields a
3D sketch (RDKit 2D layout lifted by the clean-up; stereocentres not guaranteed); through the server
engine it yields an ETKDG conformer that honours the SMILES stereochemistry. Flat 2D MOL input is
lifted into 3D on request.

## Principles

- The molecular graph (`packages/molecule-model`) is the source of truth; the renderer is derived from it.
- Chemistry is deterministic and comes from RDKit; nothing an LLM says is treated as chemical truth.
- Every value shown is labelled **computed** (follows from the structure) or, later, **predicted** (from a model).
- No operational synthesis instructions; the future reaction-planning module is a research abstraction only.
