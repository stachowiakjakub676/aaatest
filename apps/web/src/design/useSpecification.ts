/** Specification state with browser-storage persistence and file import/export. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createSpecification, parseSpecification, serializeSpecification, touch, validateSpecification } from "@molecular-cad/design-engine";
import type { Specification, SpecificationIssue } from "@molecular-cad/design-engine";

export const SPECIFICATION_STORAGE_KEY = "clapeyron.specification";

function restore(): Specification | null {
  try {
    const text = window.localStorage.getItem(SPECIFICATION_STORAGE_KEY);
    return text ? parseSpecification(text) : null;
  } catch {
    return null;
  }
}

export interface SpecificationApi {
  spec: Specification;
  issues: SpecificationIssue[];
  /** Replace the specification (timestamps the change). */
  set(next: Specification): void;
  /** Update through a function of the current specification. */
  update(fn: (spec: Specification) => Specification): void;
  reset(): void;
  /** Import a specification file; returns an error message or null. */
  importText(text: string): string | null;
  exportText(): string;
}

export function useSpecification(): SpecificationApi {
  const [spec, setSpec] = useState<Specification>(() => restore() ?? createSpecification());
  useEffect(() => {
    try {
      window.localStorage.setItem(SPECIFICATION_STORAGE_KEY, serializeSpecification(spec, false));
    } catch {
      /* private mode, quota */
    }
  }, [spec]);
  const issues = useMemo(() => validateSpecification(spec), [spec]);
  const set = useCallback((next: Specification) => setSpec(touch(next)), []);
  const update = useCallback((fn: (s: Specification) => Specification) => setSpec((s) => touch(fn(s))), []);
  const reset = useCallback(() => setSpec(createSpecification()), []);
  const importText = useCallback((text: string) => {
    try {
      const parsed = parseSpecification(text);
      if (!parsed) return "Not a Clapeyron specification file.";
      setSpec(parsed);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, []);
  const exportText = useCallback(() => serializeSpecification(spec), [spec]);
  return { spec, issues, set, update, reset, importText, exportText };
}
