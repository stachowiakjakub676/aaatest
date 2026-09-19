# Clapeyron (Molecular CAD) — architecture and phase 0 analysis

_Last updated after phase 10 (packaging). Keep this file in sync with the code._

## 1. Repository and environment (phase 0 findings)

- The repository started empty (no commits).
- Available runtimes in the development environment: Node 22, pnpm 10 (chosen), npm 10, yarn 1,
  Python 3.11, uv 0.8. RDKit installs cleanly via `uv pip install rdkit` (2026.03 build).
- Chosen stack matches the brief: TypeScript + React + Three.js on the client, Python + RDKit in the
  chemistry core, FastAPI planned for the service layer.

## 2. Architecture

```
                 ┌──────────────────────────────┐
                 │  apps/web (React + Three.js)  │   UI, viewport, editor (phase 3), panels
                 └──────────────┬───────────────┘
                                │ imports
                 ┌──────────────▼───────────────┐
                 │ packages/molecule-model (TS)  │   Atom/Bond/Molecule/Conformer, pure edit ops,
                 │  deterministic, no DOM/three  │   structural validation, formula/weight, JSON
                 └──────────────┬───────────────┘
                                │ MCAD-JSON (schemaVersion 1) over HTTP (phase 4)
                 ┌──────────────▼───────────────┐
                 │ services/api (FastAPI)        │   thin transport layer, no chemistry of its own
                 └──────────────┬───────────────┘
                 ┌──────────────▼───────────────┐
                 │ packages/chem-core (Python)   │   RDKit bridge, sanitisation, descriptors,
                 │  deterministic                │   SMILES/MOL/SDF I/O (phase 5), 3D embedding
                 └──────────────────────────────┘
      optional:  PredictionService / ExplanationService / RetrosynthesisService (phases 7–8)
                 consume chem-core output; they never write to the molecule directly.
```

### Decisions and deviations from the suggested tree (with reasons)

| Suggested             | Done                                                    | Why                                                                                                   |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/packages/shared-types` | folded into `molecule-model/src/types.ts`            | The types *are* the model; a separate package would be one file re-exporting another. Split later if the API contract grows (OpenAPI-generated types). |
| `/packages/ui`        | deferred; components live in `apps/web/src/ui`          | Only one client exists. Extract when the iPad/desktop shells need the same components.               |
| `/tests/{unit,integration,visual}` | tests colocated per package (`test/`, `tests/`) | Each package runs its own suite in its own toolchain (vitest / pytest). `/tests` is reserved for cross-package integration and visual tests (phase 9). |
| `/apps/desktop`       | Tauri 2 scaffold (config, Rust entry, capabilities)     | Hosts `apps/web/dist`; Python API optional as a sidecar. See docs/PACKAGING.md. |
| Python domain model   | `chem-core/schema.py` mirrors the TS types              | The client needs the model without a server (iPad, offline). The TS model is canonical; Python validates the same JSON. |

### Where chemistry runs on an iPad

iPadOS cannot run a Python process. Two viable paths, both keep chem-core portable:

1. **Remote service** — the iPad client calls `services/api`. Simple, needs connectivity.
2. **RDKit in the browser** — the official `@rdkit/rdkit` package (RDKit MinimalLib compiled to
   WebAssembly, maintained by the RDKit project, versioned with RDKit itself) exposes SMILES/MOL
   parsing, sanitisation, descriptors and 2D/3D coordinate generation. This gives offline chemistry
   on the iPad without duplicating rules in TypeScript.

Recommendation: implement phase 4/5 against a `ChemistryEngine` interface with two adapters
(`RemoteRdkitEngine`, `WasmRdkitEngine`). The Python core remains the reference implementation and
the place for heavier work (conformer search, batch descriptors).

## 3. Domain model (phase 1)

- `Atom { id, element, formalCharge, position{x,y,z}, isotope?, chirality?, implicitHydrogens? }`
- `Bond { id, atomA, atomB, order: single|double|triple|aromatic, stereo? }`
- `Molecule { schemaVersion: 1, id, name?, atoms, bonds, conformers?, metadata }`
- `Conformer { id, name?, energy?, positions: Record<AtomId, Vec3> }`

All operations are pure functions returning new objects (`addAtom`, `removeAtom`, `addBond`,
`setBondOrder`, `moveAtom`, …) so the editor's undo/redo (phase 3) is a stack of molecule snapshots.

Validation is two-layered on purpose:

- **Client (`validateMolecule`)**: graph integrity (ids, dangling/self/duplicate bonds), data sanity
  (element symbols, charges, isotopes, finite coordinates), overlapping atoms, and a *small,
  documented* valence rule for common main-group elements with charge adjustment. Metals and exotic
  species are explicitly not checked here.
- **Engine (`chem_core.validate_molecule`)**: RDKit `DetectChemistryProblems` (valence, aromaticity,
  kekulisation) reported with the client's atom ids.

Formula (Hill order) and molecular weight are computed from IUPAC 2021 standard atomic weights; the
result is flagged `approximate` when an isotope label or a mass-number-only element is involved.

## 4. 3D viewer (phase 2)

- `sceneBuilder.ts` turns a `Molecule` into Three.js objects (ball-and-stick, half-bond colouring,
  multiple bonds as parallel cylinders, aromatic as solid + thin secondary line). Every mesh carries
  `userData = { kind, id }`; the scene is rebuilt from the graph on every change, never edited in place.
- `Viewport.tsx` owns renderer, camera (40° FOV), OrbitControls (touch: one finger rotate, two
  fingers zoom/pan), CSS2D atom labels, raycast picking (press-without-drag = click), on-demand
  rendering (no animation loop, battery-friendly on tablets), orientation gizmo, theme-aware background.
- `sceneBuilder` is DOM-free and unit-tested in node (mesh counts, id tagging, geometry, selection).

## 4b. Editor (phase 3)

- **Commands** (`apps/web/src/editor/commands.ts`) are pure functions `Molecule -> { molecule, label, selection? }`
  composed from the domain operations: add free / bonded atom, bond two atoms, change or cycle
  bond order, delete atom / bond / selection, set element, set formal charge, move atom, add or
  remove hydrogens. They throw `CommandError` for impossible requests and never touch the renderer.
- **History** (`editor/history.ts`) is an immutable past/present/future stack of molecule
  snapshots (structural sharing makes snapshots cheap). Drags update the present without recording
  and are committed as one step on release.
- **Placement** (`molecule-model/src/placement.ts`) puts a new atom at the ideal bond length
  (sum of covalent radii, shortened for multiple bonds) in an idealised direction chosen from the
  anchor's existing bonds: tetrahedral by default, trigonal when a double/aromatic bond is present,
  linear for triple bonds. It is a sketching heuristic; geometry optimisation stays an explicit
  engine action (phase 4).
- **Tool modes** (select, add, bond, move, delete) live in the UI only. The viewport reports taps
  (with the world point on the plane through the orbit target) and atom drags; `App` maps them to
  commands depending on the mode. The camera re-frames only when a different molecule is loaded or
  the first atom appears, never on ordinary edits.
- Over-valent or otherwise inconsistent intermediate states are allowed and reported by the
  validator, so the user can build freely and fix afterwards.

## 4c. Chemistry engine (phase 4)

- **Interface** `apps/web/src/chemistry/engine.ts`: `ChemistryEngine { ready, validate, properties,
  optimizeGeometry, capabilities }`. Results carry `kind: "computed"` and a `source` string. A
  separate `PredictionService` interface (returning `kind: "predicted"` items with model name and
  uncertainty) exists with a no-op implementation so the UI already distinguishes the two.
- **WasmRdkitEngine**: official `@rdkit/rdkit` build (RDKit MinimalLib, 7.3 MB wasm). Molecules
  are sent as MOL V2000 blocks written by `molecule-model/src/molfile.ts`; RDKit's error log is
  captured and mapped back to atom ids for validation messages. No force fields in this build, so
  geometry optimisation is reported as unsupported. The single-file build embeds the glue and the
  wasm bytes (base64, instantiated through Emscripten's `instantiateWasm` hook: no fetch, works from
  `file://` and under strict CSP). The multi-file build loads `./rdkit/*` lazily.
