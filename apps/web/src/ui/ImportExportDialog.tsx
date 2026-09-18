import { useEffect, useMemo, useState } from "react";
import { cleanupGeometry, detectFormat, parseStructureText, serializeMolecule, validateMolecule, writeMolfile, writeSdf } from "@molecular-cad/molecule-model";
import type { Molecule, ValidationResult } from "@molecular-cad/molecule-model";
import type { ChemistryEngine } from "../chemistry/engine";
import { parseWorkspace, serializeWorkspace } from "../state/workspace";
import type { Doc } from "../state/workspace";

export type DialogMode = "import" | "export";

export interface ImportExportDialogProps {
  mode: DialogMode;
  molecule: Molecule;
  engine: ChemistryEngine;
  engineReady: boolean;
  onImport(molecule: Molecule, label: string): void;
  onClose(): void;
  /** All open molecule tabs (workspace export) and the handler that opens a whole workspace file. */
  docs: Doc[];
  activeDocId: string;
  onImportWorkspace(molecules: Molecule[], activeIndex: number): void;
}

type ExportFormat = "mcad-json" | "molfile" | "sdf" | "smiles" | "workspace";

interface Parsed {
  molecules: Molecule[];
  format: string;
  note: string | null;
  error: string | null;
}

function isFlat(mol: Molecule): boolean {
  return mol.atoms.length > 3 && mol.atoms.every((a) => Math.abs(a.position.z) < 1e-6);
}

