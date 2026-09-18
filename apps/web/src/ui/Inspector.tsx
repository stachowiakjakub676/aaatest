import {
  bondOrderValue,
  bondsOfAtom,
  chargeLabel,
  distance,
  explicitValence,
  getAtom,
  getBond,
  getElement,
  implicitHydrogenCount,
  molecularFormula,
  molecularWeight,
  totalFormalCharge,
} from "@molecular-cad/molecule-model";
import type { Molecule, ValidationResult } from "@molecular-cad/molecule-model";
import type { Selection } from "../state/selection";
import { measureSelection } from "../state/measure";

export interface InspectorProps {
  molecule: Molecule;
  selection: Selection;
  validation: ValidationResult;
}

function Row({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className={mono ? "row-value mono" : "row-value"}>{value}</span>
    </div>
  );
}

function fmt(n: number): string {
  return n.toFixed(3);
}

export function Inspector({ molecule, selection, validation }: InspectorProps) {
  const mw = molecularWeight(molecule);
  const errors = validation.issues.filter((i) => i.severity === "error").length;
  const warnings = validation.issues.length - errors;
  const measurement = measureSelection(molecule, selection.atoms);

  return (
    <aside className="panel inspector" aria-label="Inspector">
      <section className="panel-section">
        <h2 className="panel-title">
          Molecule <span className="tag tag-computed">computed</span>
        </h2>
        <Row label="Formula" value={molecularFormula(molecule)} />
        <Row label="Mol. weight" value={mw.value !== undefined ? `${mw.value.toFixed(3)} g/mol${mw.approximate ? " (approx.)" : ""}` : "n/a"} />
        <Row label="Atoms" value={molecule.atoms.length} />
        <Row label="Bonds" value={molecule.bonds.length} />
        <Row label="Net charge" value={totalFormalCharge(molecule)} />
        <Row
          label="Structure"
          mono={false}
          value={
            validation.valid ? (
              <span className="status ok">Valid{warnings ? ` · ${warnings} warning${warnings > 1 ? "s" : ""}` : ""}</span>
            ) : (
              <span className="status err">
                {errors} error{errors > 1 ? "s" : ""}
              </span>
            )
          }
        />
        <p className="hint">Values follow deterministically from the explicit atoms and bonds. No predictions are shown in this phase.</p>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">Selection</h2>
        {selection.atoms.length === 0 && selection.bonds.length === 0 && <p className="hint">Nothing selected. Tap an atom or a bond in the viewport.</p>}

        {selection.atoms.length === 1 && <AtomDetails molecule={molecule} atomId={selection.atoms[0]!} />}
        {selection.bonds.length === 1 && selection.atoms.length === 0 && <BondDetails molecule={molecule} bondId={selection.bonds[0]!} />}

        {(selection.atoms.length > 1 || selection.bonds.length > 1 || (selection.atoms.length > 0 && selection.bonds.length > 0)) && (
          <>
            <Row label="Atoms" value={selection.atoms.length} />
            <Row label="Bonds" value={selection.bonds.length} />
            <ul className="id-list">
              {selection.atoms.map((id) => (
                <li key={`a-${id}`} className="mono">
                  {getAtom(molecule, id)?.element} {id}
                </li>
              ))}
              {selection.bonds.map((id) => (
                <li key={`b-${id}`} className="mono">
                  bond {id}
                </li>
              ))}
            </ul>
          </>
        )}

        {measurement && (
          <div className="measurement">
            <span className="row-label">{measurement.label}</span>
            <span className="measurement-value mono">{measurement.value}</span>
          </div>
        )}
      </section>

      {validation.issues.length > 0 && (
        <section className="panel-section">
          <h2 className="panel-title">Validation</h2>
          <ul className="issue-list">
            {validation.issues.map((issue, i) => (
              <li key={i} className={`issue ${issue.severity}`}>
                <span className="issue-code mono">{issue.code}</span>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

function AtomDetails({ molecule, atomId }: { molecule: Molecule; atomId: string }) {
  const atom = getAtom(molecule, atomId);
  if (!atom) return null;
  const el = getElement(atom.element);
  const bonds = bondsOfAtom(molecule, atomId);
  return (
    <>
      <Row label="Atom" value={`${atom.element}${chargeLabel(atom.formalCharge)} · ${atom.id}`} />
      <Row label="Element" value={el ? `${el.name} (Z=${el.atomicNumber})` : "unknown"} mono={false} />
      <Row label="Formal charge" value={atom.formalCharge} />
      {atom.isotope !== undefined && <Row label="Isotope" value={atom.isotope} />}
      <Row label="Position (Å)" value={`${fmt(atom.position.x)}, ${fmt(atom.position.y)}, ${fmt(atom.position.z)}`} />
      <Row label="Explicit valence" value={explicitValence(molecule, atomId)} />
      <Row label="Implicit H" value={implicitHydrogenCount(molecule, atomId)} />
      <Row
        label="Bonds"
        value={
          bonds.length === 0
            ? "none"
            : bonds
                .map((b) => {
                  const other = b.atomA === atomId ? b.atomB : b.atomA;
                  return `${getAtom(molecule, other)?.element ?? "?"}${other} (${b.order})`;
                })
                .join(", ")
        }
      />
    </>
  );
}

function BondDetails({ molecule, bondId }: { molecule: Molecule; bondId: string }) {
  const bond = getBond(molecule, bondId);
  if (!bond) return null;
  const a = getAtom(molecule, bond.atomA);
  const b = getAtom(molecule, bond.atomB);
  return (
    <>
      <Row label="Bond" value={bond.id} />
      <Row label="Atoms" value={`${a?.element ?? "?"}${bond.atomA} — ${b?.element ?? "?"}${bond.atomB}`} />
      <Row label="Order" value={`${bond.order} (${bondOrderValue(bond.order)})`} />
      {bond.stereo && <Row label="Stereo" value={bond.stereo} />}
      {a && b && <Row label="Length" value={`${distance(a.position, b.position).toFixed(3)} Å`} />}
    </>
  );
}
