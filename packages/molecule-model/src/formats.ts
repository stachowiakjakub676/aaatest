/**
 * Structure-data file (SDF) support and text format detection for the import pipeline.
 */
import { parseMolfile, writeMolfile } from "./molfile";
import type { ParseMolfileOptions } from "./molfile";
import { parseMolecule } from "./serialization";
import type { MetadataValue, Molecule } from "./types";

export type TextFormat = "mcad-json" | "molfile" | "sdf" | "smiles" | "unknown";

/** Best-effort detection from content only (no file names). */
export function detectFormat(text: string): TextFormat {
  const t = text.trim();
  if (t === "") return "unknown";
  if (t.startsWith("{")) {
    try {
      const o = JSON.parse(t) as { schemaVersion?: unknown };
      return o && typeof o === "object" && "schemaVersion" in o ? "mcad-json" : "unknown";
    } catch {
      return "unknown";
    }
  }
  if (/^\$\$\$\$/m.test(t) && /M {2}END/.test(t)) return "sdf";
  if (/V2000|V3000/.test(t) || /^M {2}END/m.test(t)) return "molfile";
  // SMILES: single line, no whitespace inside the structure part, only SMILES characters.
  const firstToken = t.split(/\s+/)[0] ?? "";
  if (!t.includes("\n") && /^[A-Za-z0-9@+\-\[\]()=#$%.:\\/*]+$/.test(firstToken)) return "smiles";
  return "unknown";
}

/** Split an SDF into MOL records with their `> <tag>` data items. */
export function parseSdf(text: string, opts: ParseMolfileOptions = {}): Molecule[] {
  const records = text
    .replace(/\r\n?/g, "\n")
    .split(/^\$\$\$\$\s*$/m)
    .map((r) => r.replace(/^\n+/, ""))
    .filter((r) => r.trim().length > 0);
  return records.map((record, idx) => {
    const endIdx = record.indexOf("M  END");
    const molText = endIdx >= 0 ? record.slice(0, endIdx + 6) : record;
    const dataText = endIdx >= 0 ? record.slice(endIdx + 6) : "";
    const recordOpts: ParseMolfileOptions = { ...opts };
    if (opts.id !== undefined && records.length > 1) recordOpts.id = `${opts.id}-${idx + 1}`;
    const mol = parseMolfile(molText, recordOpts);
    const metadata: Record<string, MetadataValue> = { ...mol.metadata, source: "sdf" };
    const re = />\s*<([^>]+)>[^\n]*\n([\s\S]*?)(?=\n>\s*<|\n*$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(dataText)) !== null) {
      const value = m[2]!.trim();
      const num = Number(value);
      metadata[m[1]!.trim()] = value !== "" && Number.isFinite(num) && /^-?\d/.test(value) ? num : value;
    }
    return { ...mol, metadata };
  });
}

/** Write one or more molecules as an SDF (metadata becomes data items). */
export function writeSdf(mols: Molecule[]): string {
  return mols
    .map((mol) => {
      const items = Object.entries(mol.metadata)
        .map(([k, v]) => `>  <${k}>\n${String(v)}\n`)
        .join("\n");
      return writeMolfile(mol) + (items ? items + "\n" : "") + "$$$$\n";
    })
    .join("");
}

export interface ImportedText {
  format: TextFormat;
  molecules: Molecule[];
}

/**
 * Parse text in any supported *coordinate-carrying* format. SMILES has no coordinates and needs
 * a chemistry engine, so it is reported but not parsed here.
 */
export function parseStructureText(text: string, opts: ParseMolfileOptions = {}): ImportedText {
  const format = detectFormat(text);
  switch (format) {
    case "mcad-json":
      return { format, molecules: [parseMolecule(text.trim())] };
    case "molfile":
      return { format, molecules: [parseMolfile(text, opts)] };
    case "sdf":
      return { format, molecules: parseSdf(text, opts) };
    default:
      return { format, molecules: [] };
  }
}
