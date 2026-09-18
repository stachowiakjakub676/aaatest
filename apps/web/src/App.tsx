import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE_MOLECULES, cleanupGeometry, createMolecule, validateMolecule } from "@molecular-cad/molecule-model";
import type { BondOrder, Molecule, Vec3 } from "@molecular-cad/molecule-model";
import { Viewport } from "./viewer/Viewport";
import type { ViewportHandle } from "./viewer/Viewport";
import type { PickData } from "./viewer/sceneBuilder";
import { Toolbox } from "./ui/Toolbox";
import { Inspector } from "./ui/Inspector";
import { StatusBar } from "./ui/StatusBar";
import { EMPTY_SELECTION, applyPick, isEmptySelection, pruneSelection } from "./state/selection";
import type { Selection } from "./state/selection";
import * as cmd from "./editor/commands";
import type { CommandResult } from "./editor/commands";
import { canRedo, canUndo, commit, commitFrom, createHistory, redo, redoLabel, replacePresent, undo, undoLabel } from "./editor/history";
import type { History } from "./editor/history";
import { MODES } from "./editor/modes";
import type { EditorMode } from "./editor/modes";
import { WasmRdkitEngine, browserRDKitLoader } from "./chemistry/wasmEngine";
import { RemoteRdkitEngine } from "./chemistry/remoteEngine";
import { useChemistry } from "./chemistry/useChemistry";
import { ChemistryPanel } from "./ui/ChemistryPanel";
import type { EngineChoice } from "./ui/ChemistryPanel";
import { ImportExportDialog } from "./ui/ImportExportDialog";
import type { DialogMode } from "./ui/ImportExportDialog";
import { ShortcutsOverlay } from "./ui/ShortcutsOverlay";
import { AssistantPanel } from "./ui/AssistantPanel";
import type { ExplainerChoice } from "./ui/AssistantPanel";
import { RetroPanel } from "./ui/RetroPanel";
import { RULE_ANALYSIS } from "./ai/analysis";
import { applySuggestion } from "./ai/suggestions";
import { RemoteExplanationService, TemplateExplanationService } from "./ai/explanation";
import type { Explanation, Suggestion } from "./ai/types";
import { MockRetrosynthesisService } from "./retro/mockRetrosynthesis";
import type { DisconnectionCandidate, TargetAnalysis } from "./retro/types";

type RightTab = "inspect" | "chemistry" | "assistant" | "retro";
const TABS: Array<[RightTab, string]> = [
  ["inspect", "Inspect"],
  ["chemistry", "Chemistry"],
  ["assistant", "Assistant"],
  ["retro", "Retro"],
];
const templateExplainer = new TemplateExplanationService();

/** Above this size the automatic tidy after each edit is skipped (use Tidy explicitly). */
const AUTO_TIDY_MAX_ATOMS = 300;
const AUTO_TIDY_ITERATIONS = 250;
const TIDY_ITERATIONS = 800;

const wasmEngine = new WasmRdkitEngine(browserRDKitLoader());
const DEFAULT_SERVER_URL = "http://localhost:8000";
function readSetting(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeSetting(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode etc. */
  }
}

let newCounter = 0;
function blankMolecule(): Molecule {
  newCounter += 1;
  return createMolecule({ id: `untitled-${newCounter}`, name: "Untitled", metadata: { source: "editor" } });
}

