/**
 * Core molecular domain types.
 *
 * Design rules:
 *  - Plain, JSON-serialisable data. No classes, no references to UI or rendering.
 *  - A Molecule is a labelled graph: atoms are nodes, bonds are edges.
 *  - Atoms carry the coordinates of the *active* conformer. Additional conformers
 *    can be stored separately (see Conformer) and swapped in with applyConformer().
 *  - All operations on molecules are pure functions returning new objects (see molecule.ts),
 *    which makes undo/redo and change tracking trivial for the editor layer.
 */

export type AtomId = string;
export type BondId = string;

/** Cartesian coordinates in Ångström. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Bond order. Aromatic bonds are kept as an explicit variant because Kekulé assignment is
 * not always unique; a Kekulé structure can still be expressed with single/double.
 */
export type BondOrder = "single" | "double" | "triple" | "aromatic";

/**
 * Local tetrahedral chirality tag as stored in the model.
 * `unspecified` means the user explicitly marked the centre as undefined (racemic / unknown).
 * CIP labels (R/S) are *derived* from coordinates + graph by the chemistry engine and are
 * not stored here to avoid the model contradicting itself.
 */
export type AtomChirality = "clockwise" | "counterclockwise" | "unspecified";

/**
 * Bond stereo annotation.
 *  - wedge_up / wedge_down: 2D depiction wedges (atomA is the narrow end).
 *  - either: explicitly unknown configuration.
 *  - E / Z: user-declared double bond configuration (engine may recompute from 3D).
 */
export type BondStereo = "wedge_up" | "wedge_down" | "either" | "E" | "Z";

export interface Atom {
  id: AtomId;
  /** Element symbol, e.g. "C", "Cl". Case-sensitive, IUPAC symbol. */
  element: string;
  formalCharge: number;
  position: Vec3;
  /** Mass number (e.g. 13 for 13C). Undefined = natural abundance mixture. */
  isotope?: number;
  chirality?: AtomChirality;
  /**
   * Explicitly set implicit hydrogen count. When undefined the count is derived from
   * standard valence rules (see formula.ts / the chemistry engine).
   */
  implicitHydrogens?: number;
}

export interface Bond {
  id: BondId;
  atomA: AtomId;
  atomB: AtomId;
  order: BondOrder;
  stereo?: BondStereo;
}

/** A named set of coordinates for every atom of a molecule. */
export interface Conformer {
  id: string;
  name?: string;
  /** Energy in kcal/mol if known (COMPUTED by an engine; never guessed). */
  energy?: number;
  positions: Record<AtomId, Vec3>;
}

export type MetadataValue = string | number | boolean;

export interface Molecule {
  /** Schema version of the serialised format. Bump on breaking changes. */
  schemaVersion: 1;
  id: string;
  name?: string;
  atoms: Atom[];
  bonds: Bond[];
  conformers?: Conformer[];
  metadata: Record<string, MetadataValue>;
}
