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

The right panel has six tabs: **Inspect**, **Chemistry**, **Phase**, **Materials**, **Assistant**, **Retro**.

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

## Phase behaviour and solvents (phase 11)

Clapeyron's namesake: the **Phase** tab builds a pressure–temperature diagram of the drawn compound
from the Joback estimates and answers the everyday question "at what temperature will this boil on
my rotary evaporator?"; the **Materials** tab estimates Hansen solubility parameters and matches
them against a solvent table with greenness classes.

- **Phase.** The acentric factor ω is back-calculated from Tb, Tc and pc (Lee–Kesler); the same
  correlation gives the vapour-pressure curve, which is inverted for the boiling point at any
  pressure (presets: 1 atm, 100 mbar, 20 mbar rotavap, 1 mbar). ΔHvap follows Watson's scaling.
  The solid boundaries come from Clausius–Clapeyron: the sublimation line with
  ΔHsub = ΔHfus + ΔHvap at the triple point (taken at the Joback melting point), the melting
  line with ΔVfus ≈ 10 % of the Girolami molar volume. The diagram shows the three boundaries, the
  triple and critical points, the standard state and your chosen conditions; hovering reads the
  phase anywhere. Every number is an estimate: ten kelvin of error in Tb is a factor 1.5–2 in
  pressure, and the melting point is the least reliable Joback property.
