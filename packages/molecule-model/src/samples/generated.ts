// GENERATED FILE - do not edit by hand.
// Source: packages/chem-core/scripts/generate_samples.py (RDKit ETKDGv3, seed 42, MMFF94).
import type { Molecule } from "../types";

export const GENERATED_SAMPLES: readonly Molecule[] = [
  {
    "schemaVersion": 1,
    "id": "water",
    "atoms": [
      {
        "id": "a1",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": 0.0075,
          "y": 0.3977,
          "z": 0.0
        }
      },
      {
        "id": "a2",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -0.7671,
          "y": -0.1844,
          "z": 0.0
        }
      },
      {
        "id": "a3",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 0.7596,
          "y": -0.2134,
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
      "source": "rdkit ETKDGv3 seed 42 + MMFF94",
      "smiles": "O"
    },
    "name": "Water"
  },
  {
    "schemaVersion": 1,
    "id": "methane",
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
      "source": "rdkit ETKDGv3 seed 42 + MMFF94",
      "smiles": "C"
    },
    "name": "Methane"
  },
  {
    "schemaVersion": 1,
    "id": "ethylene",
    "atoms": [
      {
        "id": "a1",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -0.6516,
          "y": 0.0169,
          "z": 0.1459
        }
      },
      {
        "id": "a2",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 0.6516,
          "y": -0.0169,
          "z": -0.1459
        }
      },
      {
        "id": "a3",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.2566,
          "y": -0.8836,
          "z": 0.1113
        }
      },
      {
        "id": "a4",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.1388,
          "y": 0.9459,
          "z": 0.4249
        }
      },
      {
        "id": "a5",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 1.1388,
          "y": -0.9459,
          "z": -0.4249
        }
      },
      {
        "id": "a6",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 1.2566,
          "y": 0.8836,
          "z": -0.1113
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
      "source": "rdkit ETKDGv3 seed 42 + MMFF94",
      "smiles": "C=C"
    },
    "name": "Ethylene"
  },
  {
    "schemaVersion": 1,
    "id": "acetylene",
    "atoms": [
      {
        "id": "a1",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -0.597,
          "y": 0.0611,
          "z": 0.0097
        }
      },
      {
        "id": "a2",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 0.597,
          "y": -0.0611,
          "z": -0.0097
        }
      },
      {
        "id": "a3",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.6571,
          "y": 0.1696,
          "z": 0.0268
        }
      },
      {
        "id": "a4",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 1.6571,
          "y": -0.1696,
          "z": -0.0268
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
      "source": "rdkit ETKDGv3 seed 42 + MMFF94",
      "smiles": "C#C"
    },
    "name": "Acetylene"
  },
  {
    "schemaVersion": 1,
    "id": "ethanol",
    "atoms": [
      {
        "id": "a1",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -0.8883,
          "y": 0.167,
          "z": -0.0273
        }
      },
      {
        "id": "a2",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 0.4658,
          "y": -0.5116,
          "z": -0.0368
        }
      },
      {
        "id": "a3",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": 1.4311,
          "y": 0.3229,
          "z": 0.5867
        }
      },
      {
        "id": "a4",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -0.8487,
          "y": 1.1175,
          "z": -0.5695
        }
      },
      {
        "id": "a5",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.6471,
          "y": -0.4704,
          "z": -0.4896
        }
      },
      {
        "id": "a6",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.1964,
          "y": 0.3978,
          "z": 0.9977
        }
      },
      {
        "id": "a7",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 0.792,
          "y": -0.7224,
          "z": -1.0597
        }
      },
      {
        "id": "a8",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 0.4246,
          "y": -1.4559,
          "z": 0.5138
        }
      },
      {
        "id": "a9",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 1.4671,
          "y": 1.155,
          "z": 0.0848
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
        "atomA": "a1",
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
      }
    ],
    "metadata": {
      "source": "rdkit ETKDGv3 seed 42 + MMFF94",
      "smiles": "CCO"
    },
    "name": "Ethanol"
  },
  {
    "schemaVersion": 1,
    "id": "acetic-acid",
    "atoms": [
      {
        "id": "a1",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -0.9335,
          "y": -0.0601,
          "z": -0.2304
        }
      },
      {
        "id": "a2",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 0.4936,
          "y": 0.2789,
          "z": 0.0469
        }
      },
      {
        "id": "a3",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": 1.0325,
          "y": 1.3566,
          "z": -0.1361
        }
      },
      {
        "id": "a4",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": 1.1814,
          "y": -0.7645,
          "z": 0.5462
        }
      },
      {
        "id": "a5",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.4427,
          "y": 0.8203,
          "z": -0.6327
        }
      },
      {
        "id": "a6",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.4305,
          "y": -0.3576,
          "z": 0.6963
        }
      },
      {
        "id": "a7",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -0.9867,
          "y": -0.8625,
          "z": -0.9702
        }
      },
      {
        "id": "a8",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 2.0859,
          "y": -0.4112,
          "z": 0.68
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
        "atomA": "a2",
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
        "atomA": "a1",
        "atomB": "a6",
        "order": "single"
      },
      {
        "id": "b6",
        "atomA": "a1",
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
      "source": "rdkit ETKDGv3 seed 42 + MMFF94",
      "smiles": "CC(=O)O"
    },
    "name": "Acetic acid"
  },
  {
    "schemaVersion": 1,
    "id": "benzene",
    "atoms": [
      {
        "id": "a1",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 0.8035,
          "y": -1.1401,
          "z": -0.0082
        }
      },
      {
        "id": "a2",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 1.3889,
          "y": 0.1258,
          "z": -0.0281
        }
      },
      {
        "id": "a3",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 0.5853,
          "y": 1.2659,
          "z": -0.0199
        }
      },
      {
        "id": "a4",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -0.8035,
          "y": 1.1401,
          "z": 0.0083
        }
      },
      {
        "id": "a5",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -1.3889,
          "y": -0.1258,
          "z": 0.0281
        }
      },
      {
        "id": "a6",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -0.5853,
          "y": -1.2659,
          "z": 0.0199
        }
      },
      {
        "id": "a7",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 1.4295,
          "y": -2.0284,
          "z": -0.0147
        }
      },
      {
        "id": "a8",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 2.4709,
          "y": 0.2238,
          "z": -0.05
        }
      },
      {
        "id": "a9",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 1.0414,
          "y": 2.2522,
          "z": -0.0354
        }
      },
      {
        "id": "a10",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.4295,
          "y": 2.0284,
          "z": 0.0147
        }
      },
      {
        "id": "a11",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -2.4709,
          "y": -0.2238,
          "z": 0.05
        }
      },
      {
        "id": "a12",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.0414,
          "y": -2.2522,
          "z": 0.0354
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
      "source": "rdkit ETKDGv3 seed 42 + MMFF94",
      "smiles": "c1ccccc1"
    },
    "name": "Benzene"
  },
  {
    "schemaVersion": 1,
    "id": "aspirin",
    "atoms": [
      {
        "id": "a1",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -2.6518,
          "y": -2.2039,
          "z": -0.0733
        }
      },
      {
        "id": "a2",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -1.824,
          "y": -0.9974,
          "z": 0.2545
        }
      },
      {
        "id": "a3",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": -1.9084,
          "y": -0.3627,
          "z": 1.298
        }
      },
      {
        "id": "a4",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": -0.9858,
          "y": -0.7216,
          "z": -0.8202
        }
      },
      {
        "id": "a5",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -0.1116,
          "y": 0.3381,
          "z": -0.5612
        }
      },
      {
        "id": "a6",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -0.464,
          "y": 1.5868,
          "z": -1.0836
        }
      },
      {
        "id": "a7",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 0.3779,
          "y": 2.6794,
          "z": -0.8862
        }
      },
      {
        "id": "a8",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 1.5706,
          "y": 2.5212,
          "z": -0.1811
        }
      },
      {
        "id": "a9",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 1.9291,
          "y": 1.2668,
          "z": 0.3236
        }
      },
      {
        "id": "a10",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 1.0933,
          "y": 0.1554,
          "z": 0.1329
        }
      },
      {
        "id": "a11",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 1.4817,
          "y": -1.1865,
          "z": 0.6414
        }
      },
      {
        "id": "a12",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": 0.8888,
          "y": -2.2361,
          "z": 0.4729
        }
      },
      {
        "id": "a13",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": 2.6258,
          "y": -1.158,
          "z": 1.352
        }
      },
      {
        "id": "a14",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -3.3045,
          "y": -1.9853,
          "z": -0.9218
        }
      },
      {
        "id": "a15",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -3.2714,
          "y": -2.4627,
          "z": 0.7901
        }
      },
      {
        "id": "a16",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -2.0,
          "y": -3.0524,
          "z": -0.2966
        }
      },
      {
        "id": "a17",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.3929,
          "y": 1.7088,
          "z": -1.6335
        }
      },
      {
        "id": "a18",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 0.1041,
          "y": 3.6553,
          "z": -1.2799
        }
      },
      {
        "id": "a19",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 2.2263,
          "y": 3.3749,
          "z": -0.0248
        }
      },
      {
        "id": "a20",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 2.8684,
          "y": 1.1691,
          "z": 0.8634
        }
      },
      {
        "id": "a21",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 2.7484,
          "y": -2.0889,
          "z": 1.6334
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
        "atomA": "a2",
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
        "atomB": "a11",
        "order": "single"
      },
      {
        "id": "b11",
        "atomA": "a11",
        "atomB": "a12",
        "order": "double"
      },
      {
        "id": "b12",
        "atomA": "a11",
        "atomB": "a13",
        "order": "single"
      },
      {
        "id": "b13",
        "atomA": "a10",
        "atomB": "a5",
        "order": "single"
      },
      {
        "id": "b14",
        "atomA": "a1",
        "atomB": "a14",
        "order": "single"
      },
      {
        "id": "b15",
        "atomA": "a1",
        "atomB": "a15",
        "order": "single"
      },
      {
        "id": "b16",
        "atomA": "a1",
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
        "atomA": "a7",
        "atomB": "a18",
        "order": "single"
      },
      {
        "id": "b19",
        "atomA": "a8",
        "atomB": "a19",
        "order": "single"
      },
      {
        "id": "b20",
        "atomA": "a9",
        "atomB": "a20",
        "order": "single"
      },
      {
        "id": "b21",
        "atomA": "a13",
        "atomB": "a21",
        "order": "single"
      }
    ],
    "metadata": {
      "source": "rdkit ETKDGv3 seed 42 + MMFF94",
      "smiles": "CC(=O)Oc1ccccc1C(=O)O"
    },
    "name": "Aspirin"
  },
  {
    "schemaVersion": 1,
    "id": "caffeine",
    "atoms": [
      {
        "id": "a1",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 2.9713,
          "y": -1.5071,
          "z": 0.0823
        }
      },
      {
        "id": "a2",
        "element": "N",
        "formalCharge": 0,
        "position": {
          "x": 2.1276,
          "y": -0.3549,
          "z": -0.1087
        }
      },
      {
        "id": "a3",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 2.5446,
          "y": 0.9076,
          "z": -0.4385
        }
      },
      {
        "id": "a4",
        "element": "N",
        "formalCharge": 0,
        "position": {
          "x": 1.5302,
          "y": 1.7435,
          "z": -0.5409
        }
      },
      {
        "id": "a5",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 0.4346,
          "y": 0.982,
          "z": -0.2664
        }
      },
      {
        "id": "a6",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 0.7675,
          "y": -0.3107,
          "z": 0.003
        }
      },
      {
        "id": "a7",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -0.19,
          "y": -1.3116,
          "z": 0.3207
        }
      },
      {
        "id": "a8",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": 0.1207,
          "y": -2.4743,
          "z": 0.562
        }
      },
      {
        "id": "a9",
        "element": "N",
        "formalCharge": 0,
        "position": {
          "x": -1.5004,
          "y": -0.8246,
          "z": 0.3256
        }
      },
      {
        "id": "a10",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -2.5722,
          "y": -1.7502,
          "z": 0.636
        }
      },
      {
        "id": "a11",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -1.885,
          "y": 0.505,
          "z": 0.0522
        }
      },
      {
        "id": "a12",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": -3.073,
          "y": 0.8401,
          "z": 0.0812
        }
      },
      {
        "id": "a13",
        "element": "N",
        "formalCharge": 0,
        "position": {
          "x": -0.8696,
          "y": 1.4132,
          "z": -0.2492
        }
      },
      {
        "id": "a14",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -1.1808,
          "y": 2.8003,
          "z": -0.5423
        }
      },
      {
        "id": "a15",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 2.8396,
          "y": -1.8693,
          "z": 1.1049
        }
      },
      {
        "id": "a16",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 2.6828,
          "y": -2.2737,
          "z": -0.6412
        }
      },
      {
        "id": "a17",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 4.0153,
          "y": -1.2249,
          "z": -0.0768
        }
      },
      {
        "id": "a18",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 3.5861,
          "y": 1.1624,
          "z": -0.5909
        }
      },
      {
        "id": "a19",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -3.1137,
          "y": -1.3854,
          "z": 1.5151
        }
      },
      {
        "id": "a20",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -3.2681,
          "y": -1.7848,
          "z": -0.2086
        }
      },
      {
        "id": "a21",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -2.2099,
          "y": -2.7612,
          "z": 0.8378
        }
      },
      {
        "id": "a22",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -2.2549,
          "y": 2.9969,
          "z": -0.4916
        }
      },
      {
        "id": "a23",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -0.6736,
          "y": 3.4418,
          "z": 0.1852
        }
      },
      {
        "id": "a24",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -0.8292,
          "y": 3.0399,
          "z": -1.5509
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
        "atomA": "a7",
        "atomB": "a9",
        "order": "single"
      },
      {
        "id": "b9",
        "atomA": "a9",
        "atomB": "a10",
        "order": "single"
      },
      {
        "id": "b10",
        "atomA": "a9",
        "atomB": "a11",
        "order": "single"
      },
      {
        "id": "b11",
        "atomA": "a11",
        "atomB": "a12",
        "order": "double"
      },
      {
        "id": "b12",
        "atomA": "a11",
        "atomB": "a13",
        "order": "single"
      },
      {
        "id": "b13",
        "atomA": "a13",
        "atomB": "a14",
        "order": "single"
      },
      {
        "id": "b14",
        "atomA": "a6",
        "atomB": "a2",
        "order": "single"
      },
      {
        "id": "b15",
        "atomA": "a13",
        "atomB": "a5",
        "order": "single"
      },
      {
        "id": "b16",
        "atomA": "a1",
        "atomB": "a15",
        "order": "single"
      },
      {
        "id": "b17",
        "atomA": "a1",
        "atomB": "a16",
        "order": "single"
      },
      {
        "id": "b18",
        "atomA": "a1",
        "atomB": "a17",
        "order": "single"
      },
      {
        "id": "b19",
        "atomA": "a3",
        "atomB": "a18",
        "order": "single"
      },
      {
        "id": "b20",
        "atomA": "a10",
        "atomB": "a19",
        "order": "single"
      },
      {
        "id": "b21",
        "atomA": "a10",
        "atomB": "a20",
        "order": "single"
      },
      {
        "id": "b22",
        "atomA": "a10",
        "atomB": "a21",
        "order": "single"
      },
      {
        "id": "b23",
        "atomA": "a14",
        "atomB": "a22",
        "order": "single"
      },
      {
        "id": "b24",
        "atomA": "a14",
        "atomB": "a23",
        "order": "single"
      },
      {
        "id": "b25",
        "atomA": "a14",
        "atomB": "a24",
        "order": "single"
      }
    ],
    "metadata": {
      "source": "rdkit ETKDGv3 seed 42 + MMFF94",
      "smiles": "Cn1cnc2c1c(=O)n(C)c(=O)n2C"
    },
    "name": "Caffeine"
  },
  {
    "schemaVersion": 1,
    "id": "glucose",
    "atoms": [
      {
        "id": "a1",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": 2.9149,
          "y": 1.3019,
          "z": -0.7684
        }
      },
      {
        "id": "a2",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 2.4943,
          "y": 0.1635,
          "z": -0.0205
        }
      },
      {
        "id": "a3",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 1.0251,
          "y": -0.1758,
          "z": -0.3108
        }
      },
      {
        "id": "a4",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": 0.6707,
          "y": -1.2961,
          "z": 0.5026
        }
      },
      {
        "id": "a5",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -0.6663,
          "y": -1.7423,
          "z": 0.303
        }
      },
      {
        "id": "a6",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": -0.8791,
          "y": -2.8129,
          "z": 1.2142
        }
      },
      {
        "id": "a7",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -1.6962,
          "y": -0.6304,
          "z": 0.5773
        }
      },
      {
        "id": "a8",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": -3.0235,
          "y": -1.0473,
          "z": 0.2144
        }
      },
      {
        "id": "a9",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": -1.3487,
          "y": 0.6146,
          "z": -0.2341
        }
      },
      {
        "id": "a10",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": -2.2229,
          "y": 1.6915,
          "z": 0.1448
        }
      },
      {
        "id": "a11",
        "element": "C",
        "formalCharge": 0,
        "position": {
          "x": 0.108,
          "y": 1.0272,
          "z": -0.03
        }
      },
      {
        "id": "a12",
        "element": "O",
        "formalCharge": 0,
        "position": {
          "x": 0.3657,
          "y": 2.1344,
          "z": -0.9035
        }
      },
      {
        "id": "a13",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 3.8727,
          "y": 1.399,
          "z": -0.6084
        }
      },
      {
        "id": "a14",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 2.6406,
          "y": 0.3696,
          "z": 1.0457
        }
      },
      {
        "id": "a15",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 3.1333,
          "y": -0.6879,
          "z": -0.28
        }
      },
      {
        "id": "a16",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 0.948,
          "y": -0.4515,
          "z": -1.3713
        }
      },
      {
        "id": "a17",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -0.7854,
          "y": -2.1368,
          "z": -0.7138
        }
      },
      {
        "id": "a18",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -0.4514,
          "y": -3.5862,
          "z": 0.8148
        }
      },
      {
        "id": "a19",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.7226,
          "y": -0.3941,
          "z": 1.6482
        }
      },
      {
        "id": "a20",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -3.5784,
          "y": -0.2523,
          "z": 0.3412
        }
      },
      {
        "id": "a21",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.549,
          "y": 0.4386,
          "z": -1.299
        }
      },
      {
        "id": "a22",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": -1.8369,
          "y": 2.4858,
          "z": -0.2786
        }
      },
      {
        "id": "a23",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 0.2433,
          "y": 1.3858,
          "z": 0.9978
        }
      },
      {
        "id": "a24",
        "element": "H",
        "formalCharge": 0,
        "position": {
          "x": 1.3437,
          "y": 2.2017,
          "z": -0.9856
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
        "atomA": "a5",
        "atomB": "a7",
        "order": "single"
      },
      {
        "id": "b7",
        "atomA": "a7",
        "atomB": "a8",
        "order": "single"
      },
      {
        "id": "b8",
        "atomA": "a7",
        "atomB": "a9",
        "order": "single"
      },
      {
        "id": "b9",
        "atomA": "a9",
        "atomB": "a10",
        "order": "single"
      },
      {
        "id": "b10",
        "atomA": "a9",
        "atomB": "a11",
        "order": "single"
      },
      {
        "id": "b11",
        "atomA": "a11",
        "atomB": "a12",
        "order": "single"
      },
      {
        "id": "b12",
        "atomA": "a11",
        "atomB": "a3",
        "order": "single"
      },
      {
        "id": "b13",
        "atomA": "a1",
        "atomB": "a13",
        "order": "single"
      },
      {
        "id": "b14",
        "atomA": "a2",
        "atomB": "a14",
        "order": "single"
      },
      {
        "id": "b15",
        "atomA": "a2",
        "atomB": "a15",
        "order": "single"
      },
      {
        "id": "b16",
        "atomA": "a3",
        "atomB": "a16",
        "order": "single"
      },
      {
        "id": "b17",
        "atomA": "a5",
        "atomB": "a17",
        "order": "single"
      },
      {
        "id": "b18",
        "atomA": "a6",
        "atomB": "a18",
        "order": "single"
      },
      {
        "id": "b19",
        "atomA": "a7",
        "atomB": "a19",
        "order": "single"
      },
      {
        "id": "b20",
        "atomA": "a8",
        "atomB": "a20",
        "order": "single"
      },
      {
        "id": "b21",
        "atomA": "a9",
        "atomB": "a21",
        "order": "single"
      },
      {
        "id": "b22",
        "atomA": "a10",
        "atomB": "a22",
        "order": "single"
      },
      {
        "id": "b23",
        "atomA": "a11",
        "atomB": "a23",
        "order": "single"
      },
      {
        "id": "b24",
        "atomA": "a12",
        "atomB": "a24",
        "order": "single"
      }
    ],
    "metadata": {
      "source": "rdkit ETKDGv3 seed 42 + MMFF94",
      "smiles": "OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@@H]1O"
    },
    "name": "beta-D-Glucose"
  }
];
