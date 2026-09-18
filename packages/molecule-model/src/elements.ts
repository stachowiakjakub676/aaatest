/**
 * Periodic table data used by the domain model.
 *
 * Sources:
 *  - Standard atomic weights: IUPAC 2021 abridged conventional values (4–5 significant figures).
 *    Elements without a stable isotope carry the mass number of the longest-lived isotope and
 *    are flagged `weightIsMassNumber: true`; molecular weights containing them are approximate.
 *  - Covalent radii: Cordero et al., Dalton Trans. 2008 (single-bond radii, Å). Where the
 *    table has no value, `covalentRadius` is undefined and callers fall back to DEFAULT_COVALENT_RADIUS.
 *  - Colours: Jmol/CPK colour convention.
 *  - Valence rules: a deliberately small, documented subset used only for *client-side*
 *    structural sanity checks. Authoritative valence / aromaticity checking is delegated to
 *    RDKit in the chemistry core.
 */

export interface ElementData {
  symbol: string;
  name: string;
  atomicNumber: number;
  /** g/mol */
  atomicWeight: number;
  weightIsMassNumber?: boolean;
  /** Å */
  covalentRadius?: number;
  /** Hex RGB, e.g. 0x909090 */
  color: number;
  /**
   * Allowed total bond-order sums for a neutral atom, ascending (e.g. S: [2, 4, 6]).
   * Undefined = not checked client-side (metals, noble gases beyond He/Ne, etc.).
   */
  valences?: readonly number[];
  /** Periodic-table group (1–18) for charge-adjusted valence rules. */
  group?: number;
}

export const DEFAULT_COVALENT_RADIUS = 1.5;
export const UNKNOWN_ELEMENT_COLOR = 0xff1493;