- **RemoteRdkitEngine**: `services/api` (FastAPI). `POST /validate`, `/properties`, `/optimize`.
  `chem_core.geometry.optimize_geometry` adds hydrogens temporarily, minimises with MMFF94 (UFF
  fallback), and returns only the caller's atoms in the caller's order; `embed=true` regenerates a
  conformer with ETKDG (seed 42) first. The server URL is a user setting.
- **UI**: the inspector's Chemistry section shows engine choice and status, engine validation
  issues, computed properties (canonical SMILES, InChIKey, exact mass, curated descriptors with the
  same keys/labels on both engines) and the Predictions placeholder. Geometry optimisation is an
  explicit button that produces one undoable history step; the engine never moves atoms on its own.
- Descriptor definitions are aligned across engines (e.g. Lipinski N+O / NH+OH counts) so
  switching engines does not change numbers silently.

## 4d. Sketch clean-up force field (phases 5/6)

`molecule-model/src/cleanup.ts` is a deliberately small force field used as a *drawing aid*:
harmonic bonds (ideal lengths from covalent radii, shortened for multiple bonds), harmonic angles
with the ideal from the centre's hybridisation (sp 180°, sp2 120°, sp3 109.47°, hypervalent 90°,
metals by coordination number), an out-of-plane term for three-coordinate sp2 centres, torsions
(2-fold planar on double bonds, weak 3-fold staggered on sp3-sp3 single bonds) and a soft quadratic
repulsion for pairs more than two bonds apart. Minimisation is damped steepest descent with
backtracking; analytic gradients for pair terms, central differences for the angular ones. A tiny
deterministic jitter (0.02 Å) breaks the symmetry of planar/linear input, which otherwise sits on a
saddle point; a larger jitter lifts 2D input into 3D. Energies are arbitrary units and are never
shown as physical quantities. Fixed atoms are supported (drag interactions).

The editor runs it automatically after bonding changes (≤ 300 atoms, 250 iterations, same undo
step) and on demand (Tidy, 800 iterations). Real optimisation remains the engine's MMFF94/UFF.

## 4e. Import / export (phase 5)

- Formats: MCAD JSON (`serialization.ts`), MOL V2000 (`molfile.ts`), SDF with data items
  (`formats.ts`), SMILES via the chemistry engine (`fromSmiles` / `toSmiles`).
- `detectFormat` works on content only; `parseStructureText` dispatches for coordinate-carrying
  formats. SMILES needs an engine: the WASM engine lays out in 2D and the clean-up lifts to 3D;
  the server engine embeds with ETKDG (seed 42) and relaxes with MMFF94/UFF, honouring stereo.
- Pipeline: parse → shape validation → structural validation (`validateMolecule`) → the dialog
  shows every issue → import is blocked on errors, allowed with warnings. Flat 2D coordinates are
  detected and optionally lifted.
