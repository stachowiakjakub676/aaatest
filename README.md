# Molecular CAD

A desktop-first, cross-platform application that treats molecular structures the way CAD software
treats mechanical parts: an interactive 3D viewport, a deterministic molecular graph as the single
source of truth, and computed properties from established cheminformatics libraries.

**Status: prototype, all ten phases delivered** (analysis, domain model, 3D viewer, editor,
chemistry engine, import/export, UX, assistant architecture, retrosynthesis abstraction,
end-to-end tests + CI, packaging). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the
architecture, dependency choices, risks and roadmap, and [`docs/PACKAGING.md`](docs/PACKAGING.md)
for the single-file build, the PWA and the Tauri desktop shell.

The editor is open-ended: start from an empty canvas, place any of the 118 elements, grow
structures atom by atom without limit, bond, re-order, move, delete, undo and redo. The built-in
sample molecules are optional starting points, not a catalogue.

## Layout

```
apps/web                 React + Three.js client (runs in any modern browser incl. iPad Safari; PWA-ready)
apps/desktop             Tauri 2 desktop shell scaffold (Windows NSIS/MSI, macOS, Linux)
tests/e2e                Playwright end-to-end and visual smoke tests against the built page
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
pnpm build         # apps/web/dist/ (multi-file, PWA) and apps/web/dist/molecular-cad.html (single file)
pnpm test:e2e      # Playwright suite against the built page (needs Chromium: pnpm exec playwright install chromium)

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

## Assistant and retrosynthesis (phases 7–8)

The right panel has four tabs: **Inspect**, **Chemistry**, **Assistant**, **Retro**.

- **Assistant.** A deterministic `MoleculeAnalysisService` turns the molecule, its validation and
  the engine's descriptors into a structured `AnalysisReport` (with Lipinski rule checks, labelled
  as rule evaluations). An `ExplanationService` turns the report into prose: the built-in template
  explainer works offline; the server explainer calls a language model through
  `POST /ai/explain` (Anthropic SDK, enabled with `MCAD_AI_PROVIDER=anthropic` on the API). The
  model only ever sees the report and can only propose **suggestions** made of a closed set of
  edit operations; the client validates each against the live molecule and applies it only when
  you press *Apply* (one undoable step). Rule-based suggestions (add hydrogens, fix an over-valent
  carbon, tidy) use the same path. `PredictionService` remains a placeholder: no models, no
  predicted numbers.
- **Retro.** `RetrosynthesisService` (`analyzeTarget`, `generateCandidates`, `rankCandidates`) is
  a research abstraction. The bundled mock recognises functional groups, lists acyclic bonds that
  could conceptually be disconnected (ester, amide, ether, amine, α-carbonyl, generic C–C), shows
  the H-capped fragments with their SMILES, and ranks them with a fixed heuristic. Every candidate
  can carry a `ReactionRecord` (reagents with roles and amounts, conditions, yield, procedure)
  modelled after the Open Reaction Database, always with a provenance (user, literature, database
  or model). The mock has no knowledge base and never fills these fields; you can add your own
  notes per candidate and copy the whole analysis as JSON. A `SafetyPolicy` gates what is shown:
  model-generated details stay hidden until reviewed, and a pluggable `TargetScreener` can withhold
  operational details for a deployment's restricted targets (none is shipped).

## Principles

- The molecular graph (`packages/molecule-model`) is the source of truth; the renderer is derived from it.
- Chemistry is deterministic and comes from RDKit; nothing an LLM says is treated as chemical truth.
- Every value shown is labelled **computed** (follows from the structure) or, later, **predicted** (from a model).
- No operational synthesis instructions; the future reaction-planning module is a research abstraction only.
