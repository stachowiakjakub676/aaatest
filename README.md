# Clapeyron

<img src="apps/web/public/icons/logo.svg" width="72" align="right" alt="Clapeyron logo" />

Clapeyron is a desktop-first, cross-platform application that treats molecular structures the way
CAD software treats mechanical parts: an interactive 3D viewport, a deterministic molecular graph
as the single source of truth, computed properties from established cheminformatics libraries,
estimates from published models (named after the Clausius–Clapeyron relation behind the
vapour-pressure estimate), and a rule-based synthesis planner.

**Status: prototype, all ten phases delivered** (analysis, domain model, 3D viewer, editor,
chemistry engine, import/export, UX, assistant architecture, retrosynthesis abstraction,
end-to-end tests + CI, packaging). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the
architecture, dependency choices, risks and roadmap, and [`docs/PACKAGING.md`](docs/PACKAGING.md)
for the single-file build, the PWA and the Tauri desktop shell.

The editor is open-ended: start from an empty canvas, place any of the 118 elements, grow
structures atom by atom without limit, bond, re-order, move, delete, undo and redo. Several
molecules can be open at once as tabs above the viewport, each with its own undo history; the
workspace is autosaved in the browser and can be exported as one file. The built-in sample
molecules are optional starting points, not a catalogue.

**Desktop installers** (Windows .exe/.msi, macOS .dmg, Linux AppImage/.deb) are built by the
"Desktop installers" GitHub Actions workflow; see [`docs/PACKAGING.md`](docs/PACKAGING.md).

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
pnpm build         # apps/web/dist/ (multi-file, PWA) and apps/web/dist/clapeyron.html (single file)
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

Everything an engine returns is labelled **computed**. Estimates from published models are shown
in a separate section labelled **predicted** (see below).

The single-file build `apps/web/dist/clapeyron.html` needs no server: open it in Safari on an
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

## Designing new compounds

The editor is built for inventing structures, not browsing a catalogue:

- **Fragment library** (toolbox): 131 RDKit-generated 3D templates in six categories (rings,
  heterocycles, functional groups, alkyls, halogens, protecting groups), searchable by name or
  SMILES. Select one atom and tap a fragment; one hydrogen on each side is replaced by the new
  bond and the clean-up relaxes the join. Any SMILES typed into the toolbox becomes a fragment
  too (its first atom is the attachment point), and any of the 118 elements can be placed by hand.
- **Stereochemistry**: CIP labels (R/S, E/Z) are perceived from the 3D coordinates by the chemistry
  engine and shown on the atom labels and in the inspector; unassigned centres are flagged.
  *Mirror* gives the enantiomer, *Invert* swaps two substituents of one centre, *Flip E/Z* and
  torsion rotation act on a selected bond. All are undoable commands on the graph.
- **Display styles**: ball-and-stick, sticks, space-filling (van der Waals radii), hide hydrogens.
  Styles never touch the graph.
- **Estimated properties** (Chemistry tab, marked PREDICTED), all offline except the last:
  boiling point, melting point, physical state at 25 °C, enthalpy of vaporisation and formation,
  critical constants, heat capacity and vapour pressure from the Joback group-contribution
  method; density (Girolami); aqueous solubility (ESOL, Delaney 2004); acid/base character from
  class-typical pKa ranges; QED drug-likeness and synthetic accessibility from the server engine.
  Every item names its model and its known error, and "Why this value" opens the breakdown (which
  groups contribute how much) with reasoning in words, e.g. why each extra CH2 in an aldehyde
  chain raises the boiling point by about 23 K while an OH adds 93 K. Molecules with atoms outside
  the group table get "not available" instead of a guess. Rule sets (Lipinski, Veber, Egan) are
  evaluated on computed descriptors and shown as rule checks.
- **Is it new?** The InChIKey links to a PubChem search; no hit is a hint, not proof, of novelty.

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
  carbon, tidy) use the same path. The report also carries the estimates (with their reasoning),
  deterministic observations (separate fragments, charges, stereocentres, flexibility) and the
  planned synthesis, so you can **ask questions** ("why is the boiling point high?", "is it
  soluble?", "how would I make it?"): the built-in answerer matches the question to the report
  offline and never invents numbers; the server explainer forwards the question to the language
  model together with the report.
- **Retro.** *Plan synthesis* runs a rule-based planner: about 30 textbook reaction templates
  (esterification, amide coupling, Williamson, reductive amination, Grignard, Wittig, aldol,
  Friedel–Crafts, Suzuki, nitration, oxidations and reductions, …) are applied backwards for up to
  three steps until the precursors are common building blocks (a list of 248 canonical SMILES) or
  small fragments. Up to three routes are shown in forward order as reaction schemes: 2D
  structures drawn by RDKit, the balanced equation with what is released (e.g. H2O) or must be
  supplied by a reagent (e.g. H2), atom economy, mechanism class, reagent and condition classes,
  what leaves the reaction, a textbook reference and caveats (for example acidic protons that
  would quench a Grignard reagent); no quantities or procedures are generated. Any precursor opens
  in a new tab, so the target stays where it was. `RetrosynthesisService` (`analyzeTarget`, `generateCandidates`,
  `rankCandidates`) remains the research abstraction underneath. The bundled mock recognises functional groups, lists acyclic bonds that
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
