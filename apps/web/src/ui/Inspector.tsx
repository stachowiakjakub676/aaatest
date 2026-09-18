import { useState } from "react";
import {
  ELEMENTS,
  bondInRing,
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
import type { BondOrder, Molecule, ValidationResult } from "@molecular-cad/molecule-model";
import type { Selection } from "../state/selection";
import { measureSelection } from "../state/measure";
import type { StereoInfo } from "../chemistry/engine";

export interface InspectorActions {
  onSetElement(atomId: string, element: string): void;
  onSetCharge(atomId: string, charge: number): void;
  onDeleteAtom(atomId: string): void;
  onAddHydrogens(atomId: string): void;
  onSetBondOrder(bondId: string, order: BondOrder): void;
  onDeleteBond(bondId: string): void;
  onInvertCentre(atomId: string): void;
  onFlipBond(bondId: string): void;
  onRotateBond(bondId: string, degrees: number): void;
}

export interface InspectorProps extends InspectorActions {
  molecule: Molecule;
  selection: Selection;
  validation: ValidationResult;
  /** CIP labels from the chemistry engine (null while unavailable). */
  stereo: StereoInfo | null;
  /** Extra sections (e.g. the chemistry engine panel) rendered after the selection. */
  children?: React.ReactNode;
}

function Row({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className={mono ? "row-value mono" : "row-value"}>{value}</span>
    </div>
  );
}

const fmt = (n: number) => n.toFixed(3);
const ORDERS: BondOrder[] = ["single", "double", "triple", "aromatic"];

export function Inspector(props: InspectorProps) {
  const { molecule, selection, validation } = props;
  const mw = molecularWeight(molecule);
  const errors = validation.issues.filter((i) => i.severity === "error").length;
  const warnings = validation.issues.length - errors;
  const measurement = measureSelection(molecule, selection.atoms);
  const single = selection.atoms.length === 1 && selection.bonds.length === 0 ? "atom" : selection.bonds.length === 1 && selection.atoms.length === 0 ? "bond" : selection.atoms.length + selection.bonds.length === 0 ? "none" : "multi";

  return (
    <div className="panel-content">
      <section className="panel-section">
        <h2 className="panel-title">
          Molecule <span className="tag tag-computed">computed</span>
        </h2>
        <Row label="Formula (explicit)" value={molecule.atoms.length ? molecularFormula(molecule) : "—"} />
        <Row label="Formula (with implicit H)" value={molecule.atoms.length ? molecularFormula(molecule, { includeImplicitHydrogens: true }) : "—"} />
        <Row label="Mol. weight" value={mw.value !== undefined && molecule.atoms.length ? `${mw.value.toFixed(3)} g/mol${mw.approximate ? " (approx.)" : ""}` : "—"} />
        <Row label="Atoms / bonds" value={`${molecule.atoms.length} / ${molecule.bonds.length}`} />
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
        <p className="hint">Values follow deterministically from the explicit atoms and bonds. Mol. weight counts explicit atoms only.</p>
      </section>

      <section className="panel-section">
        <h2 className="panel-title">Selection</h2>
        {single === "none" && <p className="hint">Nothing selected. Use the Select tool and tap an atom or a bond.</p>}
        {single === "atom" && <AtomDetails {...props} atomId={selection.atoms[0]!} />}
        {single === "bond" && <BondDetails {...props} bondId={selection.bonds[0]!} />}
        {single === "multi" && (
          <>
            <Row label="Atoms / bonds" value={`${selection.atoms.length} / ${selection.bonds.length}`} />
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

      {props.children}

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
    </div>
  );
}

function AtomDetails({ molecule, atomId, stereo, onSetElement, onSetCharge, onDeleteAtom, onAddHydrogens, onInvertCentre }: InspectorProps & { atomId: string }) {
  const atom = getAtom(molecule, atomId);
  if (!atom) return null;
  const el = getElement(atom.element);
  const bonds = bondsOfAtom(molecule, atomId);
  const implicitH = implicitHydrogenCount(molecule, atomId);
  const cip = stereo?.atoms.find((a) => a.atomId === atomId)?.label;
  return (
    <>
      <Row label="Atom" value={`${atom.element}${chargeLabel(atom.formalCharge)} · ${atom.id}`} />
      {cip && (
        <div className="row">
          <span className="row-label">Stereocentre (CIP)</span>
          <span className="row-value">
            <span className="mono">{cip === "?" ? "unassigned" : cip}</span>{" "}
            <button type="button" className="btn btn-small" id="btn-invert-centre" onClick={() => onInvertCentre(atomId)} title="Swap two substituents to invert this centre">
              Invert
            </button>
          </span>
        </div>
      )}
      <label className="field">
        <span className="field-label">Element</span>
        <select id="inspector-element" className="select mono" value={atom.element} onChange={(e) => onSetElement(atomId, e.target.value)}>
          {ELEMENTS.map((e) => (
            <option key={e.symbol} value={e.symbol}>
              {e.symbol} · {e.name} ({e.atomicNumber})
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <span className="row-label">Formal charge</span>
        <span className="stepper">
          <button type="button" className="btn btn-small" onClick={() => onSetCharge(atomId, atom.formalCharge - 1)} aria-label="Decrease charge">
            −
          </button>
          <span className="mono">{atom.formalCharge > 0 ? `+${atom.formalCharge}` : atom.formalCharge}</span>
          <button type="button" className="btn btn-small" onClick={() => onSetCharge(atomId, atom.formalCharge + 1)} aria-label="Increase charge">
            +
          </button>
        </span>
      </div>
      <Row label="Element name" value={el ? `${el.name} (Z=${el.atomicNumber})` : "unknown"} mono={false} />
      {atom.isotope !== undefined && <Row label="Isotope" value={atom.isotope} />}
      <Row label="Position (Å)" value={`${fmt(atom.position.x)}, ${fmt(atom.position.y)}, ${fmt(atom.position.z)}`} />
      <Row label="Explicit valence" value={explicitValence(molecule, atomId)} />
      <Row label="Implicit H" value={implicitH} />
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
      <div className="button-row">
        <button type="button" className="btn" onClick={() => onAddHydrogens(atomId)} disabled={implicitH === 0} title="Add explicit hydrogens to this atom">
          Add {implicitH || ""} H
        </button>
        <button type="button" className="btn btn-danger" onClick={() => onDeleteAtom(atomId)}>
          Delete atom
        </button>
      </div>
    </>
  );
}

function BondDetails({ molecule, bondId, stereo, onSetBondOrder, onDeleteBond, onFlipBond, onRotateBond }: InspectorProps & { bondId: string }) {
  const [step, setStep] = useState(30);
  const bond = getBond(molecule, bondId);
  if (!bond) return null;
  const a = getAtom(molecule, bond.atomA);
  const b = getAtom(molecule, bond.atomB);
  const ez = stereo?.bonds.find((x) => x.bondId === bondId)?.label;
  const inRing = bondInRing(molecule, bondId);
  return (
    <>
      <Row label="Bond" value={bond.id} />
      <Row label="Atoms" value={`${a?.element ?? "?"}${bond.atomA} — ${b?.element ?? "?"}${bond.atomB}`} />
      {ez && (
        <div className="row">
          <span className="row-label">Configuration (CIP)</span>
          <span className="row-value">
            <span className="mono">{ez}</span>{" "}
            <button type="button" className="btn btn-small" id="btn-flip-ez" onClick={() => onFlipBond(bondId)} disabled={inRing} title="Rotate one side by 180° to swap E and Z">
              Flip E/Z
            </button>
          </span>
        </div>
      )}
      {!inRing && bond.order === "single" && (
        <div className="field">
          <span className="field-label">Rotate around bond (torsion)</span>
          <div className="button-row">
            <button type="button" className="btn btn-small" onClick={() => onRotateBond(bondId, -step)} title="Rotate the B side counter-clockwise">
              −{step}°
            </button>
            <select className="select" value={step} onChange={(e) => setStep(Number(e.target.value))} aria-label="Rotation step">
              {[5, 15, 30, 60, 90, 120, 180].map((d) => (
                <option key={d} value={d}>
                  {d}°
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-small" onClick={() => onRotateBond(bondId, step)} title="Rotate the B side clockwise">
              +{step}°
            </button>
          </div>
        </div>
      )}
      <div className="field">
        <span className="field-label">Order (value {bondOrderValue(bond.order)})</span>
        <div className="seg" role="radiogroup" aria-label="Bond order">
          {ORDERS.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={bond.order === o} className={`seg-item ${bond.order === o ? "active" : ""}`} onClick={() => onSetBondOrder(bondId, o)}>
              {o}
            </button>
          ))}
        </div>
      </div>
      {bond.stereo && <Row label="Stereo" value={bond.stereo} />}
      {a && b && <Row label="Length" value={`${distance(a.position, b.position).toFixed(3)} Å`} />}
      <button type="button" className="btn btn-danger btn-block" onClick={() => onDeleteBond(bondId)}>
        Delete bond
      </button>
    </>
  );
}
