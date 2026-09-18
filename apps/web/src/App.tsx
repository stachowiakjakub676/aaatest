import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE_MOLECULES, validateMolecule } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import { Viewport } from "./viewer/Viewport";
import type { ViewportHandle } from "./viewer/Viewport";
import type { PickData } from "./viewer/sceneBuilder";
import { Toolbox } from "./ui/Toolbox";
import { Inspector } from "./ui/Inspector";
import { StatusBar } from "./ui/StatusBar";
import { EMPTY_SELECTION, applyPick, pruneSelection } from "./state/selection";
import type { Selection } from "./state/selection";

const INITIAL = SAMPLE_MOLECULES.find((m) => m.id === "aspirin") ?? SAMPLE_MOLECULES[0]!;

export function App() {
  const [molecule, setMolecule] = useState<Molecule>(INITIAL);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [showLabels, setShowLabels] = useState(true);
  const [additiveMode, setAdditiveMode] = useState(false);
  const [lastAction, setLastAction] = useState(`Loaded ${INITIAL.name ?? INITIAL.id}`);
  const viewportRef = useRef<ViewportHandle>(null);

  // The graph is the source of truth: validation and derived data come from it, never from the scene.
  const validation = useMemo(() => validateMolecule(molecule), [molecule]);

  useEffect(() => {
    setSelection((sel) => pruneSelection(sel, new Set(molecule.atoms.map((a) => a.id)), new Set(molecule.bonds.map((b) => b.id))));
  }, [molecule]);

  const loadSample = useCallback((id: string) => {
    const next = SAMPLE_MOLECULES.find((m) => m.id === id);
    if (!next) return;
    setMolecule(next);
    setSelection(EMPTY_SELECTION);
    setLastAction(`Loaded ${next.name ?? next.id}`);
  }, []);

  const onPick = useCallback((pick: PickData | null, additive: boolean) => {
    setSelection((sel) => applyPick(sel, pick, additive));
    if (pick) setLastAction(`${additive ? "Toggled" : "Selected"} ${pick.kind} ${pick.id}`);
    else if (!additive) setLastAction("Selection cleared");
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(EMPTY_SELECTION);
    setLastAction("Selection cleared");
  }, []);

  // Keyboard shortcuts (desktop): F = fit, R = reset, Esc = clear selection, L = labels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key.toLowerCase()) {
        case "f":
          viewportRef.current?.fitToView();
          break;
        case "r":
          viewportRef.current?.resetCamera();
          break;
        case "l":
          setShowLabels((v) => !v);
          break;
        case "escape":
          clearSelection();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Molecular CAD</span>
          <span className="brand-phase">prototype · phase 2 viewer</span>
        </div>
        <div className="header-molecule">
          <span className="muted">Molecule</span> <strong>{molecule.name ?? molecule.id}</strong>
        </div>
      </header>

      <Toolbox
        molecules={SAMPLE_MOLECULES}
        currentId={molecule.id}
        onLoad={loadSample}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        additiveMode={additiveMode}
        onToggleAdditive={() => setAdditiveMode((v) => !v)}
        onFit={() => viewportRef.current?.fitToView()}
        onReset={() => viewportRef.current?.resetCamera()}
        onClearSelection={clearSelection}
      />

      <main className="viewport-area">
        <Viewport ref={viewportRef} molecule={molecule} selection={selection} showLabels={showLabels} onPick={onPick} additiveMode={additiveMode} />
        <div className="viewport-hint" aria-hidden="true">
          drag · rotate &nbsp;|&nbsp; wheel / pinch · zoom &nbsp;|&nbsp; right-drag / two-finger drag · pan &nbsp;|&nbsp; tap · select
        </div>
      </main>

      <Inspector molecule={molecule} selection={selection} validation={validation} />

      <StatusBar validation={validation} selection={selection} lastAction={lastAction} />
    </div>
  );
}
