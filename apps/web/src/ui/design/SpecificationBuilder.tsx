import { useRef, useState } from "react";
import { DOMAIN_LABELS, PROPERTY_BY_KEY, PROPERTY_CATALOGUE, createHardConstraint, createSoftPreference } from "@molecular-cad/design-engine";
import type { HardConstraint, PropertyDomain, SoftPreference, SpecificationIssue, StructuralConstraints } from "@molecular-cad/design-engine";
import type { SpecificationApi } from "../../design/useSpecification";

const DOMAINS: PropertyDomain[] = ["molecular", "thermodynamic", "phase", "solubility", "materials", "drug-likeness"];
const ELEMENT_CHIPS = ["C", "N", "O", "S", "P", "F", "Cl", "Br", "I", "Si", "B"];

function PropertySelect({ value, onChange, numericOnly = false, id }: { value: string; onChange(key: string): void; numericOnly?: boolean; id?: string }) {
  return (
    <select id={id} className="select prop" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Property">
      {DOMAINS.map((d) => (
        <optgroup key={d} label={DOMAIN_LABELS[d]}>
          {PROPERTY_CATALOGUE.filter((p) => p.domain === d && (!numericOnly || p.type === "number")).map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
              {p.unit ? ` (${p.unit})` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

const numOrUndef = (text: string): number | undefined => (text.trim() === "" || !Number.isFinite(Number(text)) ? undefined : Number(text));

function ConstraintRow({ c, issues, onChange, onRemove }: { c: HardConstraint; issues: SpecificationIssue[]; onChange(next: HardConstraint): void; onRemove(): void }) {
  const def = PROPERTY_BY_KEY.get(c.property);
  const setNum = (field: "min" | "max", text: string) => {
    const v = numOrUndef(text);
    const next = { ...c };
    if (v === undefined) delete next[field];
    else next[field] = v;
    onChange(next);
  };
  return (
    <li className="constraint-row" data-id={c.id}>
      <div className="constraint-main">
        <PropertySelect value={c.property} onChange={(key) => onChange(createHardConstraint(key) && { ...createHardConstraint(key), id: c.id })} />
        {def?.type === "category" ? (
          <div className="chips" role="group" aria-label="Allowed values">
            {(def.categories ?? []).map((v) => {
              const on = (c.values ?? []).includes(v);
              return (
                <button key={v} type="button" className={`chip ${on ? "chip-on" : ""}`} aria-pressed={on} onClick={() => onChange({ ...c, values: on ? (c.values ?? []).filter((x) => x !== v) : [...(c.values ?? []), v] })}>
                  {v}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <select className="select op" value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as HardConstraint["op"] })} aria-label="Operator">
              <option value="between">between</option>
              <option value=">=">at least</option>
              <option value="<=">at most</option>
            </select>
            {c.op !== "<=" && <input className="input mono bound" inputMode="decimal" placeholder="min" value={c.min ?? ""} onChange={(e) => setNum("min", e.target.value)} aria-label="Lower bound" />}
            {c.op === "between" && <span className="muted">–</span>}
            {c.op !== ">=" && <input className="input mono bound" inputMode="decimal" placeholder="max" value={c.max ?? ""} onChange={(e) => setNum("max", e.target.value)} aria-label="Upper bound" />}
            <span className="muted unit">{def?.unit ?? ""}</span>
          </>
        )}
        <button type="button" className="btn btn-small btn-danger" onClick={onRemove} aria-label="Remove constraint">
          ×
        </button>
      </div>
      {def && (
        <p className="hint provenance">
          <span className={`tag tag-${def.kind === "computed" ? "computed" : "predicted"}`}>{def.kind}</span> {def.method}
          {def.uncertainty ? ` · ${def.uncertainty}` : ""}
        </p>
      )}
      {issues.map((i, k) => (
        <p key={k} className={`hint ${i.severity === "error" ? "error-text" : "warn-text"}`}>
          {i.message}
        </p>
      ))}
    </li>
  );
}

function PreferenceRow({ s, issues, onChange, onRemove }: { s: SoftPreference; issues: SpecificationIssue[]; onChange(next: SoftPreference): void; onRemove(): void }) {
  const def = PROPERTY_BY_KEY.get(s.property);
  return (
    <li className="constraint-row" data-id={s.id}>
      <div className="constraint-main">
        <PropertySelect value={s.property} onChange={(key) => onChange({ ...s, property: key })} numericOnly />
        <select className="select op" value={s.direction} onChange={(e) => onChange({ ...s, direction: e.target.value as SoftPreference["direction"] })} aria-label="Direction">
          <option value="maximize">higher is better</option>
          <option value="minimize">lower is better</option>
          <option value="target">close to</option>
        </select>
        {s.direction === "target" && (
          <input
            className="input mono bound"
            inputMode="decimal"
            placeholder="target"
            value={s.target ?? ""}
            onChange={(e) => {
              const v = numOrUndef(e.target.value);
              const next = { ...s };
              if (v === undefined) delete next.target;
              else next.target = v;
              onChange(next);
            }}
            aria-label="Target value"
          />
        )}
        <span className="muted unit">{def?.unit ?? ""}</span>
        <label className="weight">
          <span className="muted">w {s.weight.toFixed(2)}</span>
          <input type="range" min={0} max={1} step={0.05} value={s.weight} onChange={(e) => onChange({ ...s, weight: Number(e.target.value) })} aria-label="Weight" />
        </label>
        <button type="button" className="btn btn-small btn-danger" onClick={onRemove} aria-label="Remove preference">
          ×
        </button>
      </div>
      {issues.map((i, k) => (
        <p key={k} className={`hint ${i.severity === "error" ? "error-text" : "warn-text"}`}>
          {i.message}
        </p>
      ))}
    </li>
  );
}

function linesOf(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SpecificationBuilder({ api }: { api: SpecificationApi }) {
  const { spec, issues, update } = api;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [required, setRequired] = useState(spec.structural.requiredSubstructures.join("\n"));
  const [forbidden, setForbidden] = useState(spec.structural.forbiddenSubstructures.join("\n"));
  const st = spec.structural;
  const setStructural = (patch: Partial<StructuralConstraints>) => update((s) => ({ ...s, structural: { ...s.structural, ...patch } }));
  const issuesFor = (path: string) => issues.filter((i) => i.path === path);

  const exportFile = () => {
    const blob = new Blob([api.exportText()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${spec.name.replace(/[^\w.-]+/g, "_") || "specification"}.clapeyron-spec.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="spec-builder">
      <section className="panel-section">
        <h2 className="panel-title">Specification</h2>
        <div className="custom-element">
          <input id="spec-name" className="input" value={spec.name} onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} placeholder="Name" aria-label="Specification name" />
          <button type="button" className="btn btn-small" id="btn-spec-new" onClick={() => api.reset()} title="Start an empty specification">
            New
          </button>
          <button type="button" className="btn btn-small" id="btn-spec-import" onClick={() => fileRef.current?.click()} title="Import a .clapeyron-spec.json file">
            Import
          </button>
          <button type="button" className="btn btn-small" id="btn-spec-export" onClick={exportFile} title="Download as JSON">
            Export
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setImportError(api.importText(await f.text()));
              e.target.value = "";
            }}
          />
        </div>
        <textarea id="spec-description" className="input" rows={2} value={spec.description} onChange={(e) => update((s) => ({ ...s, description: e.target.value }))} placeholder="What is this molecule for? (free text, kept with the specification)" aria-label="Description" />
        {importError && <p className="hint error-text">{importError}</p>}
        <p className="hint">
          Saved automatically in this browser · created {spec.createdAt.slice(0, 10)} · id <span className="mono">{spec.id}</span>
        </p>
      </section>

      <section className="panel-section" id="hard-constraints">
        <h2 className="panel-title">Hard constraints</h2>
        <p className="hint">A candidate that violates any of these is rejected, with the reason shown. Each property names the method that supplies it and its error.</p>
        <ul className="constraint-list">
          {spec.hard.map((c) => (
            <ConstraintRow key={c.id} c={c} issues={issuesFor(`hard:${c.id}`)} onChange={(next) => update((s) => ({ ...s, hard: s.hard.map((x) => (x.id === c.id ? next : x)) }))} onRemove={() => update((s) => ({ ...s, hard: s.hard.filter((x) => x.id !== c.id) }))} />
          ))}
        </ul>
        <button type="button" className="btn btn-small" id="btn-add-constraint" onClick={() => update((s) => ({ ...s, hard: [...s.hard, createHardConstraint("tb")] }))}>
          + Add constraint
        </button>
        {issuesFor("hard").map((i, k) => (
          <p key={k} className="hint warn-text">
            {i.message}
          </p>
        ))}
      </section>

      <section className="panel-section" id="soft-preferences">
        <h2 className="panel-title">Soft preferences</h2>
        <p className="hint">Not required, but better candidates rank higher on them (multi-objective ranking arrives in phase 3D; the weights are stored now).</p>
        <ul className="constraint-list">
          {spec.soft.map((p) => (
            <PreferenceRow key={p.id} s={p} issues={issuesFor(`soft:${p.id}`)} onChange={(next) => update((s) => ({ ...s, soft: s.soft.map((x) => (x.id === p.id ? next : x)) }))} onRemove={() => update((s) => ({ ...s, soft: s.soft.filter((x) => x.id !== p.id) }))} />
          ))}
        </ul>
        <button type="button" className="btn btn-small" id="btn-add-preference" onClick={() => update((s) => ({ ...s, soft: [...s.soft, createSoftPreference("logS")] }))}>
          + Add preference
        </button>
      </section>

      <section className="panel-section" id="structural-constraints">
        <h2 className="panel-title">Structural constraints</h2>
        <div className="field">
          <span className="field-label">Allowed elements (none selected: any)</span>
          <div className="chips" role="group" aria-label="Allowed elements">
            {ELEMENT_CHIPS.map((el) => {
              const on = st.allowedElements.includes(el);
              return (
                <button key={el} type="button" className={`chip ${on ? "chip-on" : ""}`} id={`allow-${el}`} aria-pressed={on} onClick={() => setStructural({ allowedElements: on ? st.allowedElements.filter((x) => x !== el) : [...st.allowedElements, el] })}>
                  {el}
                </button>
              );
            })}
          </div>
        </div>
        <div className="custom-element">
          <label className="field">
            <span className="field-label">Heavy atoms, min</span>
            <input id="heavy-min" className="input mono" inputMode="numeric" value={st.minHeavyAtoms ?? ""} onChange={(e) => setStructural({ minHeavyAtoms: numOrUndef(e.target.value) ?? null })} />
          </label>
          <label className="field">
            <span className="field-label">Heavy atoms, max</span>
            <input id="heavy-max" className="input mono" inputMode="numeric" value={st.maxHeavyAtoms ?? ""} onChange={(e) => setStructural({ maxHeavyAtoms: numOrUndef(e.target.value) ?? null })} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" id="spec-neutral" checked={st.neutral} onChange={(e) => setStructural({ neutral: e.target.checked })} /> Neutral molecule (net charge 0)
        </label>
        <label className="field">
          <span className="field-label">Required substructures (SMARTS, one per line)</span>
          <textarea id="spec-required" className="input mono" rows={2} value={required} onChange={(e) => setRequired(e.target.value)} onBlur={() => setStructural({ requiredSubstructures: linesOf(required) })} placeholder="[OX2H]" />
        </label>
        <label className="field">
          <span className="field-label">Forbidden substructures (SMARTS, one per line)</span>
          <textarea id="spec-forbidden" className="input mono" rows={2} value={forbidden} onChange={(e) => setForbidden(e.target.value)} onBlur={() => setStructural({ forbiddenSubstructures: linesOf(forbidden) })} placeholder="[N+](=O)[O-]" />
        </label>
        <p className="hint">Substructure patterns are stored now and checked by RDKit when candidates are generated (phase 3B).</p>
        {issuesFor("structural").map((i, k) => (
          <p key={k} className={`hint ${i.severity === "error" ? "error-text" : "warn-text"}`}>
            {i.message}
          </p>
        ))}
      </section>

      <section className="panel-section" id="spec-issues">
        <h2 className="panel-title">Validation</h2>
        {issues.length === 0 && <p className="status ok">The specification is complete and consistent.</p>}
        {issues.length > 0 && (
          <ul className="issue-list">
            {issues.map((i, k) => (
              <li key={k} className={`issue ${i.severity}`}>
                <span className="issue-code mono">{i.path}</span>
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