- Round trips are tested at every layer: JSON, MOL write→parse for all samples, SDF multi-record,
  SMILES → molecule → SMILES on the WASM engine (aspirin, benzene) and on the API (L-alanine with
  stereo).

## 4f. Assistant architecture (phase 7)

```
 molecule + validation + engine results
        │  (deterministic)
        ▼
 MoleculeAnalysisService.analyze()  ──►  AnalysisReport { kind: "computed", ... , suggestions: Suggestion[] }
        │                                        │
        │                                        ▼
        │                              ExplanationService.explain(report)
        │                                 ├─ TemplateExplanationService (offline, deterministic prose)
        │                                 └─ RemoteExplanationService → POST /ai/explain → Claude (structured JSON)
        ▼                                        │
 Suggestion { source: "rule" | "llm", operations: EditOperation[] }  ◄──── validated (validateSuggestion)
        │
        ▼  user presses Apply
 applySuggestion() → editor command → history.commit (one undo step)
```

- The model receives only the structured report and returns prose plus optional suggestions in a
  closed operation vocabulary (`setElement`, `setCharge`, `removeAtom`, `removeBond`,
  `setBondOrder`, `addBondedAtom`, `addHydrogens`, `tidy`). Ids must exist, elements must be known,
  and one invalid step discards the whole suggestion; nothing is applied without confirmation.
- Server side (`services/api/app/ai.py`): an `ExplanationProvider` protocol with an Anthropic
  implementation (`claude-opus-5`, `messages.parse` with a Pydantic schema, refusal handled) and a
  disabled default; the endpoint is 503 unless `MCAD_AI_PROVIDER=anthropic` is set. Tests use a fake
  provider. The system prompt forbids invented numbers, biological claims and synthesis details.
- The report also carries `observations` (fragments, charges, stereo, flexibility, unusual
  elements), `estimates` (every `Prediction` with its model, error and reasoning) and, when the
  planner has run, `synthesis` (forward sentences of the best route). `answerQuestion()` in
  `ai/explanation.ts` answers free-text questions offline by matching keyword intents (boiling,
  melting, state, solubility, density, acid/base, lipophilicity, polarity, drug-likeness,
  synthesis, stereo, groups, formula, validity, novelty; English and a few Polish stems) and
  composing the answer from the report only. The server explainer accepts the same `question`
  (`POST /ai/explain {report, question}`); the system prompt allows it to repeat reaction names
  and reagent classes already in the report but never to add numbers, conditions or procedures.

## 4g. Retrosynthesis abstraction (phase 8)

- `RetrosynthesisService { analyzeTarget, generateCandidates, rankCandidates }` plus a
  `SafetyPolicy` gate. `MockRetrosynthesisService` uses `molecule-model/src/perception.ts`
  (ring count, ring-bond test, six-cycles, functional-group catalogue) to label acyclic heavy-atom
  bonds with a retron class, splits the graph there (`splitAtBond`, H-capped fragments), asks the
  chemistry engine for fragment SMILES, and ranks by a fixed heuristic (class weight + fragment
  balance). Ring bonds are never cut.
- Reaction data: `ReactionRecord { reagents[], conditions, yield?, procedure, provenance, reviewed }`
  (ORD-inspired) is optional on every candidate. `validateReactionRecord` checks user input and
  imports. The mock never fills it; the panel offers a notes form (provenance `user`, or
  `literature` when a citation is given) and a JSON export of the whole analysis.
- Safety design: `PROVENANCE_POLICY` decides per candidate whether the reaction record is shown:
  withheld when the `TargetScreener` did not permit the target, or when provenance is `model` and
  nobody marked it reviewed; conceptual disconnections themselves are always shown. `NO_SCREENER`
  is the shipped default and says so in the UI; a deployment plugs its own screener in. The panel
  labels everything as a mock research abstraction.

## 4h. Creativity layer: fragments, stereochemistry, styles, estimates

- **Fragment library**: `packages/chem-core/scripts/generate_fragments.py` embeds 39 templates
  (ETKDGv3 seed 42, MMFF94) into `molecule-model/src/samples/fragments.ts`; each records the
  attachment atom. `attachFragment` (editor command) removes one hydrogen on the anchor and on the
  attachment atom, orients the template so its former C–H axis points at the anchor, copies atoms
  and bonds with fresh ids, bonds them and requests a tidy. Tested: methane + phenyl → C7H8.
- **Stereochemistry**: `ChemistryEngine.stereo()` returns CIP labels; the WASM engine reads
  `get_stereo_tags()` on the 3D molblock (RDKit perceives configuration from coordinates; flat
  centres come back as "?"), the server uses `AssignStereochemistryFrom3D`. Transforms live in
  `molecule-model/src/transform.ts`: `mirrorMolecule`, `rotateAroundBond` (branch on one side of an
  acyclic bond), `invertCentre` (swap the two smallest independent substituent branches; null for
  ring-locked centres so the UI can fall back to Mirror). Labels are appended to the CSS2D atom
  labels in the viewport without rebuilding the scene.
- **Display styles**: `SceneStyle` presets (ball-and-stick, sticks, spacefill with Bondi vdW radii)
  plus `hideHydrogens`; the builder filters hidden atoms and skips bonds in spacefill. The graph is
  untouched, so measurements, formulas and undo history are unaffected.
