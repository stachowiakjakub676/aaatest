import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE_MOLECULES, cleanupGeometry, validateMolecule } from "@molecular-cad/molecule-model";
import type { BondOrder, FragmentTemplate, Molecule, Vec3 } from "@molecular-cad/molecule-model";
import { STYLES } from "./viewer/sceneBuilder";
import type { SceneStyle } from "./viewer/sceneBuilder";
import { Viewport } from "./viewer/Viewport";
import type { ViewportHandle } from "./viewer/Viewport";
import type { PickData } from "./viewer/sceneBuilder";
import { Toolbox } from "./ui/Toolbox";
import { Logo } from "./ui/Logo";
import { Inspector } from "./ui/Inspector";
import { StatusBar } from "./ui/StatusBar";
import { EMPTY_SELECTION, applyPick, isEmptySelection, pruneSelection } from "./state/selection";
import type { Selection } from "./state/selection";
import * as cmd from "./editor/commands";
import type { CommandResult } from "./editor/commands";
import { canRedo, canUndo, commit, commitFrom, createHistory, redo, redoLabel, replacePresent, undo, undoLabel } from "./editor/history";
import type { History } from "./editor/history";
import { blankDoc, blankMolecule, docsFromMolecules, isPristine, newDocId, restoreWorkspaceSnapshot, saveWorkspaceSnapshot } from "./state/workspace";
import type { Doc } from "./state/workspace";
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
import type { ExplainerChoice, QaEntry } from "./ui/AssistantPanel";
import { RetroPanel } from "./ui/RetroPanel";
import { PhasePanel } from "./ui/PhasePanel";
import { MaterialsPanel } from "./ui/MaterialsPanel";
import { RULE_ANALYSIS } from "./ai/analysis";
import { applySuggestion } from "./ai/suggestions";
import { RemoteExplanationService, TemplateExplanationService } from "./ai/explanation";
import type { Explanation, Suggestion } from "./ai/types";
import { MockRetrosynthesisService } from "./retro/mockRetrosynthesis";
import type { DisconnectionCandidate, ReactionRecord, TargetAnalysis } from "./retro/types";
import { PROVENANCE_POLICY, applySafetyDecision } from "./retro/types";
import { RuleBasedSynthesisPlanner, describeRoute } from "./retro/synthesis";
import type { Precursor, SynthesisPlan } from "./retro/synthesis";