// prettier-ignore
const RAW: ReadonlyArray<[number, string, string, number, number | undefined, number, (readonly number[]) | undefined, number | undefined, boolean?]> = [
  // Z, symbol, name, weight, covalentRadius, color, valences, group, weightIsMassNumber
  [1,  "H",  "Hydrogen",     1.008,   0.31, 0xffffff, [1],        1],
  [2,  "He", "Helium",       4.0026,  0.28, 0xd9ffff, [0],       18],
  [3,  "Li", "Lithium",      6.94,    1.28, 0xcc80ff, undefined,  1],
  [4,  "Be", "Beryllium",    9.0122,  0.96, 0xc2ff00, undefined,  2],
  [5,  "B",  "Boron",        10.81,   0.84, 0xffb5b5, [3],       13],
  [6,  "C",  "Carbon",       12.011,  0.76, 0x909090, [4],       14],
  [7,  "N",  "Nitrogen",     14.007,  0.71, 0x3050f8, [3],       15],
  [8,  "O",  "Oxygen",       15.999,  0.66, 0xff0d0d, [2],       16],
  [9,  "F",  "Fluorine",     18.998,  0.57, 0x90e050, [1],       17],
  [10, "Ne", "Neon",         20.180,  0.58, 0xb3e3f5, [0],       18],
  [11, "Na", "Sodium",       22.990,  1.66, 0xab5cf2, undefined,  1],
  [12, "Mg", "Magnesium",    24.305,  1.41, 0x8aff00, undefined,  2],
  [13, "Al", "Aluminium",    26.982,  1.21, 0xbfa6a6, undefined, 13],
  [14, "Si", "Silicon",      28.085,  1.11, 0xf0c8a0, [4],       14],
  [15, "P",  "Phosphorus",   30.974,  1.07, 0xff8000, [3, 5],    15],
  [16, "S",  "Sulfur",       32.06,   1.05, 0xffff30, [2, 4, 6], 16],
  [17, "Cl", "Chlorine",     35.45,   1.02, 0x1ff01f, [1],       17],
  [18, "Ar", "Argon",        39.95,   1.06, 0x80d1e3, [0],       18],
  [19, "K",  "Potassium",    39.098,  2.03, 0x8f40d4, undefined,  1],
  [20, "Ca", "Calcium",      40.078,  1.76, 0x3dff00, undefined,  2],
  [21, "Sc", "Scandium",     44.956,  1.70, 0xe6e6e6, undefined,  3],
  [22, "Ti", "Titanium",     47.867,  1.60, 0xbfc2c7, undefined,  4],
  [23, "V",  "Vanadium",     50.942,  1.53, 0xa6a6ab, undefined,  5],
  [24, "Cr", "Chromium",     51.996,  1.39, 0x8a99c7, undefined,  6],
  [25, "Mn", "Manganese",    54.938,  1.39, 0x9c7ac7, undefined,  7],
  [26, "Fe", "Iron",         55.845,  1.32, 0xe06633, undefined,  8],
  [27, "Co", "Cobalt",       58.933,  1.26, 0xf090a0, undefined,  9],
  [28, "Ni", "Nickel",       58.693,  1.24, 0x50d050, undefined, 10],
  [29, "Cu", "Copper",       63.546,  1.32, 0xc88033, undefined, 11],
  [30, "Zn", "Zinc",         65.38,   1.22, 0x7d80b0, undefined, 12],
  [31, "Ga", "Gallium",      69.723,  1.22, 0xc28f8f, undefined, 13],
  [32, "Ge", "Germanium",    72.630,  1.20, 0x668f8f, [4],       14],
  [33, "As", "Arsenic",      74.922,  1.19, 0xbd80e3, [3, 5],    15],
  [34, "Se", "Selenium",     78.971,  1.20, 0xffa100, [2, 4, 6], 16],
  [35, "Br", "Bromine",      79.904,  1.20, 0xa62929, [1],       17],
  [36, "Kr", "Krypton",      83.798,  1.16, 0x5cb8d1, undefined, 18],
  [37, "Rb", "Rubidium",     85.468,  2.20, 0x702eb0, undefined,  1],
  [38, "Sr", "Strontium",    87.62,   1.95, 0x00ff00, undefined,  2],
  [39, "Y",  "Yttrium",      88.906,  1.90, 0x94ffff, undefined,  3],
  [40, "Zr", "Zirconium",    91.224,  1.75, 0x94e0e0, undefined,  4],
  [41, "Nb", "Niobium",      92.906,  1.64, 0x73c2c9, undefined,  5],
  [42, "Mo", "Molybdenum",   95.95,   1.54, 0x54b5b5, undefined,  6],
  [43, "Tc", "Technetium",   98,      1.47, 0x3b9e9e, undefined,  7, true],
  [44, "Ru", "Ruthenium",    101.07,  1.46, 0x248f8f, undefined,  8],
  [45, "Rh", "Rhodium",      102.91,  1.42, 0x0a7d8c, undefined,  9],
  [46, "Pd", "Palladium",    106.42,  1.39, 0x006985, undefined, 10],
  [47, "Ag", "Silver",       107.87,  1.45, 0xc0c0c0, undefined, 11],
  [48, "Cd", "Cadmium",      112.41,  1.44, 0xffd98f, undefined, 12],
  [49, "In", "Indium",       114.82,  1.42, 0xa67573, undefined, 13],
  [50, "Sn", "Tin",          118.71,  1.39, 0x668080, undefined, 14],
  [51, "Sb", "Antimony",     121.76,  1.39, 0x9e63b5, [3, 5],    15],
  [52, "Te", "Tellurium",    127.60,  1.38, 0xd47a00, [2, 4, 6], 16],
  [53, "I",  "Iodine",       126.90,  1.39, 0x940094, [1],       17],
  [54, "Xe", "Xenon",        131.29,  1.40, 0x429eb0, undefined, 18],
  [55, "Cs", "Caesium",      132.91,  2.44, 0x57178f, undefined,  1],
  [56, "Ba", "Barium",       137.33,  2.15, 0x00c900, undefined,  2],
  [57, "La", "Lanthanum",    138.91,  2.07, 0x70d4ff, undefined,  3],
  [58, "Ce", "Cerium",       140.12,  2.04, 0xffffc7, undefined,  undefined],
  [59, "Pr", "Praseodymium", 140.91,  2.03, 0xd9ffc7, undefined,  undefined],
  [60, "Nd", "Neodymium",    144.24,  2.01, 0xc7ffc7, undefined,  undefined],
  [61, "Pm", "Promethium",   145,     1.99, 0xa3ffc7, undefined,  undefined, true],
  [62, "Sm", "Samarium",     150.36,  1.98, 0x8fffc7, undefined,  undefined],
  [63, "Eu", "Europium",     151.96,  1.98, 0x61ffc7, undefined,  undefined],
  [64, "Gd", "Gadolinium",   157.25,  1.96, 0x45ffc7, undefined,  undefined],
  [65, "Tb", "Terbium",      158.93,  1.94, 0x30ffc7, undefined,  undefined],
  [66, "Dy", "Dysprosium",   162.50,  1.92, 0x1fffc7, undefined,  undefined],
  [67, "Ho", "Holmium",      164.93,  1.92, 0x00ff9c, undefined,  undefined],
  [68, "Er", "Erbium",       167.26,  1.89, 0x00e675, undefined,  undefined],
  [69, "Tm", "Thulium",      168.93,  1.90, 0x00d452, undefined,  undefined],
  [70, "Yb", "Ytterbium",    173.05,  1.87, 0x00bf38, undefined,  undefined],
  [71, "Lu", "Lutetium",     174.97,  1.87, 0x00ab24, undefined,  3],
  [72, "Hf", "Hafnium",      178.49,  1.75, 0x4dc2ff, undefined,  4],
  [73, "Ta", "Tantalum",     180.95,  1.70, 0x4da6ff, undefined,  5],
  [74, "W",  "Tungsten",     183.84,  1.62, 0x2194d6, undefined,  6],
  [75, "Re", "Rhenium",      186.21,  1.51, 0x267dab, undefined,  7],
  [76, "Os", "Osmium",       190.23,  1.44, 0x266696, undefined,  8],
  [77, "Ir", "Iridium",      192.22,  1.41, 0x175487, undefined,  9],
  [78, "Pt", "Platinum",     195.08,  1.36, 0xd0d0e0, undefined, 10],
  [79, "Au", "Gold",         196.97,  1.36, 0xffd123, undefined, 11],
  [80, "Hg", "Mercury",      200.59,  1.32, 0xb8b8d0, undefined, 12],
  [81, "Tl", "Thallium",     204.38,  1.45, 0xa6544d, undefined, 13],
  [82, "Pb", "Lead",         207.2,   1.46, 0x575961, undefined, 14],
  [83, "Bi", "Bismuth",      208.98,  1.48, 0x9e4fb5, undefined, 15],
  [84, "Po", "Polonium",     209,     1.40, 0xab5c00, undefined, 16, true],
  [85, "At", "Astatine",     210,     1.50, 0x754f45, undefined, 17, true],
  [86, "Rn", "Radon",        222,     1.50, 0x428296, undefined, 18, true],
  [87, "Fr", "Francium",     223,     2.60, 0x420066, undefined,  1, true],
  [88, "Ra", "Radium",       226,     2.21, 0x007d00, undefined,  2, true],
  [89, "Ac", "Actinium",     227,     2.15, 0x70abfa, undefined,  3, true],
  [90, "Th", "Thorium",      232.04,  2.06, 0x00baff, undefined,  undefined],
  [91, "Pa", "Protactinium", 231.04,  2.00, 0x00a1ff, undefined,  undefined],
  [92, "U",  "Uranium",      238.03,  1.96, 0x008fff, undefined,  undefined],
  [93, "Np", "Neptunium",    237,     1.90, 0x0080ff, undefined,  undefined, true],
  [94, "Pu", "Plutonium",    244,     1.87, 0x006bff, undefined,  undefined, true],
  [95, "Am", "Americium",    243,     1.80, 0x545cf2, undefined,  undefined, true],
  [96, "Cm", "Curium",       247,     1.69, 0x785ce3, undefined,  undefined, true],
  [97, "Bk", "Berkelium",    247,     undefined, 0x8a4fe3, undefined, undefined, true],
  [98, "Cf", "Californium",  251,     undefined, 0xa136d4, undefined, undefined, true],
  [99, "Es", "Einsteinium",  252,     undefined, 0xb31fd4, undefined, undefined, true],
  [100,"Fm", "Fermium",      257,     undefined, 0xb31fba, undefined, undefined, true],
  [101,"Md", "Mendelevium",  258,     undefined, 0xb30da6, undefined, undefined, true],
  [102,"No", "Nobelium",     259,     undefined, 0xbd0d87, undefined, undefined, true],
  [103,"Lr", "Lawrencium",   266,     undefined, 0xc70066, undefined, 3, true],
  [104,"Rf", "Rutherfordium",267,     undefined, 0xcc0059, undefined, 4, true],
  [105,"Db", "Dubnium",      268,     undefined, 0xd1004f, undefined, 5, true],
  [106,"Sg", "Seaborgium",   269,     undefined, 0xd90045, undefined, 6, true],
  [107,"Bh", "Bohrium",      270,     undefined, 0xe00038, undefined, 7, true],
  [108,"Hs", "Hassium",      269,     undefined, 0xe6002e, undefined, 8, true],
  [109,"Mt", "Meitnerium",   278,     undefined, 0xeb0026, undefined, 9, true],
  [110,"Ds", "Darmstadtium", 281,     undefined, 0xeb0026, undefined, 10, true],
  [111,"Rg", "Roentgenium",  282,     undefined, 0xeb0026, undefined, 11, true],
  [112,"Cn", "Copernicium",  285,     undefined, 0xeb0026, undefined, 12, true],
  [113,"Nh", "Nihonium",     286,     undefined, 0xeb0026, undefined, 13, true],
  [114,"Fl", "Flerovium",    289,     undefined, 0xeb0026, undefined, 14, true],
  [115,"Mc", "Moscovium",    290,     undefined, 0xeb0026, undefined, 15, true],
  [116,"Lv", "Livermorium",  293,     undefined, 0xeb0026, undefined, 16, true],
  [117,"Ts", "Tennessine",   294,     undefined, 0xeb0026, undefined, 17, true],
  [118,"Og", "Oganesson",    294,     undefined, 0xeb0026, undefined, 18, true],
];