- **Estimates**: `chemistry/predictions.ts` assembles the PREDICTED block:
  - Joback & Reid (1987) group contributions from `molecule-model/src/groupContribution.ts`:
    the assigner maps every heavy atom to one of the 41 Joback groups (multi-atom groups −COOH,
    −COO−, O=CH−, >C=O, −CN, −NO2 consume their heteroatoms; ring/aromatic variants by ring-bond
    membership; explicit and implicit hydrogens both counted) and refuses molecules with an atom
    outside the table rather than guessing. Normal boiling point, melting point, critical
    constants, ΔHvap, ΔHf, ΔHfus and Cp(298) follow the published formulas (acetone reproduces
    the textbook example to the last digit). The physical state at 25 °C is derived from Tb/Tm
    with a ±20 K margin, the vapour pressure at 25 °C by Clausius–Clapeyron from Tb and ΔHvap.
  - Girolami (1994) liquid/solid density from scaled atomic volumes with the hydroxyl / acid /
    N–H / amide / sulfoxide / sulfone corrections.
  - ESOL (Delaney 2004) solubility from cLogP, MW, rotatable bonds and aromatic proportion.
  - Acid/base character from class-typical pKa ranges (carboxylic acid, phenol, aliphatic and
    aniline-type amines, amide N, pyridine N, thiol, sulfonic acid, sulfonamide).
  - Server estimates (`/estimates`: QED, SA score via RDKit contrib).
  Every `Prediction` carries `kind: "predicted"`, a model with citation, an uncertainty string, a
  `group` for the UI and, where the model is additive, a `breakdown` (group or regression terms
  that sum to the value) plus `reasoning` sentences derived from the assigned groups (homologous
  series +22.9 K per CH2, hydrogen-bonding OH +92.9 K, acid dimers, branching, halogen
  polarisability, aromatic stacking…). The Chemistry tab shows a property sheet, then each
  estimate with a "Why this value" disclosure. Rule sets Lipinski, Veber and Egan are `RuleCheck`s.
- **Fragment library** now holds 131 templates in six categories (rings, heterocycles, groups,
  alkyl, halogens, protecting groups), searchable by name or SMILES; any SMILES typed in the
  toolbox becomes a fragment through the engine (`fromSmiles` with hydrogens, first atom =
  attachment point), so the library is open-ended.

## 4j. Workspace: molecule tabs, autosave, workspace files

- `state/workspace.ts`: a `Doc` is a molecule with its own undo `History`. The app holds
  `{ docs, activeId }`; every editor command runs against the active document only. Loading a
  sample, importing a structure or opening a planner precursor reuses the active tab when it is
  untouched (`isPristine`: no atoms, no history) and otherwise adds a tab, so nothing is lost.
- Autosave: 800 ms after any change the molecules (not the undo stacks) are written to browser
  storage as a workspace file; the app restores them on start. The same file can be exported and
  imported through the Import/Export dialog (`kind: "clapeyron-workspace"`, validated molecule by
  molecule).
- The Playwright suite starts every test in a fresh browser context, so autosave never leaks
  between tests.

## 4i. Rule-based synthesis planner

- `retro/synthesis.ts`: `SynthesisPlanner.plan(target)` applies 30 retrosynthetic templates
  written directly on the molecular graph (ester and amide disconnection, Williamson and thiolate
  alkylation, reductive amination, Buchwald–Hartwig, Grignard addition and carboxylation,
  carbonyl reduction / alcohol oxidation, acid from primary alcohol or nitrile, cyanide SN2,
  Sandmeyer, Wittig, dehydration, alkynide alkylation, nitration, halogenation, sulfonation,
  nitro reduction, Friedel–Crafts acylation/alkylation, Suzuki–Miyaura, sulfonamide formation,
  aldol addition/condensation, halide from alcohol, epoxidation). Each template edits the graph
  (cut, cap with H/OH/Br/Cl/NH2/=O/NO2/SO3H/B(OH)2, oxidise or reduce a carbinol) and every
  precursor must pass `validateMolecule` or the move is dropped.
- Search: depth-limited (3 steps) best-first recursion; at each node the top six moves (smallest
  largest-precursor first, then reliability penalty) are expanded; a precursor is a leaf when its
  canonical SMILES (stereo stripped, from the chemistry engine) is in the generated list of 248
  common building blocks (`retro/buildingBlocks.ts`, from `apps/web/scripts/building_blocks.py`)
  or it has ≤ 6 heavy atoms; unresolved precursors cost 3 + heavy atoms / 5 so routes that reach
  real building blocks win. Cycles are blocked by the path set; a memo caches solved intermediates;
  at most 160 nodes are expanded. The best three distinct routes are returned in forward order.
- Output is `kind: "predicted"` with the model named ("rule templates v1"); a step carries only
  the reaction class, reagent class, textbook reference and caveats (chemoselectivity notes such
  as acidic protons vs Grignard reagents, SN2 substitution pattern, directing effects). No
  conditions, amounts or procedures are generated, so the `ReactionRecord` provenance gate is not
  bypassed; a `TargetScreener` that does not permit the target yields no route at all.
- Each step carries a `StepBalance` (Hill formulas of the drawn species, the element difference
  Σ reactants − product split into "released", e.g. H2O, and "supplied by a reagent", e.g. H2,
  and the atom economy as product mass over reactant mass) and the template's mechanism class,
  condition class and what leaves the reaction. After the search the planner draws every distinct
  structure of the returned routes once through `ChemistryEngine.depict()` (RDKit SVG, hydrogens
  removed, fresh 2D coordinates; WASM `get_svg`, server `/depict`).
- The Retro tab shows routes as reaction schemes: structures with name, formula and molar mass,
  the arrow annotated with reagents and conditions, the balanced equation, a facts table and the
  caveats. "Open in tab" loads any precursor into a new molecule tab; tapping the step title
  highlights the bond it forms. The best route is also handed to the assistant report so questions
  such as "how would I make it?" are answered from it.