export function App() {
  const [history, setHistory] = useState<History>(() => createHistory(blankMolecule()));
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [mode, setMode] = useState<EditorMode>("add");
  const [element, setElement] = useState("C");
  const [bondOrder, setBondOrder] = useState<BondOrder>("single");
  const [pendingAtomId, setPendingAtomId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [additiveMode, setAdditiveMode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoTidy, setAutoTidy] = useState(() => readSetting("mcad.autoTidy", "1") !== "0");
  const [dialog, setDialog] = useState<DialogMode | "help" | null>(null);
  const [tab, setTab] = useState<RightTab>("inspect");
  // Phase 7: assistant state. Phase 8: retrosynthesis state.
  const [explainer, setExplainer] = useState<ExplainerChoice>("template");
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [retroAnalysis, setRetroAnalysis] = useState<TargetAnalysis | null>(null);
  const [retroCandidates, setRetroCandidates] = useState<DisconnectionCandidate[]>([]);
  const [retroWorking, setRetroWorking] = useState(false);
  const [retroError, setRetroError] = useState<string | null>(null);
  const [retroSelected, setRetroSelected] = useState<string | null>(null);
  const viewportRef = useRef<ViewportHandle>(null);
  const dragStartRef = useRef<Molecule | null>(null);

  // Chemistry engine: in-browser RDKit by default; the server engine adds geometry optimisation.
  const [engineChoice, setEngineChoice] = useState<EngineChoice>(() => (readSetting("mcad.engine", "wasm") === "server" ? "server" : "wasm"));
  const [serverUrl, setServerUrl] = useState(() => readSetting("mcad.serverUrl", DEFAULT_SERVER_URL));
  const engine = useMemo(() => (engineChoice === "server" ? new RemoteRdkitEngine(serverUrl) : wasmEngine), [engineChoice, serverUrl]);
  const [optimizing, setOptimizing] = useState(false);

  const molecule = history.present;
  // The graph is the source of truth: validation and derived data come from it, never from the scene.
  const validation = useMemo(() => validateMolecule(molecule), [molecule]);
  const chemistry = useChemistry(engine, molecule);
  const report = useMemo(
    () => RULE_ANALYSIS.analyze({ molecule, validation, engineValidation: chemistry.state.validation, properties: chemistry.state.properties }),
    [molecule, validation, chemistry.state.validation, chemistry.state.properties],
  );
  const retroService = useMemo(() => new MockRetrosynthesisService(chemistry.state.status === "ready" ? engine : null), [engine, chemistry.state.status]);

  // Explanations and retro results describe a specific molecule; drop them when it changes.
  useEffect(() => {
    setExplanation(null);
    setExplainError(null);
    setRetroAnalysis(null);
    setRetroCandidates([]);
    setRetroSelected(null);
  }, [molecule]);

  const explain = useCallback(async () => {
    setExplaining(true);
    setExplainError(null);
    try {
      const svc = explainer === "remote" ? new RemoteExplanationService(serverUrl, () => molecule) : templateExplainer;
      setExplanation(await svc.explain(report));
    } catch (e) {
      setExplanation(null);
      setExplainError(e instanceof Error ? e.message : String(e));
    } finally {
      setExplaining(false);
    }
  }, [explainer, serverUrl, molecule, report]);

  const runRetro = useCallback(async () => {
    setRetroWorking(true);
    setRetroError(null);
    try {
      const analysis = await retroService.analyzeTarget(molecule);
      const candidates = await retroService.rankCandidates(await retroService.generateCandidates(molecule, analysis));
      setRetroAnalysis(analysis);
      setRetroCandidates(candidates);
    } catch (e) {
      setRetroError(e instanceof Error ? e.message : String(e));
    } finally {
      setRetroWorking(false);
    }
  }, [retroService, molecule]);

  useEffect(() => {
    setSelection((sel) => pruneSelection(sel, new Set(molecule.atoms.map((a) => a.id)), new Set(molecule.bonds.map((b) => b.id))));
    if (pendingAtomId && !molecule.atoms.some((a) => a.id === pendingAtomId)) setPendingAtomId(null);
  }, [molecule, pendingAtomId]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  /**
   * Run an editor command against the current graph and record it in history. Commands that
   * change bonding are followed by the sketch clean-up (same undo step) when auto-tidy is on,
   * so the structure settles into a sensible shape as it is built.
   */
  const run = useCallback(
    (fn: (mol: Molecule) => CommandResult) => {
      setHistory((h) => {
        try {
          const r = fn(h.present);
          if (r.selection) setSelection(r.selection);
          let next = r.molecule;
          if (r.tidy && autoTidy && next !== h.present && next.atoms.length <= AUTO_TIDY_MAX_ATOMS) {
            next = cleanupGeometry(next, { maxIterations: AUTO_TIDY_ITERATIONS }).molecule;
          }
          return commit(h, next, r.label);
        } catch (e) {
          setNotice(e instanceof Error ? e.message : String(e));
          return h;
        }
      });
    },
    [autoTidy],
  );

  /** Explicit clean-up of the whole sketch (drawing aid, not a physical force field). */
  const tidyNow = useCallback(() => {
    setHistory((h) => {
      if (h.present.atoms.length < 2) return h;
      const r = cleanupGeometry(h.present, { maxIterations: TIDY_ITERATIONS });
      setNotice(r.converged ? "Tidy: geometry relaxed" : "Tidy: stopped before convergence, run again for more");
      return commit(h, r.molecule, "Tidy geometry");
    });
  }, []);

  const loadMolecule = useCallback((mol: Molecule, label: string) => {
    setHistory(createHistory(mol, label));
    setSelection(EMPTY_SELECTION);
    setPendingAtomId(null);
  }, []);

  const changeMode = useCallback((m: EditorMode) => {
    setMode(m);
    setPendingAtomId(null);
  }, []);

  // --- viewport interaction -------------------------------------------------
  const onTap = useCallback(
    (pick: PickData | null, worldPoint: Vec3, additive: boolean) => {
      switch (mode) {
        case "select":
        case "move":
          setSelection((sel) => applyPick(sel, pick, additive));
          break;
        case "add":
          if (pick?.kind === "atom") run((m) => cmd.addBondedAtom(m, pick.id, element, bondOrder));
          else if (pick?.kind === "bond") setSelection({ atoms: [], bonds: [pick.id] });
          else run((m) => cmd.addFreeAtom(m, element, worldPoint));
          break;
        case "bond":
          if (pick?.kind === "atom") {
            if (pendingAtomId && pendingAtomId !== pick.id) {
              const first = pendingAtomId;
              run((m) => cmd.bondAtoms(m, first, pick.id, bondOrder));
              setPendingAtomId(null);
            } else {
              setPendingAtomId(pick.id);
            }
          } else if (pick?.kind === "bond") {
            run((m) => cmd.changeBondOrder(m, pick.id, bondOrder));
            setSelection({ atoms: [], bonds: [pick.id] });
          } else {
            setPendingAtomId(null);
          }
          break;
        case "delete":
          if (pick?.kind === "atom") run((m) => cmd.deleteAtom(m, pick.id));
          else if (pick?.kind === "bond") run((m) => cmd.deleteBond(m, pick.id));
          break;
      }
    },
    [mode, element, bondOrder, pendingAtomId, run],
  );

  const onDragAtom = useCallback((atomId: string, position: Vec3, phase: "move" | "end") => {
    setHistory((h) => {
      if (!dragStartRef.current) dragStartRef.current = h.present;
      let next: History;
      try {
        next = replacePresent(h, cmd.moveAtomTo(h.present, atomId, position).molecule);
      } catch {
        return h;
      }
      if (phase === "end") {
        const before = dragStartRef.current;
        dragStartRef.current = null;
        return commitFrom(next, before, `Move ${atomId}`);
      }
      return next;
    });
  }, []);

  // --- toolbox / inspector actions -------------------------------------------
  const doUndo = useCallback(() => {
    setHistory((h) => undo(h));
    setPendingAtomId(null);
  }, []);
  const doRedo = useCallback(() => {
    setHistory((h) => redo(h));
    setPendingAtomId(null);
  }, []);
  const deleteSelected = useCallback(() => {
    if (isEmptySelection(selection)) return;
    run((m) => cmd.deleteSelection(m, selection));
  }, [selection, run]);
  const addHydrogens = useCallback(() => {
    const target = selection.atoms.length === 1 ? selection.atoms[0] : undefined;
    run((m) => cmd.addHydrogens(m, target));
  }, [selection, run]);

  /** Geometry optimisation is an explicit, undoable action; the engine never moves atoms on its own. */
  const optimizeGeometry = useCallback(
    async (opts: { embed: boolean }) => {
      setOptimizing(true);
      try {
        const result = await chemistry.optimize(opts);
        setHistory((h) => (h.present === molecule ? commit(h, result.molecule, `${opts.embed ? "Re-embed" : "Optimise"} geometry (${result.forceField})`) : h));
        setNotice(`${result.forceField}: energy ${result.energy.toFixed(2)} ${result.energyUnit}${result.converged ? "" : " (not converged, run again)"}`);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : String(e));
      } finally {
        setOptimizing(false);
      }
    },
    [chemistry, molecule],
  );

  // Keyboard shortcuts (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setDialog("import");
        return;
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setDialog("export");
        return;
      }
      if (dialog) return; // dialogs handle their own keys
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        doRedo();
        return;
      }
      if (meta) return;
      switch (e.key) {
        case "Delete":
        case "Backspace":
          e.preventDefault();
          deleteSelected();
          return;
        case "Escape":
          setSelection(EMPTY_SELECTION);
          setPendingAtomId(null);
          return;
      }
      const k = e.key.toUpperCase();
      const modeHit = MODES.find((m) => m.key === k);
      if (modeHit) {
        changeMode(modeHit.id);
        return;
      }
      if (k === "F") viewportRef.current?.fitToView();
      else if (k === "R") viewportRef.current?.resetCamera();
      else if (k === "L") setShowLabels((v) => !v);
      else if (k === "T") tidyNow();
      else if (e.key === "?") setDialog("help");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doUndo, doRedo, deleteSelected, changeMode, tidyNow, dialog]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Molecular CAD</span>
          <span className="brand-phase">prototype · phase 8</span>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-small" onClick={() => setDialog("import")} title="Import MCAD JSON, MOL, SDF or SMILES (Ctrl+O)">
            Import
          </button>
          <button type="button" className="btn btn-small" onClick={() => setDialog("export")} title="Export as MOL, SDF, JSON or SMILES (Ctrl+S)" disabled={molecule.atoms.length === 0}>
            Export
          </button>
          <button type="button" className="btn btn-small" onClick={tidyNow} title="Relax the sketch geometry (T)" disabled={molecule.atoms.length < 2}>
            Tidy
          </button>
          <button type="button" className="btn btn-small" onClick={() => setDialog("help")} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
            ?
          </button>
        </div>
        <div className="header-molecule">
          <span className="muted">Molecule</span> <strong>{molecule.name ?? molecule.id}</strong>
          {canUndo(history) && <span className="muted"> · edited</span>}
        </div>
      </header>

      <Toolbox
        mode={mode}
        onMode={changeMode}
        element={element}
        onElement={setElement}
        bondOrder={bondOrder}
        onBondOrder={setBondOrder}
        canUndo={canUndo(history)}
        canRedo={canRedo(history)}
        undoLabel={undoLabel(history)}
        redoLabel={redoLabel(history)}
        onUndo={doUndo}
        onRedo={doRedo}
        onDeleteSelection={deleteSelected}
        hasSelection={!isEmptySelection(selection)}
        onAddHydrogens={addHydrogens}
        onRemoveHydrogens={() => run((m) => cmd.removeHydrogens(m))}
        onNewMolecule={() => loadMolecule(blankMolecule(), "New molecule")}
        samples={SAMPLE_MOLECULES}
        onLoadSample={(id) => {
          const s = SAMPLE_MOLECULES.find((m) => m.id === id);
          if (s) loadMolecule(s, `Loaded ${s.name ?? s.id}`);
        }}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        additiveMode={additiveMode}
        onToggleAdditive={() => setAdditiveMode((v) => !v)}
        onFit={() => viewportRef.current?.fitToView()}
        onReset={() => viewportRef.current?.resetCamera()}
        autoTidy={autoTidy}
        onToggleAutoTidy={() => {
          setAutoTidy((v) => {
            writeSetting("mcad.autoTidy", v ? "0" : "1");
            return !v;
          });
        }}
        onTidy={tidyNow}
      />

      <main className="viewport-area">
        <Viewport
          ref={viewportRef}
          molecule={molecule}
          selection={selection}
          showLabels={showLabels}
          mode={mode}
          pendingAtomId={pendingAtomId}
          additiveMode={additiveMode}
          onTap={onTap}
          onDragAtom={onDragAtom}
        />
        {molecule.atoms.length === 0 && (
          <div className="viewport-empty">
            <strong>Empty canvas.</strong>
            <span>
              {mode === "add" ? `Tap anywhere to place a ${element} atom, then tap atoms to grow the structure.` : "Choose the Add atom tool and tap anywhere to start."}
            </span>
          </div>
        )}
        <div className="viewport-hint" aria-hidden="true">
          drag · rotate &nbsp;|&nbsp; wheel / pinch · zoom &nbsp;|&nbsp; right-drag / two-finger drag · pan
        </div>
      </main>

      <aside className="panel inspector" aria-label="Inspector">
        <nav className="tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} id={`tab-${id}`} type="button" role="tab" aria-selected={tab === id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        {tab === "inspect" && (
          <Inspector
        molecule={molecule}
        selection={selection}
        validation={validation}
        onSetElement={(id, el) => run((m) => cmd.setElement(m, id, el))}
        onSetCharge={(id, c) => run((m) => cmd.setFormalCharge(m, id, c))}
        onDeleteAtom={(id) => run((m) => cmd.deleteAtom(m, id))}
        onAddHydrogens={(id) => run((m) => cmd.addHydrogens(m, id))}
        onSetBondOrder={(id, o) => run((m) => cmd.changeBondOrder(m, id, o))}
        onDeleteBond={(id) => run((m) => cmd.deleteBond(m, id))}
          />
        )}
        {tab === "chemistry" && (
          <div className="panel-content">
        <ChemistryPanel
          engine={engine}
          state={chemistry.state}
          choice={engineChoice}
          onChoice={(c) => {
            setEngineChoice(c);
            writeSetting("mcad.engine", c);
          }}
          serverUrl={serverUrl}
          onServerUrl={(url) => {
            const next = url || DEFAULT_SERVER_URL;
            setServerUrl(next);
            writeSetting("mcad.serverUrl", next);
          }}
          onOptimize={(o) => void optimizeGeometry(o)}
          optimizing={optimizing}
          hasAtoms={molecule.atoms.length > 0}
        />
          </div>
        )}
        {tab === "assistant" && (
          <AssistantPanel
            report={report}
            explainer={explainer}
            onExplainer={(c) => {
              setExplainer(c);
              setExplanation(null);
              setExplainError(null);
            }}
            explanation={explanation}
            explaining={explaining}
            error={explainError}
            onExplain={() => void explain()}
            onApplySuggestion={(s: Suggestion) => run((m) => applySuggestion(m, s))}
            serverAiEnabled={null}
          />
        )}
        {tab === "retro" && (
          <RetroPanel
            serviceLabel={retroService.label}
            disclaimer={retroService.disclaimer}
            analysis={retroAnalysis}
            candidates={retroCandidates}
            working={retroWorking}
            error={retroError}
            selectedId={retroSelected}
            hasAtoms={molecule.atoms.length > 0}
            onAnalyze={() => void runRetro()}
            onSelect={(c) => {
              setRetroSelected(c?.id ?? null);
              setSelection(c ? { atoms: [], bonds: [c.bondId] } : EMPTY_SELECTION);
            }}
          />
        )}
      </aside>

      <StatusBar validation={validation} selection={selection} mode={mode} element={element} pendingAtomId={pendingAtomId} lastAction={history.lastLabel} notice={notice} />

      {(dialog === "import" || dialog === "export") && (
        <ImportExportDialog
          mode={dialog}
          molecule={molecule}
          engine={engine}
          engineReady={chemistry.state.status === "ready"}
          onImport={(mol, label) => {
            loadMolecule(mol, label);
            setMode("select");
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "help" && <ShortcutsOverlay onClose={() => setDialog(null)} />}
    </div>
  );
}
