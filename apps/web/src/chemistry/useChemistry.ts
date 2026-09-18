import { useCallback, useEffect, useRef, useState } from "react";
import type { Molecule } from "@molecular-cad/molecule-model";
import type { ChemistryEngine, ComputedProperties, EngineValidation, OptimizedGeometry } from "./engine";
import { EngineError } from "./engine";

export type EngineStatus = "loading" | "ready" | "error";

export interface ChemistryState {
  status: EngineStatus;
  version: string;
  error: string | null;
  /** True while a validate/properties round trip is in flight. */
  computing: boolean;
  validation: EngineValidation | null;
  properties: ComputedProperties | null;
}

const DEBOUNCE_MS = 350;

/**
 * Keeps engine-side validation and computed properties in sync with the molecule.
 * Results are tied to the request that produced them; stale responses are dropped.
 */
export function useChemistry(engine: ChemistryEngine, molecule: Molecule) {
  const [state, setState] = useState<ChemistryState>({ status: "loading", version: "", error: null, computing: false, validation: null, properties: null });
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", version: "", error: null, computing: false, validation: null, properties: null });
    engine
      .ready()
      .then(({ version }) => !cancelled && setState((s) => ({ ...s, status: "ready", version })))
      .catch((e: unknown) => !cancelled && setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : String(e) })));
    return () => {
      cancelled = true;
    };
  }, [engine]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const id = ++requestId.current;
    if (molecule.atoms.length === 0) {
      setState((s) => ({ ...s, computing: false, validation: null, properties: null }));
      return;
    }
    setState((s) => ({ ...s, computing: true }));
    const timer = window.setTimeout(async () => {
      try {
        const validation = await engine.validate(molecule);
        if (id !== requestId.current) return;
        if (!validation.valid) {
          setState((s) => ({ ...s, computing: false, validation, properties: null, error: null }));
          return;
        }
        const properties = await engine.properties(molecule);
        if (id !== requestId.current) return;
        setState((s) => ({ ...s, computing: false, validation, properties, error: null }));
      } catch (e: unknown) {
        if (id !== requestId.current) return;
        const validation = e instanceof EngineError && e.validation ? e.validation : null;
        setState((s) => ({ ...s, computing: false, validation, properties: null, error: e instanceof Error ? e.message : String(e) }));
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [engine, molecule, state.status]);

  const optimize = useCallback((opts?: { embed?: boolean }): Promise<OptimizedGeometry> => engine.optimizeGeometry(molecule, opts), [engine, molecule]);

  return { state, optimize };
}