## 4k. Phase behaviour and solvent selection (phase 11)

- `packages/molecule-model/src/phase.ts`: pure functions over estimated constants. `acentricFactor`
  solves the Lee–Kesler equation at 1 atm; `vapourPressure` is ln(p/pc) = f0(Tr) + ω·f1(Tr);
  `boilingPointAtPressure` inverts it by bisection (null at or above pc); `watsonHvap` scales
  ΔHvap with exponent 0.38; `phaseModel` assembles the vapour, sublimation and melting boundaries
  (triple point at Tm with p from the vapour curve, ΔHsub = ΔHfus + ΔHvap(Tm), Clapeyron slope
  with ΔVfus = 0.1·Vm) and lists every assumption in `notes`; `phaseAt` classifies (T, p). Tests use
  measured hexane and benzene constants so the correlations are checked on their own (ω 0.30/0.21,
  vapour pressures at 25 °C within a few percent, Watson ΔHvap, boiling point at 20 mbar against
  Antoine).
- `packages/molecule-model/src/hansen.ts`: Hoftyzer–Van Krevelen group table (`HANSEN_GROUPS`),
  atom-level assignment (`assignHansenGroups`: benzene rings as one group by substitution count,
  multi-atom C=O/COOH/COO/CN/NO2 groups, aliphatic rings from the cyclomatic number, the
  symmetry factor for identical halogens on one carbon), `hansenParameters` (δd = ΣFd/V,
  δp = √ΣFp²/V, δh = √(ΣEh/V), null when an atom is uncovered), the `SOLVENTS` table (Hansen's
  measured parameters, boiling points, CHEM21 class with a short reason), `hansenDistance`,
  `rankSolvents` and `greenerAlternatives`. Tests check ethanol, acetone, toluene, chloroform and
  cyclohexane against Hansen's values within the method's stated error, the refusal for pyridine,
  and the DCM → ethyl acetate substitution.
- `packages/molecule-model/src/unifacData.ts` (GENERATED by
  `packages/chem-core/scripts/generate_unifac.py` from the `thermo` library, MIT): the 113
  original-UNIFAC subgroups with R, Q, main group, SMARTS pattern(s), priority and hydrogen
  count, the 54 main groups and 1270 published interaction parameters a_mn. The same script
  writes `test/fixtures/unifac.json`: reference group assignments for every tabulated solvent
  plus 25 test molecules, and reference activity coefficients for 12 binary cases, all computed
  by thermo. `src/unifac.ts`: `unifacGammas` (Staverman–Guggenheim combinatorial part written
  without dividing by xᵢ, residual part with group activity coefficients in the mixture and in
  each pure component), `unifacCoverage` (unknown subgroups, missing parameter pairs → refuse),
  `describeUnifacGroups`. Tests: the textbook acetone/pentane and diethylamine/heptane examples,
  every fixture case to 1e-6, infinite dilution, refusals.
- `apps/web/src/chemistry/unifacFragment.ts`: port of thermo's `smarts_fragment_priority` on the
  RDKit WebAssembly module (`get_qmol`, `get_substruct_matches`): all patterns matched on the
  hydrogen-stripped molecule, greedy non-overlapping selection by priority, acceptance only when
  every heavy atom and every hydrogen is accounted for, otherwise a bounded search over excluded
  matches (whole multi-match groups and single matches, up to four units, 5000 tries).
  `WasmRdkitEngine.unifacGroups` exposes it; the App always passes the WebAssembly engine as the
  `fragmenter`, whatever engine is selected for properties. Test: identical assignments to the
  fixture for all 72 molecules (caffeine correctly refused), plus the built-in 3D samples.
- `packages/molecule-model/src/mixtures.ts`: `PureComponent` (constants, Hansen, UNIFAC groups,
  provenance), `activityModel` (UNIFAC when both components have groups and every main-group pair
  has parameters, else ideal with the reason), `activityCoefficients`, modified-Raoult
  `bubblePoint` (bracket widened beyond the pure boiling points for azeotropes) and `txyDiagram`,
  `relativeVolatility` at a composition, `findAzeotrope` (sign change of y − x inside the range,
  classified by the bubble temperature), `fenskeMinimumStages`, `assessDistillation` (orders the
  components, α at both ends, verdict incl. "azeotropic", marks α as not meaningful beyond a
  150 K gap), `nonIdealityFromHansen` (used for the ideal fallback), the `KNOWN_AZEOTROPES`
  literature table keyed by solvent ids, `idealSolubility`, `solubilityMoleFraction` (damped
  fixed point on ln(xγ) = −ΔHfus/R(1/T − 1/Tm)), `solubilityCurve` and `assessCrystallisation`
  (reports the model and γ at the hot temperature). Tests on measured constants: benzene–toluene
  bubble point and α, monotonic T–x–y, Fenske, verdicts, ethanol–water azeotrope at x ≈ 0.8–0.98
  and within 4 K of 78.2 °C, benzene–toluene without one, ideal fallback with reason, naphthalene
  solubility x ≈ 0.22–0.32 in toluene and < 1e-4 in water (γ > 1000), ideal recovery ≈ 60 %.
- Web: `chemistry/components.ts` builds the drawn molecule's `PureComponent` from Joback with
  optional measured overrides, and a solvent's from its SMILES through the engine (Joback Tc/pc,
  ω from the measured Tb, Hansen from the table; water hard-coded; cached per engine).
  `ui/MixtureSection.tsx` (solvent picker, UNIFAC groups of the drawn molecule loaded through the
  fragmenter, distillation and crystallisation sections with the activity model and predicted
  azeotrope) and the
  generic `ui/XyChart.tsx` (linear chart with nice ticks, direct labels placed at evenly spaced x,
  legend for two or more series, crosshair hover) sit below the P–T diagram in the Phase tab.