export const ELEMENTS: ReadonlyArray<ElementData> = RAW.map(
  ([atomicNumber, symbol, name, atomicWeight, covalentRadius, color, valences, group, weightIsMassNumber]) => {
    const e: ElementData = { symbol, name, atomicNumber, atomicWeight, color };
    if (covalentRadius !== undefined) e.covalentRadius = covalentRadius;
    if (valences !== undefined) e.valences = valences;
    if (group !== undefined) e.group = group;
    if (weightIsMassNumber) e.weightIsMassNumber = true;
    return e;
  },
);

const BY_SYMBOL: ReadonlyMap<string, ElementData> = new Map(ELEMENTS.map((e) => [e.symbol, e]));

/** Case-sensitive lookup by IUPAC symbol. */
export function getElement(symbol: string): ElementData | undefined {
  return BY_SYMBOL.get(symbol);
}

export function isKnownElement(symbol: string): boolean {
  return BY_SYMBOL.has(symbol);
}

export function elementColor(symbol: string): number {
  return getElement(symbol)?.color ?? UNKNOWN_ELEMENT_COLOR;
}

export function covalentRadius(symbol: string): number {
  return getElement(symbol)?.covalentRadius ?? DEFAULT_COVALENT_RADIUS;
}

/**
 * Charge-adjusted allowed valences for the client-side sanity check.
 * Rules (documented simplification of the RDKit approach):
 *  - groups 15–17 (N, O, F, P, S, ...): valence + charge  (N⁺ → 4, O⁻ → 1)
 *  - group 14 (C, Si, ...):             valence − |charge| (C⁺ → 3, C⁻ → 3)
 *  - group 13 (B, Al, ...):             valence − charge   (B⁻ → 4)
 *  - hydrogen:                          1 − |charge|       (H⁺, H⁻ → 0)
 * Returns undefined when the element is not checked client-side.
 */
