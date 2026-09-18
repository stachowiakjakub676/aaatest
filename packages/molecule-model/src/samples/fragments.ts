// GENERATED FILE - do not edit by hand.
// Source: packages/chem-core/scripts/generate_fragments.py (RDKit ETKDGv3, seed 42, MMFF94).
import type { Molecule } from "../types";

export interface FragmentTemplate {
  id: string;
  name: string;
  category: "alkyl" | "ring" | "group" | "halogen";
  smiles: string;
  /** Atom whose hydrogen is replaced by the bond to the anchor. */
  attachAtomId: string;
  molecule: Molecule;
}

export const FRAGMENTS: readonly FragmentTemplate[] = [
  {
    "id": "methyl",
    "name": "Methyl",
    "category": "alkyl",
    "smiles": "C",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-methyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.6753,
            "y": 0.8541,
            "z": -0.0854
          }
        },
        {
          "id": "a3",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.3949,
            "y": -0.8359,
            "z": -0.5815
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.0848,
            "y": -0.2937,
            "z": 1.0485
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.9855,
            "y": 0.2756,
            "z": -0.3817
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a1",
          "atomB": "a5",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C"
      },
      "name": "Methyl"
    }
  },
  {
    "id": "ethyl",
    "name": "Ethyl",
    "category": "alkyl",
    "smiles": "CC",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-ethyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.5116,
            "y": -0.0142,
            "z": 0.033
          }
        },
        {
          "id": "a3",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.4075,
            "y": -0.1075,
            "z": 1.0096
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.3664,
            "y": 0.941,
            "z": -0.421
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.3788,
            "y": -0.8227,
            "z": -0.6138
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.8904,
            "y": 0.8085,
            "z": 0.6468
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.9192,
            "y": 0.0933,
            "z": -0.9766
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.8781,
            "y": -0.9552,
            "z": 0.454
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a1",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a2",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a2",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a2",
          "atomB": "a8",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "CC"
      },
      "name": "Ethyl"
    }
  },
  {
    "id": "isopropyl",
    "name": "Isopropyl",
    "category": "alkyl",
    "smiles": "C(C)C",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-isopropyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.2329,
            "y": -0.8635,
            "z": 0.2067
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.28,
            "y": -0.7868,
            "z": 0.2257
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.0046,
            "y": 0.4047,
            "z": -1.0181
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.0312,
            "y": 0.8512,
            "z": 0.6891
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.2416,
            "y": -1.7081,
            "z": -0.4897
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.1405,
            "y": -0.2753,
            "z": 0.0387
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.2683,
            "y": -1.2591,
            "z": 1.2268
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.324,
            "y": -1.18,
            "z": 1.2464
          }
        },
        {
          "id": "a10",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.3507,
            "y": -1.629,
            "z": -0.4701
          }
        },
        {
          "id": "a11",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.1524,
            "y": -0.1443,
            "z": 0.0712
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a1",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a2",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a2",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a2",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a3",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a3",
          "atomB": "a10",
          "order": "single"
        },
        {
          "id": "b10",
          "atomA": "a3",
          "atomB": "a11",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C(C)C"
      },
      "name": "Isopropyl"
    }
  },
  {
    "id": "tert-butyl",
    "name": "tert-Butyl",
    "category": "alkyl",
    "smiles": "C(C)(C)C",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-tert-butyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.2896,
            "y": 1.1123,
            "z": 1.0055
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.3888,
            "y": -0.5894,
            "z": 0.2364
          }
        },
        {
          "id": "a4",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.0668,
            "y": -1.0895,
            "z": 0.0825
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.0247,
            "y": 0.4313,
            "z": -1.0082
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.4575,
            "y": 1.9094,
            "z": 0.929
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.2731,
            "y": 1.5569,
            "z": 0.8205
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.2769,
            "y": 0.7337,
            "z": 2.0333
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.468,
            "y": -1.0354,
            "z": 1.2337
          }
        },
        {
          "id": "a10",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.1591,
            "y": 0.1841,
            "z": 0.1492
          }
        },
        {
          "id": "a11",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.6114,
            "y": -1.3676,
            "z": -0.5012
          }
        },
        {
          "id": "a12",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.085,
            "y": -1.5554,
            "z": 1.0737
          }
        },
        {
          "id": "a13",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.0612,
            "y": -0.6755,
            "z": -0.1153
          }
        },
        {
          "id": "a14",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.8784,
            "y": -1.8747,
            "z": -0.6573
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a1",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a2",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a2",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a2",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a3",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a3",
          "atomB": "a10",
          "order": "single"
        },
        {
          "id": "b10",
          "atomA": "a3",
          "atomB": "a11",
          "order": "single"
        },
        {
          "id": "b11",
          "atomA": "a4",
          "atomB": "a12",
          "order": "single"
        },
        {
          "id": "b12",
          "atomA": "a4",
          "atomB": "a13",
          "order": "single"
        },
        {
          "id": "b13",
          "atomA": "a4",
          "atomB": "a14",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C(C)(C)C"
      },
      "name": "tert-Butyl"
    }
  },
  {
    "id": "vinyl",
    "name": "Vinyl",
    "category": "alkyl",
    "smiles": "C=C",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-vinyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.3031,
            "y": -0.0339,
            "z": -0.2917
          }
        },
        {
          "id": "a3",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.6051,
            "y": -0.9005,
            "z": -0.0345
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.4873,
            "y": 0.929,
            "z": 0.2791
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.7904,
            "y": -0.9629,
            "z": -0.5708
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.9082,
            "y": 0.8666,
            "z": -0.2572
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a2",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a2",
          "atomB": "a6",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C=C"
      },
      "name": "Vinyl"
    }
  },
  {
    "id": "ethynyl",
    "name": "Ethynyl",
    "category": "alkyl",
    "smiles": "C#C",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-ethynyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.1939,
            "y": -0.1222,
            "z": -0.0193
          }
        },
        {
          "id": "a3",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.0601,
            "y": 0.1085,
            "z": 0.0171
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.254,
            "y": -0.2307,
            "z": -0.0365
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "triple"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a2",
          "atomB": "a4",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C#C"
      },
      "name": "Ethynyl"
    }
  },
  {
    "id": "cyclopropyl",
    "name": "Cyclopropyl",
    "category": "ring",
    "smiles": "C1CC1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-cyclopropyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.3475,
            "y": 1.4589,
            "z": -0.0877
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.4328,
            "y": 0.4386,
            "z": 0.1069
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.4926,
            "y": -0.3526,
            "z": 0.8988
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.3114,
            "y": -0.5043,
            "z": -0.9075
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.0903,
            "y": 2.0945,
            "z": 0.7517
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.2715,
            "y": 1.9428,
            "z": -1.0545
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.092,
            "y": 0.2314,
            "z": -0.7281
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.9108,
            "y": 0.3831,
            "z": 1.0781
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a1",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a1",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a2",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a2",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a3",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a3",
          "atomB": "a9",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C1CC1"
      },
      "name": "Cyclopropyl"
    }
  },
  {
    "id": "cyclopentyl",
    "name": "Cyclopentyl",
    "category": "ring",
    "smiles": "C1CCCC1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-cyclopentyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.372,
            "y": -0.5301,
            "z": -0.3871
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.3496,
            "y": -1.9593,
            "z": 0.1259
          }
        },
        {
          "id": "a4",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -0.051,
            "y": -2.4344,
            "z": -0.2292
          }
        },
        {
          "id": "a5",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -0.9411,
            "y": -1.199,
            "z": -0.104
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.0185,
            "y": 0.364,
            "z": 1.0343
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.3162,
            "y": 0.8308,
            "z": -0.638
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.4877,
            "y": -0.5197,
            "z": -1.4773
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.1837,
            "y": 0.0585,
            "z": 0.0497
          }
        },
        {
          "id": "a10",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.4899,
            "y": -1.9749,
            "z": 1.2132
          }
        },
        {
          "id": "a11",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.127,
            "y": -2.5795,
            "z": -0.3291
          }
        },
        {
          "id": "a12",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.0707,
            "y": -2.7984,
            "z": -1.2635
          }
        },
        {
          "id": "a13",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.3851,
            "y": -3.2523,
            "z": 0.4162
          }
        },
        {
          "id": "a14",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.5985,
            "y": -1.112,
            "z": -0.9759
          }
        },
        {
          "id": "a15",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.5811,
            "y": -1.2603,
            "z": 0.7829
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a1",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a1",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a1",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a2",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a2",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b10",
          "atomA": "a3",
          "atomB": "a10",
          "order": "single"
        },
        {
          "id": "b11",
          "atomA": "a3",
          "atomB": "a11",
          "order": "single"
        },
        {
          "id": "b12",
          "atomA": "a4",
          "atomB": "a12",
          "order": "single"
        },
        {
          "id": "b13",
          "atomA": "a4",
          "atomB": "a13",
          "order": "single"
        },
        {
          "id": "b14",
          "atomA": "a5",
          "atomB": "a14",
          "order": "single"
        },
        {
          "id": "b15",
          "atomA": "a5",
          "atomB": "a15",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C1CCCC1"
      },
      "name": "Cyclopentyl"
    }
  },
  {
    "id": "cyclohexyl",
    "name": "Cyclohexyl",
    "category": "ring",
    "smiles": "C1CCCCC1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-cyclohexyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.1262,
            "y": 1.0308,
            "z": 0.1021
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.6352,
            "y": 2.4454,
            "z": 0.4172
          }
        },
        {
          "id": "a4",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -0.7687,
            "y": 2.691,
            "z": -0.1185
          }
        },
        {
          "id": "a5",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.7872,
            "y": 1.7221,
            "z": 0.486
          }
        },
        {
          "id": "a6",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.1883,
            "y": 0.3694,
            "z": 0.8773
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.333,
            "y": -0.0717,
            "z": -1.0432
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.3819,
            "y": -0.9901,
            "z": 0.2735
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.8393,
            "y": 0.7263,
            "z": 0.8778
          }
        },
        {
          "id": "a10",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.6856,
            "y": 1.0335,
            "z": -0.8414
          }
        },
        {
          "id": "a11",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.3352,
            "y": 3.1788,
            "z": 0.0012
          }
        },
        {
          "id": "a12",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.6357,
            "y": 2.5959,
            "z": 1.5043
          }
        },
        {
          "id": "a13",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.0781,
            "y": 3.7227,
            "z": 0.0833
          }
        },
        {
          "id": "a14",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.7614,
            "y": 2.5757,
            "z": -1.2098
          }
        },
        {
          "id": "a15",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.6005,
            "y": 1.5736,
            "z": -0.2347
          }
        },
        {
          "id": "a16",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.2463,
            "y": 2.1724,
            "z": 1.3744
          }
        },
        {
          "id": "a17",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.8632,
            "y": 0.4059,
            "z": 1.9248
          }
        },
        {
          "id": "a18",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.9608,
            "y": -0.4056,
            "z": 0.8181
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a6",
          "atomB": "a1",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a1",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a1",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a2",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b10",
          "atomA": "a2",
          "atomB": "a10",
          "order": "single"
        },
        {
          "id": "b11",
          "atomA": "a3",
          "atomB": "a11",
          "order": "single"
        },
        {
          "id": "b12",
          "atomA": "a3",
          "atomB": "a12",
          "order": "single"
        },
        {
          "id": "b13",
          "atomA": "a4",
          "atomB": "a13",
          "order": "single"
        },
        {
          "id": "b14",
          "atomA": "a4",
          "atomB": "a14",
          "order": "single"
        },
        {
          "id": "b15",
          "atomA": "a5",
          "atomB": "a15",
          "order": "single"
        },
        {
          "id": "b16",
          "atomA": "a5",
          "atomB": "a16",
          "order": "single"
        },
        {
          "id": "b17",
          "atomA": "a6",
          "atomB": "a17",
          "order": "single"
        },
        {
          "id": "b18",
          "atomA": "a6",
          "atomB": "a18",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C1CCCCC1"
      },
      "name": "Cyclohexyl"
    }
  },
  {
    "id": "phenyl",
    "name": "Phenyl",
    "category": "ring",
    "smiles": "c1ccccc1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-phenyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.5853,
            "y": 1.2659,
            "z": -0.0199
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -0.2182,
            "y": 2.406,
            "z": -0.0116
          }
        },
        {
          "id": "a4",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.607,
            "y": 2.2802,
            "z": 0.0165
          }
        },
        {
          "id": "a5",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -2.1924,
            "y": 1.0143,
            "z": 0.0364
          }
        },
        {
          "id": "a6",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.3889,
            "y": -0.1258,
            "z": 0.0281
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.626,
            "y": -0.8883,
            "z": -0.0064
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.6674,
            "y": 1.3639,
            "z": -0.0418
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.2379,
            "y": 3.3923,
            "z": -0.0271
          }
        },
        {
          "id": "a10",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.233,
            "y": 3.1685,
            "z": 0.0229
          }
        },
        {
          "id": "a11",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -3.2744,
            "y": 0.9163,
            "z": 0.0583
          }
        },
        {
          "id": "a12",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.8449,
            "y": -1.1121,
            "z": 0.0436
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "double"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "double"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a6",
          "atomB": "a1",
          "order": "double"
        },
        {
          "id": "b7",
          "atomA": "a1",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a2",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a3",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b10",
          "atomA": "a4",
          "atomB": "a10",
          "order": "single"
        },
        {
          "id": "b11",
          "atomA": "a5",
          "atomB": "a11",
          "order": "single"
        },
        {
          "id": "b12",
          "atomA": "a6",
          "atomB": "a12",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "c1ccccc1"
      },
      "name": "Phenyl"
    }
  },
  {
    "id": "pyridin-2-yl",
    "name": "Pyridin-2-yl",
    "category": "ring",
    "smiles": "c1ccccn1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-pyridin-2-yl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -0.4196,
            "y": 1.3176,
            "z": 0.0913
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.5491,
            "y": 2.314,
            "z": 0.1517
          }
        },
        {
          "id": "a4",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.8938,
            "y": 1.9595,
            "z": 0.1189
          }
        },
        {
          "id": "a5",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 2.2151,
            "y": 0.6146,
            "z": 0.0264
          }
        },
        {
          "id": "a6",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": 1.2974,
            "y": -0.3749,
            "z": -0.0339
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.7178,
            "y": -0.8136,
            "z": -0.0498
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.4756,
            "y": 1.5609,
            "z": 0.1148
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.2586,
            "y": 3.358,
            "z": 0.2238
          }
        },
        {
          "id": "a10",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.6727,
            "y": 2.7119,
            "z": 0.1641
          }
        },
        {
          "id": "a11",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 3.2504,
            "y": 0.2874,
            "z": -0.0025
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "double"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "double"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a6",
          "atomB": "a1",
          "order": "double"
        },
        {
          "id": "b7",
          "atomA": "a1",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a2",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a3",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b10",
          "atomA": "a4",
          "atomB": "a10",
          "order": "single"
        },
        {
          "id": "b11",
          "atomA": "a5",
          "atomB": "a11",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "c1ccccn1"
      },
      "name": "Pyridin-2-yl"
    }
  },
  {
    "id": "pyridin-4-yl",
    "name": "Pyridin-4-yl",
    "category": "ring",
    "smiles": "c1ccncc1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-pyridin-4-yl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.1429,
            "y": -0.7928,
            "z": 0.0008
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.9859,
            "y": -2.1693,
            "z": -0.0308
          }
        },
        {
          "id": "a4",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": -0.2144,
            "y": -2.7882,
            "z": -0.0624
          }
        },
        {
          "id": "a5",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.306,
            "y": -1.9924,
            "z": -0.0624
          }
        },
        {
          "id": "a6",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.2506,
            "y": -0.608,
            "z": -0.0322
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.0833,
            "y": 1.0827,
            "z": 0.0242
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.1319,
            "y": -0.3498,
            "z": 0.0254
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.8474,
            "y": -2.8309,
            "z": -0.0316
          }
        },
        {
          "id": "a10",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.2584,
            "y": -2.5139,
            "z": -0.0881
          }
        },
        {
          "id": "a11",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.1603,
            "y": -0.0184,
            "z": -0.0337
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "double"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a6",
          "order": "double"
        },
        {
          "id": "b6",
          "atomA": "a6",
          "atomB": "a1",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a1",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a2",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a3",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b10",
          "atomA": "a5",
          "atomB": "a10",
          "order": "single"
        },
        {
          "id": "b11",
          "atomA": "a6",
          "atomB": "a11",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "c1ccncc1"
      },
      "name": "Pyridin-4-yl"
    }
  },
  {
    "id": "furan-2-yl",
    "name": "Furan-2-yl",
    "category": "ring",
    "smiles": "c1ccoc1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-furan-2-yl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.1961,
            "y": 0.7531,
            "z": -0.0846
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 2.1935,
            "y": -0.1454,
            "z": -0.3845
          }
        },
        {
          "id": "a4",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": 1.6854,
            "y": -1.4007,
            "z": -0.4891
          }
        },
        {
          "id": "a5",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.3511,
            "y": -1.3054,
            "z": -0.2542
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.9947,
            "y": 0.3615,
            "z": 0.2188
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.3182,
            "y": 1.8178,
            "z": 0.0552
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 3.2586,
            "y": -0.0577,
            "z": -0.5474
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.1991,
            "y": -2.2347,
            "z": -0.3029
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "double"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a1",
          "order": "double"
        },
        {
          "id": "b6",
          "atomA": "a1",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a2",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a3",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a5",
          "atomB": "a9",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "c1ccoc1"
      },
      "name": "Furan-2-yl"
    }
  },
  {
    "id": "thiophen-2-yl",
    "name": "Thiophen-2-yl",
    "category": "ring",
    "smiles": "c1cccs1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-thiophen-2-yl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -0.6715,
            "y": -1.203,
            "z": -0.0062
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -2.0667,
            "y": -1.0374,
            "z": 0.2325
          }
        },
        {
          "id": "a4",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -2.4066,
            "y": 0.2857,
            "z": 0.4117
          }
        },
        {
          "id": "a5",
          "element": "S",
          "formalCharge": 0,
          "position": {
            "x": -1.0487,
            "y": 1.3208,
            "z": 0.2923
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.0568,
            "y": 0.1702,
            "z": -0.1529
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.1846,
            "y": -2.1558,
            "z": -0.174
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.785,
            "y": -1.8471,
            "z": 0.2709
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -3.387,
            "y": 0.6978,
            "z": 0.6074
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "double"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a1",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a1",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a2",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a3",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a4",
          "atomB": "a9",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "c1cccs1"
      },
      "name": "Thiophen-2-yl"
    }
  },
  {
    "id": "pyrrol-2-yl",
    "name": "Pyrrol-2-yl",
    "category": "ring",
    "smiles": "c1ccc[nH]1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-pyrrol-2-yl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -0.8622,
            "y": 1.0707,
            "z": 0.0818
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -2.1772,
            "y": 0.55,
            "z": 0.1372
          }
        },
        {
          "id": "a4",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -2.0776,
            "y": -0.8226,
            "z": 0.0875
          }
        },
        {
          "id": "a5",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": -0.7488,
            "y": -1.1479,
            "z": 0.0041
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.0791,
            "y": -0.0434,
            "z": -0.0606
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.5753,
            "y": 2.1141,
            "z": 0.0996
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -3.0975,
            "y": 1.1155,
            "z": 0.2059
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.8361,
            "y": -1.5936,
            "z": 0.1043
          }
        },
        {
          "id": "a10",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.3786,
            "y": -2.0883,
            "z": -0.0465
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "double"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a1",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a1",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a2",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a3",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a4",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b10",
          "atomA": "a5",
          "atomB": "a10",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "c1ccc[nH]1"
      },
      "name": "Pyrrol-2-yl"
    }
  },
  {
    "id": "imidazol-1-yl",
    "name": "Imidazol-1-yl",
    "category": "ring",
    "smiles": "[nH]1ccnc1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-imidazol-1-yl",
      "atoms": [
        {
          "id": "a1",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.2031,
            "y": 0.6499,
            "z": -0.0062
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 2.1306,
            "y": -0.3204,
            "z": -0.303
          }
        },
        {
          "id": "a4",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": 1.5218,
            "y": -1.5365,
            "z": -0.476
          }
        },
        {
          "id": "a5",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.2416,
            "y": -1.3132,
            "z": -0.2879
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.9058,
            "y": 0.4092,
            "z": 0.183
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.292,
            "y": 1.7079,
            "z": 0.1939
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 3.2027,
            "y": -0.2094,
            "z": -0.4014
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.5467,
            "y": -2.0519,
            "z": -0.3459
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "double"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "double"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a1",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a1",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a2",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a3",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a5",
          "atomB": "a9",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "[nH]1ccnc1"
      },
      "name": "Imidazol-1-yl"
    }
  },
  {
    "id": "piperidin-1-yl",
    "name": "Piperidin-1-yl",
    "category": "ring",
    "smiles": "N1CCCCC1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-piperidin-1-yl",
      "atoms": [
        {
          "id": "a1",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.1038,
            "y": -0.7956,
            "z": -0.5433
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.7622,
            "y": -2.284,
            "z": -0.5905
          }
        },
        {
          "id": "a4",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -0.5236,
            "y": -2.5306,
            "z": -1.3743
          }
        },
        {
          "id": "a5",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.6496,
            "y": -1.6411,
            "z": -0.8555
          }
        },
        {
          "id": "a6",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.2157,
            "y": -0.1772,
            "z": -0.7982
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.1863,
            "y": -0.305,
            "z": 0.9557
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.9894,
            "y": -0.6452,
            "z": 0.0839
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.3644,
            "y": -0.4328,
            "z": -1.545
          }
        },
        {
          "id": "a10",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.6458,
            "y": -2.6675,
            "z": 0.4311
          }
        },
        {
          "id": "a11",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.5876,
            "y": -2.8401,
            "z": -1.0489
          }
        },
        {
          "id": "a12",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.3498,
            "y": -2.3164,
            "z": -2.4361
          }
        },
        {
          "id": "a13",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.8126,
            "y": -3.5848,
            "z": -1.3015
          }
        },
        {
          "id": "a14",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.529,
            "y": -1.7428,
            "z": -1.5013
          }
        },
        {
          "id": "a15",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.9471,
            "y": -1.9763,
            "z": 0.1461
          }
        },
        {
          "id": "a16",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.0544,
            "y": 0.212,
            "z": -1.8108
          }
        },
        {
          "id": "a17",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.0186,
            "y": 0.4233,
            "z": -0.3566
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a6",
          "atomB": "a1",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a1",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a2",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a2",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b10",
          "atomA": "a3",
          "atomB": "a10",
          "order": "single"
        },
        {
          "id": "b11",
          "atomA": "a3",
          "atomB": "a11",
          "order": "single"
        },
        {
          "id": "b12",
          "atomA": "a4",
          "atomB": "a12",
          "order": "single"
        },
        {
          "id": "b13",
          "atomA": "a4",
          "atomB": "a13",
          "order": "single"
        },
        {
          "id": "b14",
          "atomA": "a5",
          "atomB": "a14",
          "order": "single"
        },
        {
          "id": "b15",
          "atomA": "a5",
          "atomB": "a15",
          "order": "single"
        },
        {
          "id": "b16",
          "atomA": "a6",
          "atomB": "a16",
          "order": "single"
        },
        {
          "id": "b17",
          "atomA": "a6",
          "atomB": "a17",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "N1CCCCC1"
      },
      "name": "Piperidin-1-yl"
    }
  },
  {
    "id": "morpholin-4-yl",
    "name": "Morpholin-4-yl",
    "category": "ring",
    "smiles": "N1CCOCC1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-morpholin-4-yl",
      "atoms": [
        {
          "id": "a1",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.1045,
            "y": -0.6375,
            "z": -0.7372
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.9672,
            "y": -2.1671,
            "z": -0.7666
          }
        },
        {
          "id": "a4",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": -0.2858,
            "y": -2.5619,
            "z": -1.3435
          }
        },
        {
          "id": "a5",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.3703,
            "y": -1.9976,
            "z": -0.5926
          }
        },
        {
          "id": "a6",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.281,
            "y": -0.4645,
            "z": -0.5596
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.0654,
            "y": 1.0117,
            "z": -0.1065
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.115,
            "y": -0.2518,
            "z": -1.764
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.0549,
            "y": -0.3623,
            "z": -0.2687
          }
        },
        {
          "id": "a10",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.7642,
            "y": -2.5993,
            "z": -1.3798
          }
        },
        {
          "id": "a11",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.0519,
            "y": -2.5939,
            "z": 0.2401
          }
        },
        {
          "id": "a12",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.3661,
            "y": -2.4186,
            "z": 0.4201
          }
        },
        {
          "id": "a13",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.3027,
            "y": -2.3045,
            "z": -1.0771
          }
        },
        {
          "id": "a14",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.1026,
            "y": -0.0609,
            "z": 0.0408
          }
        },
        {
          "id": "a15",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.3871,
            "y": -0.0704,
            "z": -1.5777
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a6",
          "atomB": "a1",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a1",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a2",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a2",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b10",
          "atomA": "a3",
          "atomB": "a10",
          "order": "single"
        },
        {
          "id": "b11",
          "atomA": "a3",
          "atomB": "a11",
          "order": "single"
        },
        {
          "id": "b12",
          "atomA": "a5",
          "atomB": "a12",
          "order": "single"
        },
        {
          "id": "b13",
          "atomA": "a5",
          "atomB": "a13",
          "order": "single"
        },
        {
          "id": "b14",
          "atomA": "a6",
          "atomB": "a14",
          "order": "single"
        },
        {
          "id": "b15",
          "atomA": "a6",
          "atomB": "a15",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "N1CCOCC1"
      },
      "name": "Morpholin-4-yl"
    }
  },
  {
    "id": "naphthalen-2-yl",
    "name": "Naphthalen-2-yl",
    "category": "ring",
    "smiles": "c1ccc2ccccc2c1",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-naphthalen-2-yl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.051,
            "y": 1.3908,
            "z": 0.0129
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.1303,
            "y": 2.1319,
            "z": 0.0739
          }
        },
        {
          "id": "a4",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -2.3786,
            "y": 1.4901,
            "z": 0.1227
          }
        },
        {
          "id": "a5",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -3.5765,
            "y": 2.2206,
            "z": 0.1842
          }
        },
        {
          "id": "a6",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -4.8091,
            "y": 1.5671,
            "z": 0.2322
          }
        },
        {
          "id": "a7",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -4.8601,
            "y": 0.1763,
            "z": 0.2193
          }
        },
        {
          "id": "a8",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -3.6788,
            "y": -0.5647,
            "z": 0.1583
          }
        },
        {
          "id": "a9",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -2.4305,
            "y": 0.077,
            "z": 0.1095
          }
        },
        {
          "id": "a10",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.2326,
            "y": -0.6535,
            "z": 0.048
          }
        },
        {
          "id": "a11",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.9191,
            "y": -0.578,
            "z": -0.0475
          }
        },
        {
          "id": "a12",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.0101,
            "y": 1.9007,
            "z": -0.0244
          }
        },
        {
          "id": "a13",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.0703,
            "y": 3.2177,
            "z": 0.0831
          }
        },
        {
          "id": "a14",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -3.5569,
            "y": 3.3079,
            "z": 0.1952
          }
        },
        {
          "id": "a15",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -5.7282,
            "y": 2.1451,
            "z": 0.2797
          }
        },
        {
          "id": "a16",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -5.8192,
            "y": -0.3336,
            "z": 0.2566
          }
        },
        {
          "id": "a17",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -3.7388,
            "y": -1.6506,
            "z": 0.1491
          }
        },
        {
          "id": "a18",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.2522,
            "y": -1.7408,
            "z": 0.0369
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "double"
        },
        {
          "id": "b4",
          "atomA": "a4",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a5",
          "atomB": "a6",
          "order": "double"
        },
        {
          "id": "b6",
          "atomA": "a6",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a7",
          "atomB": "a8",
          "order": "double"
        },
        {
          "id": "b8",
          "atomA": "a8",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a9",
          "atomB": "a10",
          "order": "double"
        },
        {
          "id": "b10",
          "atomA": "a10",
          "atomB": "a1",
          "order": "single"
        },
        {
          "id": "b11",
          "atomA": "a9",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b12",
          "atomA": "a1",
          "atomB": "a11",
          "order": "single"
        },
        {
          "id": "b13",
          "atomA": "a2",
          "atomB": "a12",
          "order": "single"
        },
        {
          "id": "b14",
          "atomA": "a3",
          "atomB": "a13",
          "order": "single"
        },
        {
          "id": "b15",
          "atomA": "a5",
          "atomB": "a14",
          "order": "single"
        },
        {
          "id": "b16",
          "atomA": "a6",
          "atomB": "a15",
          "order": "single"
        },
        {
          "id": "b17",
          "atomA": "a7",
          "atomB": "a16",
          "order": "single"
        },
        {
          "id": "b18",
          "atomA": "a8",
          "atomB": "a17",
          "order": "single"
        },
        {
          "id": "b19",
          "atomA": "a10",
          "atomB": "a18",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "c1ccc2ccccc2c1"
      },
      "name": "Naphthalen-2-yl"
    }
  },
  {
    "id": "hydroxy",
    "name": "Hydroxy (OH)",
    "category": "group",
    "smiles": "O",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-hydroxy",
      "atoms": [
        {
          "id": "a1",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.7746,
            "y": -0.5821,
            "z": 0.0
          }
        },
        {
          "id": "a3",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.752,
            "y": -0.6111,
            "z": 0.0
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "O"
      },
      "name": "Hydroxy (OH)"
    }
  },
  {
    "id": "methoxy",
    "name": "Methoxy (OMe)",
    "category": "group",
    "smiles": "OC",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-methoxy",
      "atoms": [
        {
          "id": "a1",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.2839,
            "y": 0.5744,
            "z": 0.1609
          }
        },
        {
          "id": "a3",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.6456,
            "y": 0.6446,
            "z": 0.3363
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.0358,
            "y": -0.1269,
            "z": -0.2087
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.3428,
            "y": 1.5034,
            "z": -0.4114
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.4646,
            "y": 0.7742,
            "z": 1.22
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a2",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a2",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a2",
          "atomB": "a6",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "OC"
      },
      "name": "Methoxy (OMe)"
    }
  },
  {
    "id": "amino",
    "name": "Amino (NH2)",
    "category": "group",
    "smiles": "N",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-amino",
      "atoms": [
        {
          "id": "a1",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.9128,
            "y": -0.2041,
            "z": -0.4044
          }
        },
        {
          "id": "a3",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.6364,
            "y": -0.7024,
            "z": -0.3741
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.2937,
            "y": 0.8884,
            "z": -0.4035
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "N"
      },
      "name": "Amino (NH2)"
    }
  },
  {
    "id": "dimethylamino",
    "name": "Dimethylamino",
    "category": "group",
    "smiles": "N(C)C",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-dimethylamino",
      "atoms": [
        {
          "id": "a1",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.1122,
            "y": 0.6482,
            "z": 0.6816
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 1.2003,
            "y": 0.022,
            "z": 0.8249
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.2493,
            "y": -0.9674,
            "z": -0.2038
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.9981,
            "y": 0.6224,
            "z": 0.0396
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.3604,
            "y": 0.1394,
            "z": 1.6189
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.889,
            "y": 1.6991,
            "z": 0.8925
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.5133,
            "y": 1.0486,
            "z": 1.0413
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.0202,
            "y": -0.4657,
            "z": 0.2885
          }
        },
        {
          "id": "a10",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.0494,
            "y": -0.5131,
            "z": 1.7681
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a2",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a2",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a2",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a3",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a3",
          "atomB": "a9",
          "order": "single"
        },
        {
          "id": "b9",
          "atomA": "a3",
          "atomB": "a10",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "N(C)C"
      },
      "name": "Dimethylamino"
    }
  },
  {
    "id": "thiol",
    "name": "Thiol (SH)",
    "category": "group",
    "smiles": "S",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-thiol",
      "atoms": [
        {
          "id": "a1",
          "element": "S",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.9173,
            "y": -0.9782,
            "z": 0.0
          }
        },
        {
          "id": "a3",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.0305,
            "y": -0.8581,
            "z": 0.0
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "S"
      },
      "name": "Thiol (SH)"
    }
  },
  {
    "id": "formyl",
    "name": "Formyl (CHO)",
    "category": "group",
    "smiles": "C=O",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-formyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": 1.2102,
            "y": -0.1862,
            "z": -0.0182
          }
        },
        {
          "id": "a3",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.4391,
            "y": 1.0104,
            "z": 0.0021
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.7224,
            "y": -0.8317,
            "z": 0.0153
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C=O"
      },
      "name": "Formyl (CHO)"
    }
  },
  {
    "id": "acetyl",
    "name": "Acetyl",
    "category": "group",
    "smiles": "C(=O)C",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-acetyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": 0.6995,
            "y": -0.9971,
            "z": -0.1447
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.4965,
            "y": -0.027,
            "z": -0.0512
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.4529,
            "y": 0.9897,
            "z": 0.1794
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.8933,
            "y": 0.33,
            "z": 0.9019
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.8383,
            "y": 0.6241,
            "z": -0.8591
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.8471,
            "y": -1.046,
            "z": -0.2324
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a3",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a3",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a3",
          "atomB": "a7",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C(=O)C"
      },
      "name": "Acetyl"
    }
  },
  {
    "id": "carboxy",
    "name": "Carboxy (COOH)",
    "category": "group",
    "smiles": "C(=O)O",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-carboxy",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": -0.129,
            "y": 1.1986,
            "z": -0.1636
          }
        },
        {
          "id": "a3",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": 1.2076,
            "y": -0.5836,
            "z": 0.0366
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.807,
            "y": -0.7351,
            "z": 0.1337
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 1.8378,
            "y": 0.1562,
            "z": -0.0911
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a3",
          "atomB": "a5",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C(=O)O"
      },
      "name": "Carboxy (COOH)"
    }
  },
  {
    "id": "methoxycarbonyl",
    "name": "Methyl ester",
    "category": "group",
    "smiles": "C(=O)OC",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-methoxycarbonyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": -0.0357,
            "y": 1.139,
            "z": 0.4362
          }
        },
        {
          "id": "a3",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": -1.0483,
            "y": -0.7217,
            "z": -0.4678
          }
        },
        {
          "id": "a4",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -2.2941,
            "y": -0.0253,
            "z": -0.4198
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.9145,
            "y": -0.6089,
            "z": -0.0732
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.2555,
            "y": 0.8734,
            "z": -1.0434
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.5515,
            "y": 0.2298,
            "z": 0.6131
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -3.0685,
            "y": -0.6882,
            "z": -0.8157
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a3",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a1",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a4",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a4",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a4",
          "atomB": "a8",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C(=O)OC"
      },
      "name": "Methyl ester"
    }
  },
  {
    "id": "carbamoyl",
    "name": "Amide (CONH2)",
    "category": "group",
    "smiles": "C(=O)N",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-carbamoyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": 0.8435,
            "y": -0.7712,
            "z": -0.4288
          }
        },
        {
          "id": "a3",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": -1.3335,
            "y": -0.2583,
            "z": -0.0368
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.2388,
            "y": 0.9745,
            "z": 0.4556
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.638,
            "y": -1.1346,
            "z": -0.4405
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.0238,
            "y": 0.3861,
            "z": 0.3205
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a3",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a3",
          "atomB": "a6",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C(=O)N"
      },
      "name": "Amide (CONH2)"
    }
  },
  {
    "id": "acetamido",
    "name": "Acetamido",
    "category": "group",
    "smiles": "NC(C)=O",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-acetamido",
      "atoms": [
        {
          "id": "a1",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.0894,
            "y": 0.0998,
            "z": 0.8109
          }
        },
        {
          "id": "a3",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -2.3782,
            "y": -0.4061,
            "z": 0.2285
          }
        },
        {
          "id": "a4",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": -1.0023,
            "y": 0.576,
            "z": 1.9363
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.0007,
            "y": -0.543,
            "z": -0.8515
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.8911,
            "y": 0.2739,
            "z": 0.3937
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.2515,
            "y": -0.7287,
            "z": -0.8087
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -3.1211,
            "y": 0.3956,
            "z": 0.2541
          }
        },
        {
          "id": "a9",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.729,
            "y": -1.2557,
            "z": 0.8202
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a2",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a2",
          "atomB": "a4",
          "order": "double"
        },
        {
          "id": "b4",
          "atomA": "a1",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a1",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a3",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a3",
          "atomB": "a8",
          "order": "single"
        },
        {
          "id": "b8",
          "atomA": "a3",
          "atomB": "a9",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "NC(C)=O"
      },
      "name": "Acetamido"
    }
  },
  {
    "id": "nitrile",
    "name": "Nitrile (CN)",
    "category": "group",
    "smiles": "C#N",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-nitrile",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": 1.1599,
            "y": 0.0145,
            "z": 0.0
          }
        },
        {
          "id": "a3",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.0649,
            "y": -0.0133,
            "z": 0.0
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "triple"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C#N"
      },
      "name": "Nitrile (CN)"
    }
  },
  {
    "id": "nitro",
    "name": "Nitro",
    "category": "group",
    "smiles": "[NH+](=O)[O-]",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-nitro",
      "atoms": [
        {
          "id": "a1",
          "element": "N",
          "formalCharge": 1,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": -0.7374,
            "y": -0.6874,
            "z": 0.7108
          }
        },
        {
          "id": "a3",
          "element": "O",
          "formalCharge": -1,
          "position": {
            "x": 0.9893,
            "y": -0.3677,
            "z": -0.6383
          }
        },
        {
          "id": "a4",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.2362,
            "y": 0.9891,
            "z": -0.0679
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "[NH+](=O)[O-]"
      },
      "name": "Nitro"
    }
  },
  {
    "id": "sulfonamide",
    "name": "Sulfonamide",
    "category": "group",
    "smiles": "S(=O)(=O)N",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-sulfonamide",
      "atoms": [
        {
          "id": "a1",
          "element": "S",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": -0.3631,
            "y": -0.9049,
            "z": 1.0653
          }
        },
        {
          "id": "a3",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": -0.394,
            "y": -0.2249,
            "z": -1.371
          }
        },
        {
          "id": "a4",
          "element": "N",
          "formalCharge": 0,
          "position": {
            "x": 1.684,
            "y": 0.017,
            "z": -0.0167
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.4306,
            "y": 1.2356,
            "z": 0.3503
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.0277,
            "y": -0.6612,
            "z": 0.6672
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 2.007,
            "y": -0.2068,
            "z": -0.9608
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "double"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a1",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a4",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a4",
          "atomB": "a7",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "S(=O)(=O)N"
      },
      "name": "Sulfonamide"
    }
  },
  {
    "id": "methylsulfonyl",
    "name": "Methylsulfonyl",
    "category": "group",
    "smiles": "S(=O)(=O)C",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-methylsulfonyl",
      "atoms": [
        {
          "id": "a1",
          "element": "S",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": 0.4541,
            "y": -1.0502,
            "z": -0.889
          }
        },
        {
          "id": "a3",
          "element": "O",
          "formalCharge": 0,
          "position": {
            "x": 0.4591,
            "y": 0.0851,
            "z": 1.3717
          }
        },
        {
          "id": "a4",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": -1.7708,
            "y": -0.0094,
            "z": 0.0086
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.3661,
            "y": 1.1638,
            "z": -0.5853
          }
        },
        {
          "id": "a6",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.1087,
            "y": -0.9367,
            "z": 0.4751
          }
        },
        {
          "id": "a7",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.123,
            "y": 0.0459,
            "z": -1.0227
          }
        },
        {
          "id": "a8",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -2.1194,
            "y": 0.8516,
            "z": 0.5814
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "double"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "double"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a1",
          "atomB": "a5",
          "order": "single"
        },
        {
          "id": "b5",
          "atomA": "a4",
          "atomB": "a6",
          "order": "single"
        },
        {
          "id": "b6",
          "atomA": "a4",
          "atomB": "a7",
          "order": "single"
        },
        {
          "id": "b7",
          "atomA": "a4",
          "atomB": "a8",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "S(=O)(=O)C"
      },
      "name": "Methylsulfonyl"
    }
  },
  {
    "id": "trifluoromethyl",
    "name": "Trifluoromethyl (CF3)",
    "category": "group",
    "smiles": "C(F)(F)F",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-trifluoromethyl",
      "atoms": [
        {
          "id": "a1",
          "element": "C",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "F",
          "formalCharge": 0,
          "position": {
            "x": 1.1043,
            "y": -0.5505,
            "z": -0.5478
          }
        },
        {
          "id": "a3",
          "element": "F",
          "formalCharge": 0,
          "position": {
            "x": -0.1138,
            "y": 1.2595,
            "z": -0.4727
          }
        },
        {
          "id": "a4",
          "element": "F",
          "formalCharge": 0,
          "position": {
            "x": -1.0702,
            "y": -0.7024,
            "z": -0.429
          }
        },
        {
          "id": "a5",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": 0.06,
            "y": -0.0049,
            "z": 1.0912
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        },
        {
          "id": "b2",
          "atomA": "a1",
          "atomB": "a3",
          "order": "single"
        },
        {
          "id": "b3",
          "atomA": "a1",
          "atomB": "a4",
          "order": "single"
        },
        {
          "id": "b4",
          "atomA": "a1",
          "atomB": "a5",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "C(F)(F)F"
      },
      "name": "Trifluoromethyl (CF3)"
    }
  },
  {
    "id": "fluoro",
    "name": "Fluoro",
    "category": "halogen",
    "smiles": "F",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-fluoro",
      "atoms": [
        {
          "id": "a1",
          "element": "F",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -0.9855,
            "y": 0.0,
            "z": 0.0
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "F"
      },
      "name": "Fluoro"
    }
  },
  {
    "id": "chloro",
    "name": "Chloro",
    "category": "halogen",
    "smiles": "Cl",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-chloro",
      "atoms": [
        {
          "id": "a1",
          "element": "Cl",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.3756,
            "y": 0.0,
            "z": 0.0
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "Cl"
      },
      "name": "Chloro"
    }
  },
  {
    "id": "bromo",
    "name": "Bromo",
    "category": "halogen",
    "smiles": "Br",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-bromo",
      "atoms": [
        {
          "id": "a1",
          "element": "Br",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.529,
            "y": 0.0,
            "z": 0.0
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "Br"
      },
      "name": "Bromo"
    }
  },
  {
    "id": "iodo",
    "name": "Iodo",
    "category": "halogen",
    "smiles": "I",
    "attachAtomId": "a1",
    "molecule": {
      "schemaVersion": 1,
      "id": "frag-iodo",
      "atoms": [
        {
          "id": "a1",
          "element": "I",
          "formalCharge": 0,
          "position": {
            "x": 0.0,
            "y": 0.0,
            "z": 0.0
          }
        },
        {
          "id": "a2",
          "element": "H",
          "formalCharge": 0,
          "position": {
            "x": -1.7256,
            "y": 0.0,
            "z": 0.0
          }
        }
      ],
      "bonds": [
        {
          "id": "b1",
          "atomA": "a1",
          "atomB": "a2",
          "order": "single"
        }
      ],
      "metadata": {
        "source": "fragment library",
        "smiles": "I"
      },
      "name": "Iodo"
    }
  }
];