- Web: `chemistry/predictions.ts` adds Lee–Kesler vapour pressure at 25 °C, boiling point at
  20 mbar, Watson ΔHvap at 25 °C and the Hansen parameters (with the three closest solvents) to
  the PREDICTED list, so the Chemistry tab and the assistant (`vacuum` and `solvent` intents) share
  them. `ui/PhasePanel.tsx` (constants, pressure calculator with unit conversion and presets,
  state at conditions) with `ui/PhaseDiagram.tsx` (inline SVG, log p vs T, three series with direct
  labels and a legend, crosshair hover reading the phase, colours validated for both themes) and
  `ui/MaterialsPanel.tsx` (Hansen grid with the group breakdown, solvent match table filtered by
  class, greener-replacement tool that works without a molecule). The molar volume comes from the
  engine's molecular weight when available (model weight otherwise) and the Girolami density.

## 4l. Design engine (stage 3, phase 3A)

- `packages/design-engine/src/properties.ts`: `PROPERTY_CATALOGUE` (26 keys: RDKit descriptors,
  Joback/Lee–Kesler/Girolami/ESOL/Hansen predictions, class pKa category, server QED/SA) with
  domain, type, unit, `ValueKind`, method and uncertainty; the single place that says where a
  value comes from.
- `specification.ts`: `Specification` (hard `HardConstraint[]` with ops between/≤/≥/in, soft
  `SoftPreference[]` with direction and weight, `StructuralConstraints`), constructors, `touch`,
  `validateSpecification` (unknown property, missing/inverted bounds, categorical misuse, bad
  weights, unknown elements, inverted heavy-atom range, empty or contradictory SMARTS, empty
  specification) and the `describe*` helpers used by the sheet and reports.
- `evaluation.ts`: `CandidateProfile` (catalogue key → `PropertyValue` with kind, method,
  uncertainty), `checkConstraint` (pass/fail/unknown with a reason that quotes the model error
  for predicted values), `checkStructural` (elements, heavy atoms, charge and connectivity from
  the graph; SMARTS rules stay unknown until the engine checks them in phase 3B),
  `evaluateSpecification` (overall verdict and counts).
- `serialization.ts`: specification files, version 1, shape-validated on read.
- Web: `design/profile.ts` maps `ChemistryState` (descriptors, predictions, Hansen from the
  model) onto a profile; `design/useSpecification.ts` holds the specification with browser
  storage and import/export; `ui/design/SpecificationBuilder.tsx` and `ui/design/DesignView.tsx`
  (requirement sheet + live check of the editor molecule). `App.tsx` gains an Editor/Design view
  switch; the design view replaces the toolbox/viewport/inspector row, the editor state is kept.
- Phase 3B. `candidates.ts`: `CandidateGenerator` interface (id, label, defaults, async
  `generate(input, params, onProgress)`), `CandidateOrigin` (generator, strategy, parent,
  operations, library entry), `structuralRejection` and `substitutionSites`;
  `DERIVATIVE_GENERATOR` (fragment substitution on the seed through the model's `attachFragment`,
  moved from the editor commands into `molecule-model/src/attach.ts`) and `LIBRARY_GENERATOR`
  (named libraries parsed through a caller-supplied SMILES parser). `run.ts`: `DesignRun`
  (specification snapshot, generator + params, seed, provenance, records, summary, rejections by
  stage), `StructureTools` (what validation needs from the engine: validate, canonical SMILES,
  substructure test), `validateCandidates` (structural → graph → engine → duplicate →
  substructure, every rejection with stage and reason), run files. Evaluation gains a
  `borderline` status: a miss within the property's `errorAbs`/`errorRel` is not a fail
  (`margins` option, default on); `requires: "server"` marks QED/SA.
- Web: `WasmRdkitEngine.hasSubstructure` (get_qmol + get_substruct_match, null for a bad
  pattern); `design/structureTools.ts` adapts the engine; `design/useDesignRun.ts` runs
  generate → validate with progress and a cancellation token, building the libraries from
  `BUILDING_BLOCKS` and `SOLVENTS`; `ui/design/CandidatesPanel.tsx` (generator, limit, summary,
  provenance line, table with origin and status, show/hide rejected, export, open in a new tab).
- Phase 3C. `evaluator.ts`: `CandidateEvaluator` (models list + `profile(molecule)`),
  `ProfileCache` keyed by canonical SMILES, `evaluateRun` (profiles every valid record, applies
  `evaluateSpecification` with `substructuresVerified` since the validation stage already
  matched the SMARTS, keeps evaluator errors on the record as undecided, summarises
  passed/borderline/failed/undecided and cache hits, merges the models into the run's
  provenance), `filterRecords` and `verdictReason`. Web: `design/candidateEvaluator.ts` builds
  profiles from `engine.properties` + `CompositePredictionService` through `profileFromChemistry`
  (now taking a `ProfileSource`); `useDesignRun` chains evaluate after validate with a per-session
  cache; the candidates panel shows verdicts, reasons, property columns from the specification,
  filters and an expandable per-requirement check list.