export function ImportExportDialog(props: ImportExportDialogProps) {
  const { mode, molecule, engine, engineReady, onImport, onClose } = props;
  const [text, setText] = useState("");
  const [addH, setAddH] = useState(true);
  const [lift2D, setLift2D] = useState(true);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [workspace, setWorkspace] = useState<{ molecules: Molecule[]; activeIndex: number } | null>(null);
  const [recordIndex, setRecordIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("molfile");
  const [exportText, setExportText] = useState("");
  const [copied, setCopied] = useState(false);

  const format = useMemo(() => detectFormat(text), [text]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // --- export -----------------------------------------------------------------
  useEffect(() => {
    if (mode !== "export") return;
    let cancelled = false;
    setCopied(false);
    if (molecule.atoms.length === 0 && exportFormat !== "workspace") {
      setExportText("");
      return;
    }
    try {
      if (exportFormat === "mcad-json") setExportText(serializeMolecule(molecule, true));
      else if (exportFormat === "workspace") setExportText(serializeWorkspace(props.docs, props.activeDocId, true));
      else if (exportFormat === "molfile") setExportText(writeMolfile(molecule));
      else if (exportFormat === "sdf") setExportText(writeSdf([molecule]));
      else {
        setExportText("…");
        engine
          .toSmiles(molecule)
          .then((s) => !cancelled && setExportText(s))
          .catch((e: unknown) => !cancelled && setExportText(`Cannot export SMILES: ${e instanceof Error ? e.message : String(e)}`));
      }
    } catch (e) {
      setExportText(`Cannot export: ${e instanceof Error ? e.message : String(e)}`);
    }
    return () => {
      cancelled = true;
    };
  }, [mode, exportFormat, molecule, engine, props.docs, props.activeDocId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
    } catch {
      const ta = document.getElementById("export-text") as HTMLTextAreaElement | null;
      ta?.select();
      setCopied(document.execCommand("copy"));
    }
  };

  const download = () => {
    const ext = exportFormat === "mcad-json" ? "json" : exportFormat === "workspace" ? "clapeyron.json" : exportFormat === "molfile" ? "mol" : exportFormat === "sdf" ? "sdf" : "smi";
    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(exportFormat === "workspace" ? "workspace" : (molecule.name ?? molecule.id)).replace(/[^\w.-]+/g, "_")}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // --- import -----------------------------------------------------------------
  const parse = async () => {
    setBusy(true);
    setParsed(null);
    setWorkspace(null);
    setRecordIndex(0);
    try {
      const ws = parseWorkspace(text);
      if (ws) {
        setWorkspace(ws);
        setParsed({ molecules: [], format: "WORKSPACE", note: `${ws.molecules.length} molecule${ws.molecules.length === 1 ? "" : "s"} in this workspace file.`, error: null });
        return;
      }
      if (format === "smiles") {
        if (!engine.capabilities.smiles || !engineReady) throw new Error("SMILES import needs a ready chemistry engine.");
        const r = await engine.fromSmiles(text.trim().split(/\s+/)[0] ?? "", { addHydrogens: addH });
        setParsed({ molecules: [r.molecule], format: "SMILES", note: r.coordinateNote, error: null });
      } else {
        const r = parseStructureText(text, { id: "imported" });
        if (r.format === "unknown" || r.molecules.length === 0) throw new Error("Unrecognised format. Paste MCAD JSON, a MOL/SDF block or a SMILES string.");
        const mols = r.molecules.map((m) => (lift2D && isFlat(m) ? { ...cleanupGeometry(m, { jitter: 0.6, maxIterations: 600 }).molecule, metadata: { ...m.metadata, coordinates: "2D input + sketch clean-up" } } : m));
        const flat = r.molecules.some(isFlat);
        setParsed({ molecules: mols, format: r.format.toUpperCase(), note: flat ? (lift2D ? "Input had flat (2D) coordinates; lifted into 3D with the sketch clean-up." : "Input has flat (2D) coordinates.") : null, error: null });
      }
    } catch (e) {
      setParsed({ molecules: [], format: format.toUpperCase(), note: null, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const candidate = parsed?.molecules[recordIndex];
  const validation: ValidationResult | null = candidate ? validateMolecule(candidate) : null;
  const errors = validation?.issues.filter((i) => i.severity === "error") ?? [];

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="dialog-title">{mode === "import" ? "Import structure" : "Export structure"}</h2>
          <button type="button" className="btn btn-small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {mode === "import" ? (
          <div className="modal-body">
            <label className="field">
              <span className="field-label">Paste MCAD JSON, MOL / SDF, or a SMILES string</span>
              <textarea
                id="import-text"
                className="textarea mono"
                rows={8}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setParsed(null);
                }}
                placeholder={"e.g.  CC(=O)Oc1ccccc1C(=O)O"}
                spellCheck={false}
              />
            </label>
            <div className="row">
              <span className="row-label">Detected format</span>
              <span className="row-value mono">{format}</span>
            </div>
            {format === "smiles" && (
              <label className="toggle">
                <input type="checkbox" checked={addH} onChange={(e) => setAddH(e.target.checked)} />
                <span>Add explicit hydrogens</span>
              </label>
            )}
            {(format === "molfile" || format === "sdf") && (
              <label className="toggle">
                <input type="checkbox" checked={lift2D} onChange={(e) => setLift2D(e.target.checked)} />
                <span>Lift flat 2D coordinates into 3D (sketch clean-up)</span>
              </label>
            )}
            <div className="button-row">
              <button type="button" className="btn" onClick={() => void parse()} disabled={busy || format === "unknown"}>
                {busy ? "Parsing…" : "Parse and validate"}
              </button>
            </div>
            {parsed?.error && <p className="hint error-text">{parsed.error}</p>}
            {workspace && (
              <div className="import-summary">
                <p className="hint">{parsed?.note}</p>
                <ul className="fragment-list">
                  {workspace.molecules.map((m, i) => (
                    <li key={i} className="mono">
                      {m.name ?? m.id} · {m.atoms.length} atoms
                    </li>
                  ))}
                </ul>
                <button
                  id="btn-import-workspace"
                  type="button"
                  className="btn btn-block"
                  onClick={() => {
                    props.onImportWorkspace(workspace.molecules, workspace.activeIndex);
                    onClose();
                  }}
                >
                  Open all as molecule tabs
                </button>
              </div>
            )}
            {parsed && parsed.molecules.length > 1 && (
              <label className="field">
                <span className="field-label">{parsed.molecules.length} records found; import which one?</span>
                <select className="select" value={recordIndex} onChange={(e) => setRecordIndex(Number(e.target.value))}>
                  {parsed.molecules.map((m, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {m.name ?? m.id} ({m.atoms.length} atoms)
                    </option>
                  ))}
                </select>
              </label>
            )}
            {candidate && validation && (
              <div className="import-summary">
                <div className="row">
                  <span className="row-label">Parsed</span>
                  <span className="row-value mono">
                    {parsed?.format} · {candidate.atoms.length} atoms, {candidate.bonds.length} bonds
                  </span>
                </div>
                {parsed?.note && <p className="hint">{parsed.note}</p>}
                <div className="row">
                  <span className="row-label">Validation</span>
                  <span className="row-value">{validation.valid ? <span className="status ok">passed{validation.issues.length ? ` · ${validation.issues.length} warning(s)` : ""}</span> : <span className="status err">{errors.length} error(s)</span>}</span>
                </div>
                {validation.issues.length > 0 && (
                  <ul className="issue-list">
                    {validation.issues.map((issue, i) => (
                      <li key={i} className={`issue ${issue.severity}`}>
                        <span className="issue-code mono">{issue.code}</span>
                        <span>{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  id="btn-import-confirm"
                  type="button"
                  className="btn btn-block"
                  disabled={!validation.valid}
                  onClick={() => {
                    onImport(candidate, `Import ${parsed?.format ?? ""} (${candidate.name ?? candidate.id})`);
                    onClose();
                  }}
                >
                  {validation.valid ? "Import into the editor" : "Fix the errors before importing"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="modal-body">
            <label className="field">
              <span className="field-label">Format</span>
              <select id="export-format" className="select" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)}>
                <option value="molfile">MOL (V2000)</option>
                <option value="sdf">SDF (MOL + metadata)</option>
                <option value="mcad-json">MCAD JSON (native, lossless)</option>
                <option value="workspace">Workspace (all open molecules, .clapeyron.json)</option>
                <option value="smiles">SMILES (canonical, via chemistry engine)</option>
              </select>
            </label>
            <textarea id="export-text" className="textarea mono" rows={12} readOnly value={exportText} spellCheck={false} />
            {molecule.atoms.length === 0 && exportFormat !== "workspace" && <p className="hint">Nothing to export yet.</p>}
            <div className="button-row">
              <button type="button" className="btn" onClick={() => void copy()} disabled={!exportText}>
                {copied ? "Copied" : "Copy to clipboard"}
              </button>
              <button type="button" className="btn" onClick={download} disabled={!exportText}>
                Download file
              </button>
            </div>
            <p className="hint">If downloads are blocked where this page is hosted, copy the text instead. SMILES export drops explicit hydrogens and uses RDKit canonicalisation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
