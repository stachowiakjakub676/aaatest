"""PREDICTED / estimated properties from published models.

Everything here is a model output, not a measurement, and is returned with the model's name,
citation and a stated uncertainty so the UI can show it as PREDICTED.
"""

from __future__ import annotations

import os
import sys

from rdkit import Chem, RDConfig
from rdkit.Chem import QED

from .rdkit_bridge import to_rdkit
from .schema import Molecule

sys.path.append(os.path.join(RDConfig.RDContribDir, "SA_Score"))
try:  # the SA_Score contrib ships with RDKit but is not a formal package
    import sascorer  # type: ignore

    _HAVE_SA = True
except Exception:  # pragma: no cover
    _HAVE_SA = False


def estimates(mol: Molecule) -> list[dict]:
    rd = Chem.RemoveHs(to_rdkit(mol, sanitize=True))
    out: list[dict] = [
        {
            "kind": "predicted",
            "id": "qed",
            "model": "QED (Bickerton et al., Nat. Chem. 2012)",
            "label": "Drug-likeness (QED)",
            "value": round(float(QED.qed(rd)), 3),
            "unit": "",
            "uncertainty": "0 (unlike) to 1 (like); a weighted desirability of eight descriptors, not a measurement",
        }
    ]
    if _HAVE_SA:
        out.append(
            {
                "kind": "predicted",
                "id": "sa-score",
                "model": "SA score (Ertl & Schuffenhauer, J. Cheminf. 2009)",
                "label": "Synthetic accessibility",
                "value": round(float(sascorer.calculateScore(rd)), 2),
                "unit": "",
                "uncertainty": "1 (easy) to 10 (hard); fragment-frequency heuristic trained on PubChem",
            }
        )
    return out