- Phase 3D. `ranking.ts`: `rankRecords(records, spec, { admit })` → per-record `RankingInfo`
  (eligibility with reason, per-objective value and normalised score, weighted score with
  normalised weights, Pareto front by iterative peeling, dominated-by count, position), the
  ordered list, the first front, per-objective summaries (range, best candidate) and notes.
  Tests: single dominant candidate, front peeling, genuine two-member front ordered by weights,
  target direction, exclusion of missing values and non-admitted verdicts. Web: the candidates
  panel computes the ranking from the run and the live specification (weights can be changed
  without re-running), adds the rank column (front badge, score bar, position), the order switch
  and the trade-off block with a two-objective scatter (`XyChart` gained unlabelled points).
- Phases 3E–3F plug in here: comparison view over `RankedRecord`s, iteration and run history.

## 5. Dependencies

| Dependency                | Version    | Role                                   | Maintenance check (2026-09)                        |
| ------------------------- | ---------- | -------------------------------------- | --------------------------------------------------- |
| three                     | ^0.186     | 3D rendering                           | monthly releases, de-facto standard WebGL library   |
| react / react-dom         | ^19        | UI                                     | actively maintained                                 |
| vite (+ plugin-react)     | ^8         | build/dev server                       | actively maintained (rolldown-based)                |
| vitest                    | ^5         | TS tests                               | actively maintained                                 |
| typescript                | ^5.9       | types                                  | actively maintained                                 |
| rdkit (Python)            | ≥2024.3    | chemistry core                         | two releases/year, industry standard, BSD           |
| pytest                    | ≥8         | Python tests                           | actively maintained                                 |
| fastapi, uvicorn          | ≥0.115     | chemistry API                          | actively maintained                                 |
| @rdkit/rdkit              | 2026.3.6   | RDKit WASM for offline iPad chemistry  | released by the RDKit project alongside RDKit       |
| @types/node (dev)         | ^22        | node typings for build scripts/tests   | actively maintained                                 |
| anthropic (Python, optional) | ≥0.60   | server-side explanation provider (phase 7) | actively maintained                              |
| planned: tauri            | 2.x        | desktop shell (phase 10)               | actively maintained                                 |

No UI component library, no state-management library, no CSS framework: the app is small enough that
plain React state and hand-written CSS keep the bundle (≈820 kB, mostly three.js) and the dependency
surface minimal.

## 6. Technical risks (hardest first)

1. **3D coordinates for edited structures.** Adding an atom in a CAD-like editor needs a sensible
   position; keeping geometry chemically reasonable after edits needs an engine (RDKit ETKDG / MMFF).
   Plan: heuristic placement client-side (ideal bond length along a free valence direction), with an
   explicit "optimise geometry" action delegated to RDKit. Never auto-move the user's atoms silently.
2. **Chemistry on iPad without a server.** See §2; RDKit WASM is the mitigation. Its bundle is
   ~10 MB, so it must be lazy-loaded and cached.
3. **Aromaticity and Kekulé representation.** The model stores either explicit aromatic bonds or a
   Kekulé structure; converting between them and keeping hydrogen counts consistent is RDKit's job,
   but UI actions (change bond order inside a ring) can produce transient invalid states. The
   validator must report, not block.
4. **Stereochemistry.** 3D coordinates define chirality implicitly; stored tags can contradict them.
   Rule: CIP labels are derived by the engine from coordinates and never stored as truth.
5. **Touch precision on iPad.** Atoms are small targets; the viewer already uses a tap tolerance and
   an explicit additive-selection toggle. Editing gestures (phase 3) need on-screen tool modes rather
   than modifier keys.
6. **Performance for large structures.** Individual meshes are fine up to a few thousand atoms;
   beyond that switch to `InstancedMesh` (the scene builder is the single place to change).
7. **Packaging.** Windows installer via Tauri + Python sidecar (or the WASM engine to avoid shipping
   Python at all); iPad via PWA first, App Store wrapper (Capacitor) later. The web client must stay
   free of desktop-only APIs.
8. **Safety scope.** The retrosynthesis interface (phase 8) must be designed so a mock/reference
   implementation cannot emit operational procedures; keep it at the level of disconnection
   candidates and literature-style abstractions with review gates.

## 7. Roadmap

| Phase | Scope                                                                 | Status |
| ----- | --------------------------------------------------------------------- | ------ |
| 0     | Analysis, architecture, dependencies, risks                           | done   |
| 1     | Domain model, validation, formula, serialization, tests (TS + Python) | done   |
| 2     | 3D viewer: orbit/zoom/pan, picking, labels, bond orders, fit/reset    | done   |
| 3     | Editor: add/delete atom & bond, bond order, move atom, undo/redo, H fill | done   |
| 4     | ChemistryEngine interface, FastAPI service, RDKit WASM adapter, property panel (computed vs predicted), geometry optimisation | done |
| 5     | SMILES / MOL / SDF / JSON import & export with validation and round-trip tests | done |
| 6     | UX: sketch clean-up while drawing, import/export dialog, header actions, shortcuts overlay | done (phone drawer deferred) |
| 7     | AI layer interfaces (analysis / prediction / explanation), suggestions require confirmation | done |
| 8     | Retrosynthesis abstraction with a non-operational mock                 | done |
| 9     | Playwright end-to-end suite (editor, chemistry, import/export, assistant/retro, visual smoke) + GitHub Actions CI | done |
| 10    | PWA (manifest, service worker, icons), Tauri 2 desktop scaffold with Windows NSIS/MSI targets, packaging guide | done (desktop build not compiled here) |
| 11    | Phase behaviour (Lee–Kesler, Watson, P–T diagram, vacuum boiling point), solvent selection (Hansen parameters, CHEM21 classes, greener substitutes), binary mixtures with original-UNIFAC activity coefficients (distillation with predicted and literature azeotropes, cooling crystallisation) | done |
| 12 (3A) | Design engine data model: property catalogue with provenance, specification (hard/soft/structural), validation, evaluation, files; specification builder and live check | done |
| 12 (3B) | Candidate generators (derivatives by fragment substitution, library screen) with provenance, staged validation with reasons, design runs with export, margin-aware evaluation | done |
| 12 (3C) | Property evaluation through the engines and models with a canonical-SMILES cache, hard-constraint filtering with per-requirement reasons, filters and property columns | done |
| 12 (3D) | Multi-objective ranking: per-objective scores, Pareto fronts, weighted order, trade-off summary and scatter | done |
| 12 (3E–3F) | Comparison, iteration and reproducibility | planned |