- **Materials.** Hansen parameters δd/δp/δh by the Hoftyzer–Van Krevelen group method (with the
  book's symmetry rule for identical halogens on one carbon) over the Girolami molar volume, with
  the group breakdown. Forty-six common solvents with Hansen's measured parameters, boiling points
  and their **CHEM21** class (recommended / problematic / hazardous / highly hazardous, Prat et
  al. 2016) are ranked by Hansen distance Ra to the molecule ("like dissolves like"); a second tool
  proposes greener substitutes for any solvent in the table (for example ethyl acetate or
  2-MeTHF for dichloromethane). Both are rankings by cohesion-energy similarity, not guarantees of
  equal performance, and the classes are transcribed from the guide: check the source and the
  safety data sheet before acting on one.
- **Mixtures (Phase tab, below the diagram).** Pick a solvent from the table as the second
  component. Activity coefficients come from **original UNIFAC** (Fredenslund et al.): both
  molecules are split into UNIFAC subgroups by SMARTS matching on the in-browser RDKit (a port of
  the priority fragmentation in the `thermo` library, checked against it on every tabulated
  solvent and two dozen test molecules), and the published R, Q and interaction parameters are
  generated into the repository from `thermo` by `packages/chem-core/scripts/generate_unifac.py`
  (nothing typed from memory). When a molecule cannot be fragmented, or a group pair has no
  published parameter, the tools fall back to the ideal solution and say why.
  *Distillation*: modified-Raoult T–x–y diagram (p = Σ xᵢγᵢpᵢ°) on the two Lee–Kesler vapour
  curves, boiling-point gap, relative volatility at both ends of the composition range, Fenske
  minimum stages, a verdict (easy / normal / hard / impractical / azeotropic), the **predicted
  azeotrope** (composition, temperature, minimum- or maximum-boiling; ethanol–water comes out at
  x ≈ 0.9 and ≈ 78 °C against the measured 78.2 °C), and the literature azeotrope for comparison
  when the drawn molecule and the solvent are a tabulated pair. *Cooling crystallisation*:
  Schröder–van Laar solubility with the UNIFAC activity coefficient of the solute in the saturated
  solution (ideal when unavailable), solubility in g per 100 g solvent at the hot and cold
  temperatures, recovery fraction, solvent needed per gram, the solubility curve, and γ itself,
  which tells you whether the solvent is a crystallisation solvent or an anti-solvent (naphthalene
  in water: γ ≈ 10⁵). The solvent's constants are estimated by the same
  methods on its own structure and anchored at its measured boiling point and Hansen parameters
  (water uses measured constants). A *Measured values* box lets you replace the estimated Tb, Tm
  and ΔHfus of the drawn molecule with data-sheet values; everything downstream uses them.
- Both tabs refuse structures their group tables do not cover (hetero-aromatic and fused rings,
  alkynes, sulfur groups, iodine…) instead of guessing, and the Chemistry tab and the assistant
  carry the same numbers (vapour pressure at 25 °C, boiling point at 20 mbar, ΔHvap at 25 °C,
  Hansen parameters with the closest solvents).

## Design engine (stage 3, phase 3A)

The **Design** switch in the header opens the design workspace: the program is moving from
"what are the properties of this molecule?" to "I need a molecule that satisfies these
requirements". Phase 3A delivers the data model and the specification builder; candidate
generation, filtering, ranking and comparison follow in phases 3B–3F on the same model.

- **`packages/design-engine`** is a separate package with a small API. Its *property catalogue*
  lists every quantity a specification may constrain, with the provenance class the current tools
  supply (computed / predicted / estimated / experimental / database), the method and its typical
  error. A *specification* has hard constraints (range, bound or category on a catalogue
  property), soft preferences (higher / lower / close to a target, with a weight, stored now and
  used for ranking in phase 3D), and structural constraints (allowed elements, heavy-atom range,
  neutrality, required and forbidden SMARTS). `validateSpecification` reports incomplete or
  contradictory requirements; `evaluateSpecification` checks a candidate *profile* (values with
  provenance) and returns pass / fail / unknown per requirement with the reason, never a bare
  score. Specification files (`kind: "clapeyron-specification"`) round-trip through
  `serializeSpecification` / `parseSpecification`.
- **Builder.** Property pickers grouped by domain show the method and error next to every
  requirement; live validation; element chips, heavy-atom range, neutrality, SMARTS lists (checked
  by RDKit from phase 3B); autosave in the browser; import/export as JSON.
- **Candidates (phase 3B).** *Generate and validate* runs a `CandidateGenerator` and records every
  candidate with its provenance. Two deterministic generators ship: *derivatives of the editor
  molecule* (each library fragment attached at each hydrogen-bearing C, N or O of the seed, one
  substitution per candidate, sites and fragments in a fixed order) and a *library screen* (the
  248 building blocks and the 46 solvents, parsed through the engine). Validation runs in stages
  and keeps the stage and reason of every rejection: structural scope (elements, heavy atoms,
  charge) → graph validity (valence, connectivity) → RDKit sanitisation → duplicates by canonical
  SMILES → required and forbidden SMARTS (matched by RDKit in the browser). Nothing invalid reaches
  later stages. A run stores the specification snapshot, generator and parameters, seed, engine
  version and timestamps and exports as `kind: "clapeyron-design-run"`; any candidate opens in a
  new editor tab.
- **Evaluation and filtering (phase 3C).** Every valid candidate is profiled with the same
  descriptors and models as the Chemistry tab (RDKit descriptors, Joback, Lee–Kesler, Girolami,
  ESOL, Hansen, class pKa; QED/SA when the server engine is selected), once per canonical
  structure (a session cache), and checked against the hard constraints: the table shows the
  verdict (pass / borderline / fail / undecided), the first reason for anything but a clean pass,
  one column per property the specification mentions (each value tagged computed or predicted,
  method and error on hover) and an expandable list of every requirement with its reason. Filters:
  all, passing, passing or borderline, failing, undecided, rejected. The run records the models
  used and the cache hits.
- **Ranking and trade-offs (phase 3D).** The soft preferences are objectives. Each passing or
  borderline candidate with every preferred property available gets a per-objective satisfaction
  (0–100 % over the ranked population; higher / lower / close to a target), a **Pareto front**
  number (★ front: no other candidate is at least as good on every objective and better on one;
  fronts are peeled layer by layer) and a weighted score from your weights. The table orders by
  front, then weighted score; a trade-off block lists each objective's range and best candidate,
  the Pareto front members and, for two objectives, a scatter with the front highlighted.
  Ineligible candidates say why (failed, missing value, not evaluated). There is no single
  "best molecule": the front keeps every trade-off visible, the weights only order it.
- **Comparison (phase 3E).** Tick up to six candidates (or *Compare the front*) for a
  side-by-side matrix: 2D depiction and a rotatable 3D structure per candidate, verdict and
  rank, the hard constraints with each candidate's verdict and value, then every property any
  of them has a value for, grouped by domain, each tagged computed or predicted with the method
  and error on hover. A cell is highlighted as best in its row only where a soft preference says
  which direction is better. The matrix exports as CSV; any column opens in the editor.
- **Iteration and reproducibility (phase 3F).** A candidate opened in the editor carries its
  lineage; after editing it, *Add to run* validates and evaluates the edited molecule against
  the run's specification and appends it as a candidate whose origin says "edited candidate X in
  the 3D editor" (duplicates of the run are rejected as such). When the specification changes
  after a run, the workspace says so and *Re-evaluate* re-applies the hard constraints to the
  existing profiles without recomputing anything (changed structural rules are called out: they
  need a new run). Every run of the session is listed with its counts and can be viewed again or
  **repeated** exactly from its stored specification snapshot, generator, parameters and seed
  molecule (the repeat records which run it reproduces); runs import and export as
  `kind: "clapeyron-design-run"` files, which hold the specification snapshot, generator,
  parameters, seed, engine and model versions, timestamps, every candidate with its origin,
  status and reasons, profiles and verdicts, and a history of later additions and
  re-evaluations.
- **Margins.** Predicted properties carry a typical error (13 K for the Joback boiling point,
  1 log unit for ESOL, …). A miss smaller than that error is reported as *borderline*, not as a
  fail, so a candidate is never rejected on a difference the model cannot resolve; the builder
  shows the margin next to each property and marks the ones that need the server engine.
- **Requirement sheet and live check.** The right pane renders the specification in words and
  checks the molecule open in the editor against it, using the same descriptors and predictions
  the Chemistry tab shows (`design/profile.ts` maps them onto the catalogue): each row carries
  the actual value with its provenance tag, the verdict and, on hover, the reason including the
  model error. A molecule passes only when every requirement passes; missing values leave it
  undecided rather than failing it.

## Principles

- The molecular graph (`packages/molecule-model`) is the source of truth; the renderer is derived from it.
- Chemistry is deterministic and comes from RDKit; nothing an LLM says is treated as chemical truth.
- Every value shown is labelled **computed** (follows from the structure) or, later, **predicted** (from a model).
- No operational synthesis instructions; the future reaction-planning module is a research abstraction only.