export function allowedValences(symbol: string, formalCharge: number): number[] | undefined {
  const e = getElement(symbol);
  if (!e?.valences || e.group === undefined) return undefined;
  let adjust: (v: number) => number;
  if (e.atomicNumber === 1) adjust = (v) => v - Math.abs(formalCharge);
  else if (e.group >= 15) adjust = (v) => v + formalCharge;
  else if (e.group === 14) adjust = (v) => v - Math.abs(formalCharge);
  else if (e.group === 13) adjust = (v) => v - formalCharge;
  else adjust = (v) => v;
  return e.valences.map(adjust).filter((v) => v >= 0);
}

/** Van der Waals radii (Å): Bondi 1964 / Mantina 2009 for common elements; others fall back. */
const VDW: Readonly<Record<string, number>> = {
  H: 1.1, He: 1.4, Li: 1.82, Be: 1.53, B: 1.92, C: 1.7, N: 1.55, O: 1.52, F: 1.47, Ne: 1.54,
  Na: 2.27, Mg: 1.73, Al: 1.84, Si: 2.1, P: 1.8, S: 1.8, Cl: 1.75, Ar: 1.88, K: 2.75, Ca: 2.31,
  Ni: 1.63, Cu: 1.4, Zn: 1.39, Ga: 1.87, Ge: 2.11, As: 1.85, Se: 1.9, Br: 1.85, Kr: 2.02,
  Ag: 1.72, Cd: 1.58, In: 1.93, Sn: 2.17, Sb: 2.06, Te: 2.06, I: 1.98, Xe: 2.16,
  Pt: 1.75, Au: 1.66, Hg: 1.55, Tl: 1.96, Pb: 2.02, Bi: 2.07, U: 1.86,
};
export const DEFAULT_VDW_RADIUS = 2.0;

export function vdwRadius(symbol: string): number {
  return VDW[symbol] ?? DEFAULT_VDW_RADIUS;
}
