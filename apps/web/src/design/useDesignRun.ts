/** Runs the design pipeline (generate → validate; evaluation and ranking arrive in later phases) and keeps the last run. */
import { useCallback, useRef, useState } from "react";
import { FRAGMENTS, SOLVENTS } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import { createRun, evaluateRun, generatorById, validateCandidates } from "@molecular-cad/design-engine";
import type { EvaluatedRun, GenerationInput, GeneratorParams, ProfileCache, Specification } from "@molecular-cad/design-engine";
import { candidateEvaluator } from "./candidateEvaluator";
import { BUILDING_BLOCKS } from "../retro/buildingBlocks";
import type { WasmRdkitEngine } from "../chemistry/wasmEngine";
import { structureTools } from "./structureTools";

export interface DesignRunApi {
  run: EvaluatedRun | null;
  running: boolean;
  progress: { stage: "generating" | "validating" | "evaluating"; done: number; total: number } | null;
  error: string | null;
  start(spec: Specification, seed: Molecule | null, generatorId: string, params: GeneratorParams, limit: number): Promise<void>;
  clear(): void;
}

export function useDesignRun(engine: WasmRdkitEngine, appVersion: string): DesignRunApi {
  const [run, setRun] = useState<EvaluatedRun | null>(null);
  const cache = useRef<ProfileCache>(new Map());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DesignRunApi["progress"]>(null);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);

  const start = useCallback(
    async (spec: Specification, seed: Molecule | null, generatorId: string, params: GeneratorParams, limit: number) => {
      const generator = generatorById(generatorId);
      if (!generator) return;
      const mine = ++token.current;
      setRunning(true);
      setError(null);
      setProgress({ stage: "generating", done: 0, total: 0 });
      try {
        const { version } = await engine.ready();
        const input: GenerationInput = {
          spec,
          seed,
          limit,
          fragments: FRAGMENTS,
          libraries: [
            { name: "building blocks", entries: [...BUILDING_BLOCKS].map(([smiles, name]) => ({ name, smiles })) },
            { name: "solvents", entries: SOLVENTS.map((s) => ({ name: s.name, smiles: s.smiles })) },
          ],
          parseSmiles: async (smiles, name) => {
            try {
              return (await engine.fromSmiles(smiles, { name })).molecule;
            } catch {
              return null;
            }
          },
        };
        const merged = { ...generator.defaults, ...params };
        const candidates = await generator.generate(input, merged, (done, total) => mine === token.current && setProgress({ stage: "generating", done, total }));
        if (mine !== token.current) return;
        setProgress({ stage: "validating", done: 0, total: candidates.length });
        const fresh = createRun(spec, generator, merged, seed, { app: `Clapeyron ${appVersion}`, engine: `${engine.id} ${version}`, models: [] });
        const validated = await validateCandidates(fresh, candidates, structureTools(engine), (d, t) => mine === token.current && setProgress({ stage: "validating", done: d, total: t }));
        if (mine !== token.current) return;
        setProgress({ stage: "evaluating", done: 0, total: validated.summary.valid });
        const evaluated = await evaluateRun(validated, candidateEvaluator(engine), cache.current, {}, (d, t) => mine === token.current && setProgress({ stage: "evaluating", done: d, total: t }));
        if (mine !== token.current) return;
        setRun(evaluated);
      } catch (e) {
        if (mine === token.current) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mine === token.current) {
          setRunning(false);
          setProgress(null);
        }
      }
    },
    [engine, appVersion],
  );

  const clear = useCallback(() => {
    token.current += 1;
    setRun(null);
    setRunning(false);
    setProgress(null);
    setError(null);
  }, []);

  return { run, running, progress, error, start, clear };
}