type RightTab = "inspect" | "chemistry" | "phase" | "materials" | "assistant" | "retro";
const TABS: Array<[RightTab, string]> = [
  ["inspect", "Inspect"],
  ["chemistry", "Chemistry"],
  ["phase", "Phase"],
  ["materials", "Materials"],
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

const AUTOSAVE_MS = 800;

export function App() {
  // Workspace: several molecule tabs, each with its own undo history. Restored from the last session.
  const [workspace, setWorkspace] = useState<{ docs: Doc[]; activeId: string }>(() => {
    const restored = restoreWorkspaceSnapshot();
    if (restored) return restored;
    const doc = blankDoc();
    return { docs: [doc], activeId: doc.id };
  });
  const { docs, activeId } = workspace;
  const history = (docs.find((d) => d.id === activeId) ?? docs[0]!).history;
  const setHistory = useCallback(
    (update: History | ((h: History) => History)) => {
      setWorkspace((w) => ({ ...w, docs: w.docs.map((d) => (d.id === w.activeId ? { ...d, history: typeof update === "function" ? update(d.history) : update } : d)) }));
    },
    [],
  );
  useEffect(() => {
    const t = window.setTimeout(() => saveWorkspaceSnapshot(docs, activeId), AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [docs, activeId]);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [mode, setMode] = useState<EditorMode>("add");
  const [element, setElement] = useState("C");
  const [bondOrder, setBondOrder] = useState<BondOrder>("single");
  const [pendingAtomId, setPendingAtomId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [styleId, setStyleId] = useState<SceneStyle["id"]>(() => (["ball-and-stick", "sticks", "spacefill"].includes(readSetting("mcad.style", "ball-and-stick")) ? (readSetting("mcad.style", "ball-and-stick") as SceneStyle["id"]) : "ball-and-stick"));
  const [hideHydrogens, setHideHydrogens] = useState(false);
  const sceneStyle = useMemo<SceneStyle>(() => ({ ...STYLES[styleId], hideHydrogens }), [styleId, hideHydrogens]);
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
  const [reactionNotes, setReactionNotes] = useState<Record<string, ReactionRecord>>({});
  const [retroExported, setRetroExported] = useState(false);
  const [plan, setPlan] = useState<SynthesisPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [thread, setThread] = useState<QaEntry[]>([]);
  const [asking, setAsking] = useState(false);
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
    () =>
      RULE_ANALYSIS.analyze({
        molecule,
        validation,
        engineValidation: chemistry.state.validation,
        properties: chemistry.state.properties,
        stereo: chemistry.state.stereo,
        predictions: chemistry.state.predictions,
        synthesis: plan ? (plan.routes[0] ? describeRoute(plan.routes[0]) : []) : null,
      }),
    [molecule, validation, chemistry.state.validation, chemistry.state.properties, chemistry.state.stereo, chemistry.state.predictions, plan],
  );
  const stereoLabels = useMemo(() => {
    const st = chemistry.state.stereo;
    if (!st) return undefined;
    const atoms: Record<string, string> = {};
    const bonds: Record<string, string> = {};
    for (const a of st.atoms) atoms[a.atomId] = a.label;
    for (const b of st.bonds) bonds[b.bondId] = b.label;
    return { atoms, bonds };
  }, [chemistry.state.stereo]);
  const retroService = useMemo(() => new MockRetrosynthesisService(chemistry.state.status === "ready" ? engine : null), [engine, chemistry.state.status]);
  const planner = useMemo(() => {
    const ready = chemistry.state.status === "ready";
    return new RuleBasedSynthesisPlanner(ready ? (m: Molecule) => engine.toSmiles(m) : null, undefined, ready && engine.capabilities.depict ? (m: Molecule) => engine.depict(m, { width: 220, height: 140 }) : null);
  }, [engine, chemistry.state.status]);

  // Explanations and retro results describe a specific molecule; drop them when it changes.
  useEffect(() => {
    setExplanation(null);
    setExplainError(null);
    setRetroAnalysis(null);
    setRetroCandidates([]);
    setRetroSelected(null);
    setReactionNotes({});
    setRetroExported(false);
    setPlan(null);
    setThread([]);
  }, [molecule]);

  // Candidates as shown: user notes attached, then the safety policy applied to every record.
  const shownCandidates = useMemo(() => {
    if (!retroAnalysis) return [];
    return retroCandidates.map((c) => {
      const note = reactionNotes[c.id];
      const withNote = note ? { ...c, reaction: note } : c;
      return applySafetyDecision(withNote, PROVENANCE_POLICY.screen(withNote, retroAnalysis.screening));
    });
  }, [retroCandidates, reactionNotes, retroAnalysis]);

  const exportRetroJson = useCallback(async () => {
    const payload = { kind: "retrosynthesis-analysis", target: { id: molecule.id, name: molecule.name ?? molecule.id }, analysis: retroAnalysis, candidates: shownCandidates };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setRetroExported(true);
    } catch {
      setNotice("Clipboard not available; use Export for the structure and copy from the panel.");
    }
  }, [molecule, retroAnalysis, shownCandidates]);

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

  /** Ask one question; answered offline from the report or by the server explainer. */
  const ask = useCallback(
    async (question: string) => {
      setAsking(true);
      try {
        const svc = explainer === "remote" ? new RemoteExplanationService(serverUrl, () => molecule) : templateExplainer;
        const e = await svc.explain(report, question);
        setThread((t) => [...t, { question, answer: e.text, source: e.source }]);
      } catch (err) {
        setThread((t) => [...t, { question, answer: err instanceof Error ? err.message : String(err), source: "error" }]);
      } finally {
        setAsking(false);
      }
    },
    [explainer, serverUrl, molecule, report],
  );

  const runPlan = useCallback(async () => {
    setPlanning(true);
    try {
      setPlan(await planner.plan(molecule));
    } catch (e) {
      setRetroError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanning(false);
    }
  }, [planner, molecule]);

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

  /** Open a molecule in a tab: reuses the active tab when it is untouched, otherwise adds one (nothing is lost). */
  const loadMolecule = useCallback((mol: Molecule, label: string) => {
    setWorkspace((w) => {
      const active = w.docs.find((d) => d.id === w.activeId);
      if (active && isPristine(active)) return { ...w, docs: w.docs.map((d) => (d.id === w.activeId ? { ...d, history: createHistory(mol, label) } : d)) };
      const doc: Doc = { id: newDocId(), history: createHistory(mol, label) };
      return { docs: [...w.docs, doc], activeId: doc.id };
    });
    setSelection(EMPTY_SELECTION);
    setPendingAtomId(null);
  }, []);

  const activateDoc = useCallback((id: string) => {
    setWorkspace((w) => (w.docs.some((d) => d.id === id) ? { ...w, activeId: id } : w));
    setSelection(EMPTY_SELECTION);
    setPendingAtomId(null);
  }, []);

  const closeDoc = useCallback((id: string) => {
    setWorkspace((w) => {
      const idx = w.docs.findIndex((d) => d.id === id);
      if (idx < 0) return w;
      const rest = w.docs.filter((d) => d.id !== id);
      if (rest.length === 0) {
        const doc = blankDoc();
        return { docs: [doc], activeId: doc.id };
      }
      const activeId = w.activeId === id ? rest[Math.min(idx, rest.length - 1)]!.id : w.activeId;
      return { docs: rest, activeId };
    });
    setSelection(EMPTY_SELECTION);
    setPendingAtomId(null);
  }, []);

  const newDoc = useCallback(() => {
    const doc = blankDoc();
    setWorkspace((w) => ({ docs: [...w.docs, doc], activeId: doc.id }));
    setSelection(EMPTY_SELECTION);
    setPendingAtomId(null);
  }, []);

  const importWorkspace = useCallback((molecules: Molecule[], activeIndex: number) => {
    const added = docsFromMolecules(molecules);
    if (added.length === 0) return;
    setWorkspace((w) => {
      const kept = w.docs.filter((d) => !isPristine(d));
      const active = added[Math.min(Math.max(0, activeIndex), added.length - 1)]!;
      return { docs: [...kept, ...added], activeId: active.id };
    });
    setSelection(EMPTY_SELECTION);
    setPendingAtomId(null);
  }, []);

  const openPrecursor = useCallback(
    (p: Precursor) => {
      const tidy = cleanupGeometry(p.molecule, { maxIterations: TIDY_ITERATIONS }).molecule;
      // Always a new tab: the target you were working on stays open.
      const doc: Doc = { id: newDocId(), history: createHistory({ ...tidy, name: p.name ?? p.smiles ?? p.formula }, `Opened precursor ${p.name ?? p.smiles ?? p.formula}`) };
      setWorkspace((w) => ({ docs: [...w.docs, doc], activeId: doc.id }));
      setSelection(EMPTY_SELECTION);
      setPendingAtomId(null);
      setMode("select");
      setTab("chemistry");
    },
    [loadMolecule],
  );

  /** Any SMILES becomes a fragment: first atom = attachment point (must carry a hydrogen). */
  const attachSmiles = useCallback(
    async (smiles: string): Promise<string | null> => {
      const anchor = selection.atoms[0];
      if (!anchor) return "Select one atom first.";
      try {
        const r = await engine.fromSmiles(smiles, { addHydrogens: true, name: smiles });
        const first = r.molecule.atoms.find((a) => a.element !== "H");
        if (!first) return "The SMILES has no heavy atom.";
        const hasH = r.molecule.bonds.some((b) => (b.atomA === first.id || b.atomB === first.id) && r.molecule.atoms.find((a) => a.id === (b.atomA === first.id ? b.atomB : b.atomA))?.element === "H");
        if (!hasH) return `The first atom (${first.element}) has no hydrogen to replace; write the SMILES starting from an atom that has one.`;
        const template: FragmentTemplate = { id: `smiles-${Date.now()}`, name: smiles, category: "group", smiles, attachAtomId: first.id, molecule: r.molecule };
        run((m) => cmd.attachFragment(m, anchor, template));
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    },
    [engine, selection, run],
  );

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
          <Logo size={22} />
          <span className="brand-name">Clapeyron</span>
          <span className="brand-phase">molecular design · prototype</span>
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
          <span className="muted">{docs.length} molecule{docs.length === 1 ? "" : "s"} · </span>
          <strong>{molecule.name ?? molecule.id}</strong>
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
        onNewMolecule={newDoc}
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
        styleId={styleId}
        onStyle={(id) => {
          setStyleId(id);
          writeSetting("mcad.style", id);
        }}
        hideHydrogens={hideHydrogens}
        onToggleHideHydrogens={() => setHideHydrogens((v) => !v)}
        onMirror={() => run((m) => cmd.mirror(m))}
        selectedAtomId={selection.atoms.length === 1 && selection.bonds.length === 0 ? selection.atoms[0]! : null}
        onAttachFragment={(fragment: FragmentTemplate) => {
          const anchor = selection.atoms[0];
          if (!anchor) return;
          run((m) => cmd.attachFragment(m, anchor, fragment));
        }}
        onAttachSmiles={attachSmiles}
        smilesReady={chemistry.state.status === "ready" && engine.capabilities.smiles}
      />

      <main className="viewport-area">
        <div className="doc-tabs" role="tablist" aria-label="Open molecules">
          {docs.map((d) => {
            const m = d.history.present;
            const edited = canUndo(d.history);
            return (
              <div key={d.id} role="tab" aria-selected={d.id === activeId} tabIndex={0} className={`doc-tab ${d.id === activeId ? "active" : ""}`} onClick={() => activateDoc(d.id)} onKeyDown={(e) => e.key === "Enter" && activateDoc(d.id)} title={`${m.name ?? m.id} · ${m.atoms.length} atoms${edited ? " · edited" : ""}`}>
                <span className="doc-tab-name">{m.name ?? m.id}</span>
                {edited && <span className="doc-tab-dot" aria-label="edited">•</span>}
                <span
                  className="doc-tab-close"
                  role="button"
                  aria-label={`Close ${m.name ?? m.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDoc(d.id);
                  }}
                >
                  ×
                </span>
              </div>
            );
          })}
          <button type="button" className="doc-tab doc-tab-new" onClick={newDoc} title="New empty molecule tab" aria-label="New molecule tab">
            +
          </button>
        </div>
        <div className="viewport-host">
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
          style={sceneStyle}
          stereoLabels={stereoLabels}
        />
        </div>
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
        stereo={chemistry.state.stereo}
        onInvertCentre={(id) => run((m) => cmd.invertStereocentre(m, id))}
        onFlipBond={(id) => run((m) => cmd.flipDoubleBond(m, id))}
        onRotateBond={(id, deg) => run((m) => cmd.rotateBond(m, id, deg))}
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
        {tab === "phase" && (
          <div className="panel-content">
            <PhasePanel molecule={molecule} molarMass={chemistry.state.properties?.molecularWeight} engine={engine} fragmenter={wasmEngine} canonicalSmiles={chemistry.state.properties?.canonicalSmiles ?? null} />
          </div>
        )}
        {tab === "materials" && (
          <div className="panel-content">
            <MaterialsPanel molecule={molecule} molarMass={chemistry.state.properties?.molecularWeight} />
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
            thread={thread}
            onAsk={(q) => void ask(q)}
            asking={asking}
          />
        )}
        {tab === "retro" && (
          <RetroPanel
            serviceLabel={retroService.label}
            disclaimer={retroService.disclaimer}
            analysis={retroAnalysis}
            candidates={shownCandidates}
            working={retroWorking}
            error={retroError}
            selectedId={retroSelected}
            hasAtoms={molecule.atoms.length > 0}
            onAnalyze={() => void runRetro()}
            onSelect={(c) => {
              setRetroSelected(c?.id ?? null);
              setSelection(c ? { atoms: [], bonds: [c.bondId] } : EMPTY_SELECTION);
            }}
            onSaveReaction={(id, record) => {
              setReactionNotes((n) => ({ ...n, [id]: record }));
              setRetroExported(false);
            }}
            onExportJson={() => void exportRetroJson()}
            exported={retroExported}
            plan={plan}
            planning={planning}
            plannerLabel={planner.label}
            onPlan={() => void runPlan()}
            onOpenPrecursor={openPrecursor}
            onHighlightBonds={(bondIds) => setSelection({ atoms: [], bonds: bondIds.filter((id) => molecule.bonds.some((b) => b.id === id)) })}
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
          docs={docs}
          activeDocId={activeId}
          onImportWorkspace={(mols, activeIndex) => {
            importWorkspace(mols, activeIndex);
            setMode("select");
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "help" && <ShortcutsOverlay onClose={() => setDialog(null)} />}
    </div>
  );
}
