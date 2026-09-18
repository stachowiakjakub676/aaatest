# Molecular CAD — architecture and phase 0 analysis

_Last updated after phase 4 (chemistry engine). Keep this file in sync with the code._

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
| `/apps/desktop`       | not created yet                                         | Phase 10. Plan: Tauri shell around `apps/web` for Windows/macOS, bundling a Python sidecar for chem-core. |
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
| 5     | SMILES / MOL / SDF import & export with validation and round-trip tests (MOL V2000 reader/writer already exists) | next |
| 6     | UX polish: tool modes, touch drawer, keyboard map, change log          | |
| 7     | AI layer interfaces (analysis / prediction / explanation), suggestions require confirmation | |
| 8     | Retrosynthesis abstraction with a non-operational mock                 | |
| 9     | Integration & visual tests, CI                                         | |
| 10    | Tauri desktop packaging (Windows installer), PWA for iPad              | |

## 8. Test inventory

| Suite                                   | Count | What it covers                                                        |
| --------------------------------------- | ----- | --------------------------------------------------------------------- |
| `packages/molecule-model` (vitest)      | 86    | periodic table, pure edit ops, conformers, validation rules, formula/weight, implicit H, JSON round trips and malformed input, vector maths, atom placement, MOL V2000 read/write |
| `packages/chem-core` (pytest)           | 12    | schema round trip, RDKit bridge round trip, aromatic handling, engine validation, computed properties, samples validity |
| `apps/web` (vitest)                     | 31    | scene builder ↔ graph synchronisation, picking, selection, measurements, editor commands, undo/redo history, RDKit WASM engine (real wasm in node), remote engine with a fake server |
| `services/api` (pytest)                 | 8     | health, validation errors with atom ids, computed properties, 409 on unsanitisable input, 422 on bad schema, optimisation bends a collinear sketch, keeps atom order |

End-to-end checks of the built page (tap to add, attach, bond, undo/redo, inspector edits, delete,
drag) are run with headless Chromium during development; a committed Playwright suite is planned
for phase 9.
