/** Runs the design pipeline (generate → validate; evaluation and ranking arrive in later phases) and keeps the last run. */
import { useCallback, useRef, useState } from "react";
import { FRAGMENTS, SOLVENTS } from "@molecular-cad/molecule-model";
import type { Molecule } from "@molecular-cad/molecule-model";
import { appendCandidates, createRun, evaluateRun, generatorById, manualCandidate, parseRun, reevaluateRun, validateCandidates } from "@molecular-cad/design-engine";
import type { EvaluatedRun, GenerationInput, GeneratorParams, ProfileCache, Specification } from "@molecular-cad/design-engine";
import { candidateEvaluator } from "./candidateEvaluator";
import { BUILDING_BLOCKS } from "../retro/buildingBlocks";
import type { WasmRdkitEngine } from "../chemistry/wasmEngine";
import { structureTools } from "./structureTools";

export interface DesignRunApi {
  /** The run being shown. */
  run: EvaluatedRun | null;
  /** Every run of this session, newest first (imported ones included). */
  runs: EvaluatedRun[];
  running: boolean;
  progress: { stage: "generating" | "validating" | "evaluating"; done: number; total: number } | null;
  error: string | null;
  start(spec: Specification, seed: Molecule | null, generatorId: string, params: GeneratorParams, limit: number, repeatOf?: string | null): Promise<void>;
  /** Repeat a run exactly: its specification snapshot, generator, parameters and seed molecule. */
  repeat(run: EvaluatedRun): Promise<void>;
  select(runId: string): void;
  importText(text: string): string | null;
  /** Validate and evaluate the editor molecule against the shown run's specification and append it. */
  addManual(molecule: Molecule, parent: { id: string; name: string } | null, note: string): Promise<void>;
  /** Re-apply a changed specification to the shown run's existing profiles. */
  reevaluate(spec: Specification): void;
  clear(): void;
}

export function useDesignRun(engine: WasmRdkitEngine, appVersion: string): DesignRunApi {
  const [runs, setRuns] = useState<EvaluatedRun[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const run = runs.find((r) => r.id === currentId) ?? null;
  const cache = useRef<ProfileCache>(new Map());
  const publish = useCallback((next: EvaluatedRun) => {
    setRuns((all) => [next, ...all.filter((r) => r.id !== next.id)]);
    setCurrentId(next.id);
  }, []);
  const replace = useCallback((next: EvaluatedRun) => {
    setRuns((all) => all.map((r) => (r.id === next.id ? next : r)));
  }, []);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DesignRunApi["progress"]>(null);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);

  const start = useCallback(
    async (spec: Specification, seed: Molecule | null, generatorId: string, params: GeneratorParams, limit: number, repeatOf: string | null = null) => {
      const generator = generatorById(generatorId);
      if (!generator) return;
      const mine = ++token.current;
      setRunning(true);
      setError(null);
      setProgress({ stage: "generating", done: 0, total: 0 });
      let stage: "Loading the chemistry engine" | "Generation" | "Validation" | "Evaluation" = "Loading the chemistry engine";
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
        const merged = { ...generator.defaults, ...params, limit };
        stage = "Generation";
        const candidates = await generator.generate(input, merged, (done, total) => mine === token.current && setProgress({ stage: "generating", done, total }));
        if (mine !== token.current) return;
        stage = "Validation";
        setProgress({ stage: "validating", done: 0, total: candidates.length });
        const fresh = createRun(spec, generator, merged, seed, { app: `Clapeyron ${appVersion}`, engine: `${engine.id} ${version}`, models: [] }, repeatOf);
        const validated = await validateCandidates(fresh, candidates, structureTools(engine), (d, t) => mine === token.current && setProgress({ stage: "validating", done: d, total: t }));
        if (mine !== token.current) return;
        stage = "Evaluation";
        setProgress({ stage: "evaluating", done: 0, total: validated.summary.valid });
        const evaluated = await evaluateRun(validated, candidateEvaluator(engine), cache.current, {}, (d, t) => mine === token.current && setProgress({ stage: "evaluating", done: d, total: t }));
        if (mine !== token.current) return;
        publish(evaluated);
      } catch (e) {
        // Name the stage: "undefined is not an object" alone says nothing about where it happened.
        if (mine === token.current) setError(`${stage} failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (mine === token.current) {
          setRunning(false);
          setProgress(null);
        }
      }
    },
    [engine, appVersion, publish],
  );

  const repeat = useCallback((r: EvaluatedRun) => start(r.specification, r.seedMolecule, r.generator.id, r.generator.params, Number(r.generator.params.limit ?? 60), r.id), [start]);

  const select = useCallback((runId: string) => setCurrentId(runId), []);

  const importText = useCallback(
    (text: string) => {
      let parsed;
      try {
        parsed = parseRun(text);
      } catch (e) {
        return `Could not read the run file: ${e instanceof Error ? e.message : String(e)}`;
      }
      if (!parsed) return "Not a Clapeyron design-run file.";
      const asEvaluated = parsed as EvaluatedRun;
      const counted = asEvaluated.records.filter((r) => r.evaluation);
      publish({
        ...asEvaluated,
        evaluation: asEvaluated.evaluation ?? { evaluated: counted.length, passed: counted.filter((r) => r.evaluation?.overall === "pass").length, borderline: counted.filter((r) => r.evaluation?.overall === "borderline").length, failed: counted.filter((r) => r.evaluation?.overall === "fail").length, undecided: counted.filter((r) => r.evaluation?.overall === "unknown").length, cacheHits: 0 },
        evaluationOptions: asEvaluated.evaluationOptions ?? { margins: true },
        history: [...(asEvaluated.history ?? []), `${new Date().toISOString()}: imported from file`],
      });
      return null;
    },
    [publish],
  );

  const addManual = useCallback(
    async (molecule: Molecule, parent: { id: string; name: string } | null, note: string) => {
      if (!run) return;
      setRunning(true);
      setError(null);
      try {
        const next = await appendCandidates(run, [manualCandidate(molecule, parent, note)], structureTools(engine), candidateEvaluator(engine), cache.current);
        replace(next);
      } catch (e) {
        setError(`Adding the molecule to the run failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setRunning(false);
      }
    },
    [run, engine, replace],
  );

  const reevaluate = useCallback(
    (spec: Specification) => {
      if (!run) return;
      try {
        replace(reevaluateRun(run, spec));
      } catch (e) {
        setError(`Re-evaluation failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [run, replace],
  );

  const clear = useCallback(() => {
    token.current += 1;
    setCurrentId(null);
    setRunning(false);
    setProgress(null);
    setError(null);
  }, []);

  return { run, runs, running, progress, error, start, repeat, select, importText, addManual, reevaluate, clear };
}