## 8. Test inventory

| Suite                                   | Count | What it covers                                                        |
| --------------------------------------- | ----- | --------------------------------------------------------------------- |
| `packages/molecule-model` (vitest)      | 144   | periodic table, pure edit ops, conformers, validation rules, formula/weight, implicit H, JSON round trips and malformed input, vector maths, atom placement, MOL V2000 read/write, SDF and format detection, sketch clean-up (methane, ring closure, aromatic planarity, twisted double bond, 2D lifting, fixed atoms), perception (rings, cycles, functional groups), id-collision regression, transforms (mirror handedness, bond rotation dihedral, centre inversion), Joback group assignment and estimates (published acetone example, explicit vs implicit H, ring/aromatic and multi-atom groups, CH2 increment, refusal for uncovered atoms), Girolami density, Lee–Kesler acentric factor and vapour pressure against measured hexane/benzene, Watson ΔHvap, boiling point under vacuum, phase-diagram boundaries and classification, Hansen group assignment against Hansen's solvent values, symmetry rule, refusals, solvent ranking and greener substitutes, Raoult bubble points/T–x–y/Fenske/verdicts, UNIFAC activity coefficients against textbook examples and the thermo fixture, UNIFAC azeotrope and solubility, ideal solubility and crystallisation recovery |
| `packages/design-engine` (vitest)       | 18    | property catalogue integrity, specification validation (bounds, categories, weights, elements, SMARTS), requirement wording, constraint and structural evaluation with provenance, overall verdicts, specification file round trip and rejection, derivative generator (determinism, provenance, limits, element scope), library generator, staged validation with a fake engine (structural, duplicate, substructure, unparsable pattern), run files, margin-aware borderline evaluation, evaluation stage with a fake evaluator (one profile per structure, cache hits, verdicts and reasons, filters, evaluator errors kept as undecided), ranking (Pareto fronts, weights, targets, exclusions) |
| `packages/chem-core` (pytest)           | 12    | schema round trip, RDKit bridge round trip, aromatic handling, engine validation, computed properties, samples validity |
| `apps/web` (vitest)                     | 76    | scene builder ↔ graph synchronisation, picking, selection, measurements, editor commands, undo/redo history, RDKit WASM engine (real wasm in node) incl. SMILES round trip, remote engine with a fake server, analysis report + rule suggestions, suggestion validation/application (incl. injected operations), template and remote explainers, mock retrosynthesis and provenance policy, fragment library validity and attachment, stereo via real RDKit WASM (mirror flips all labels, single-centre inversion, E/Z flip, unassigned centre), ESOL breakdown and composite predictions (Joback/Girolami/acid-base client-side, QED server-side, water refused by Joback), rule sets, assistant estimates/observations/question answering, question forwarding to the server explainer, synthesis planner with real RDKit WASM (one-step ester, multi-step routes, aromatic and coupling templates, screener, precursor validity for every template, step balance/atom economy/depictions), workspace file round trip and pristine-tab logic, UNIFAC fragmentation on real RDKit WASM against the thermo fixture (72 molecules) and the 3D samples, structure tools (substructure, canonical SMILES) and candidate validation on real WASM, profile adapter, candidate evaluator on real WASM |
| `tests/e2e` (Playwright)                | 22    | built page in Chromium: open-ended building with ring closure and undo/redo, drag, RDKit properties and valence errors, SMILES/MOL/SDF/JSON import-export round trip, blocked invalid import, assistant suggestions/explanations, mock retro with reaction notes, visual smoke (pixel statistics + screenshot attachment), display styles and hidden hydrogens, stereo labels with mirror, building a new compound from fragments with estimates, property breakdowns with reasoning, assistant Q&A and the aspirin synthesis plan, fragment search and attach-from-SMILES, reaction schemes with depictions and balanced equations, precursor tabs, workspace export, phase tab (vacuum boiling point, conditions, diagram), materials tab (Hansen, solvent ranking, DCM replacement, assistant answers), refusal for uncovered structures, mixtures (azeotrope warning, verdicts, measured Tb override, crystallisation recovery), design workspace (specification builder, validation, live check, persistence, export; derivative generation with staged validation and evaluation, verdict filters, per-requirement checks, property columns, ranking with Pareto front and trade-off scatter, opening a candidate in a tab, borderline verdict) |
| `services/api` (pytest)                 | 14    | health, validation errors with atom ids, computed properties, 409 on unsanitisable input, 422 on bad schema, optimisation, SMILES round trip with stereo, garbage SMILES, AI endpoint disabled by default and with a fake provider (with and without a question), stereo and estimates, SVG depiction |

End-to-end checks of the built page (tap to add, attach, bond, undo/redo, inspector edits, delete,
drag) are run with headless Chromium during development; a committed Playwright suite is planned
for phase 9.
