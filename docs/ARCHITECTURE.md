# Molecular CAD — architecture and phase 0 analysis

_Last updated after phase 2 (3D viewer). Keep this file in sync with the code._

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
| planned: fastapi, uvicorn | —          | API (phase 4)                          | actively maintained                                 |
| planned: @rdkit/rdkit     | 2026.3     | RDKit WASM for offline iPad chemistry  | released by the RDKit project alongside RDKit       |
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
| 3     | Editor: add/delete atom & bond, bond order, move atom, undo/redo      | next   |
| 4     | ChemistryEngine interface, FastAPI service, RDKit WASM adapter, property panel (computed vs predicted) | |
| 5     | SMILES / MOL / SDF import & export with validation and round-trip tests | |
| 6     | UX polish: tool modes, touch drawer, keyboard map, change log          | |
| 7     | AI layer interfaces (analysis / prediction / explanation), suggestions require confirmation | |
| 8     | Retrosynthesis abstraction with a non-operational mock                 | |
| 9     | Integration & visual tests, CI                                         | |
| 10    | Tauri desktop packaging (Windows installer), PWA for iPad              | |

## 8. Test inventory

| Suite                                   | Count | What it covers                                                        |
| --------------------------------------- | ----- | --------------------------------------------------------------------- |
| `packages/molecule-model` (vitest)      | 67    | periodic table, pure edit ops, conformers, validation rules, formula/weight, implicit H, JSON round trips and malformed input |
| `packages/chem-core` (pytest)           | 12    | schema round trip, RDKit bridge round trip, aromatic handling, engine validation, computed properties, samples validity |
| `apps/web` (vitest)                     | 12    | scene builder ↔ graph synchronisation, picking data, selection state, bounding sphere, measurements |
