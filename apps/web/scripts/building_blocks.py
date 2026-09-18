"""Generate src/retro/buildingBlocks.ts: canonical SMILES of common, commercially available
building blocks used by the rule-based synthesis planner to decide where a route may stop.

The list is deliberately conservative (solvents, simple acids/alcohols/amines/aldehydes,
common aromatics and heterocycles, simple halides and coupling partners). Canonicalised with
RDKit so it matches the canonical SMILES the in-browser RDKit produces.

    <venv>/bin/python scripts/building_blocks.py
"""

from __future__ import annotations

from pathlib import Path

from rdkit import Chem

RAW: list[tuple[str, str]] = [
    ("methanol", "CO"), ("ethanol", "CCO"), ("1-propanol", "CCCO"), ("2-propanol", "CC(C)O"), ("1-butanol", "CCCCO"),
    ("tert-butanol", "CC(C)(C)O"), ("1-hexanol", "CCCCCCO"), ("1-octanol", "CCCCCCCCO"), ("1-decanol", "CCCCCCCCCCO"),
    ("1-dodecanol", "CCCCCCCCCCCCO"), ("ethylene glycol", "OCCO"), ("glycerol", "OCC(O)CO"), ("benzyl alcohol", "OCc1ccccc1"),
    ("cyclohexanol", "OC1CCCCC1"), ("cyclopentanol", "OC1CCCC1"), ("allyl alcohol", "C=CCO"), ("propargyl alcohol", "C#CCO"),
    ("phenol", "Oc1ccccc1"), ("p-cresol", "Cc1ccc(O)cc1"), ("o-cresol", "Cc1ccccc1O"), ("catechol", "Oc1ccccc1O"),
    ("hydroquinone", "Oc1ccc(O)cc1"), ("resorcinol", "Oc1cccc(O)c1"), ("4-methoxyphenol", "COc1ccc(O)cc1"), ("2-naphthol", "Oc1ccc2ccccc2c1"),
    ("1-naphthol", "Oc1cccc2ccccc12"), ("4-nitrophenol", "O=[N+]([O-])c1ccc(O)cc1"), ("4-aminophenol", "Nc1ccc(O)cc1"), ("4-bromophenol", "Oc1ccc(Br)cc1"),
    ("4-chlorophenol", "Oc1ccc(Cl)cc1"), ("salicylaldehyde", "O=Cc1ccccc1O"), ("4-hydroxybenzaldehyde", "O=Cc1ccc(O)cc1"), ("vanillin", "COc1cc(C=O)ccc1O"),
    ("formic acid", "O=CO"), ("acetic acid", "CC(=O)O"), ("propanoic acid", "CCC(=O)O"), ("butanoic acid", "CCCC(=O)O"), ("hexanoic acid", "CCCCCC(=O)O"),
    ("octanoic acid", "CCCCCCCC(=O)O"), ("lauric acid", "CCCCCCCCCCCC(=O)O"), ("palmitic acid", "CCCCCCCCCCCCCCCC(=O)O"), ("stearic acid", "CCCCCCCCCCCCCCCCCC(=O)O"),
    ("oleic acid", "CCCCCCCC/C=C\\CCCCCCCC(=O)O"), ("acrylic acid", "C=CC(=O)O"), ("methacrylic acid", "C=C(C)C(=O)O"), ("oxalic acid", "O=C(O)C(=O)O"),
    ("malonic acid", "O=C(O)CC(=O)O"), ("succinic acid", "O=C(O)CCC(=O)O"), ("adipic acid", "O=C(O)CCCCC(=O)O"), ("benzoic acid", "O=C(O)c1ccccc1"),
    ("phenylacetic acid", "O=C(O)Cc1ccccc1"), ("salicylic acid", "O=C(O)c1ccccc1O"), ("4-hydroxybenzoic acid", "O=C(O)c1ccc(O)cc1"), ("4-aminobenzoic acid", "Nc1ccc(C(=O)O)cc1"),
    ("4-nitrobenzoic acid", "O=C(O)c1ccc([N+](=O)[O-])cc1"), ("terephthalic acid", "O=C(O)c1ccc(C(=O)O)cc1"), ("phthalic acid", "O=C(O)c1ccccc1C(=O)O"), ("cinnamic acid", "O=C(O)/C=C/c1ccccc1"),
    ("nicotinic acid", "O=C(O)c1cccnc1"), ("isonicotinic acid", "O=C(O)c1ccncc1"), ("picolinic acid", "O=C(O)c1ccccn1"), ("trifluoroacetic acid", "O=C(O)C(F)(F)F"),
    ("cyclohexanecarboxylic acid", "O=C(O)C1CCCCC1"), ("cyclopropanecarboxylic acid", "O=C(O)C1CC1"), ("pivalic acid", "CC(C)(C)C(=O)O"), ("glycine", "NCC(=O)O"),
    ("alanine", "CC(N)C(=O)O"), ("lactic acid", "CC(O)C(=O)O"), ("glycolic acid", "OCC(=O)O"), ("chloroacetic acid", "O=C(O)CCl"),
    ("acetyl chloride", "CC(=O)Cl"), ("benzoyl chloride", "O=C(Cl)c1ccccc1"), ("acetic anhydride", "CC(=O)OC(C)=O"), ("ethyl acetate", "CCOC(C)=O"),
    ("methyl acetate", "COC(C)=O"), ("methyl benzoate", "COC(=O)c1ccccc1"), ("ethyl benzoate", "CCOC(=O)c1ccccc1"), ("ethyl acetoacetate", "CCOC(=O)CC(C)=O"),
    ("diethyl malonate", "CCOC(=O)CC(=O)OCC"), ("methyl acrylate", "C=CC(=O)OC"), ("formaldehyde", "C=O"), ("acetaldehyde", "CC=O"),
    ("propanal", "CCC=O"), ("butanal", "CCCC=O"), ("hexanal", "CCCCCC=O"), ("octanal", "CCCCCCCC=O"), ("benzaldehyde", "O=Cc1ccccc1"),
    ("4-methylbenzaldehyde", "Cc1ccc(C=O)cc1"), ("4-methoxybenzaldehyde", "COc1ccc(C=O)cc1"), ("4-chlorobenzaldehyde", "O=Cc1ccc(Cl)cc1"), ("4-nitrobenzaldehyde", "O=Cc1ccc([N+](=O)[O-])cc1"),
    ("furfural", "O=Cc1ccco1"), ("cinnamaldehyde", "O=C/C=C/c1ccccc1"), ("acetone", "CC(C)=O"), ("2-butanone", "CCC(C)=O"), ("cyclohexanone", "O=C1CCCCC1"),
    ("cyclopentanone", "O=C1CCCC1"), ("acetophenone", "CC(=O)c1ccccc1"), ("benzophenone", "O=C(c1ccccc1)c1ccccc1"), ("4-methylacetophenone", "CC(=O)c1ccc(C)cc1"),
    ("methyl vinyl ketone", "C=CC(C)=O"), ("acetylacetone", "CC(=O)CC(C)=O"), ("ammonia", "N"), ("methylamine", "CN"), ("dimethylamine", "CNC"), ("trimethylamine", "CN(C)C"),
    ("ethylamine", "CCN"), ("diethylamine", "CCNCC"), ("triethylamine", "CCN(CC)CC"), ("propylamine", "CCCN"), ("isopropylamine", "CC(C)N"), ("butylamine", "CCCCN"),
    ("tert-butylamine", "CC(C)(C)N"), ("cyclohexylamine", "NC1CCCCC1"), ("benzylamine", "NCc1ccccc1"), ("ethylenediamine", "NCCN"), ("ethanolamine", "NCCO"),
    ("aniline", "Nc1ccccc1"), ("N-methylaniline", "CNc1ccccc1"), ("N,N-dimethylaniline", "CN(C)c1ccccc1"), ("p-toluidine", "Cc1ccc(N)cc1"), ("4-chloroaniline", "Nc1ccc(Cl)cc1"),
    ("4-bromoaniline", "Nc1ccc(Br)cc1"), ("4-nitroaniline", "Nc1ccc([N+](=O)[O-])cc1"), ("4-methoxyaniline", "COc1ccc(N)cc1"), ("2-aminopyridine", "Nc1ccccn1"),
    ("morpholine", "C1COCCN1"), ("piperidine", "C1CCNCC1"), ("pyrrolidine", "C1CCNC1"), ("piperazine", "C1CNCCN1"), ("N-methylpiperazine", "CN1CCNCC1"),
    ("imidazole", "c1c[nH]cn1"), ("pyrazole", "c1cn[nH]c1"), ("pyrrole", "c1cc[nH]c1"), ("indole", "c1ccc2[nH]ccc2c1"), ("pyridine", "c1ccncc1"),
    ("2-picoline", "Cc1ccccn1"), ("4-picoline", "Cc1ccncc1"), ("pyrimidine", "c1cncnc1"), ("quinoline", "c1ccc2ncccc2c1"), ("furan", "c1ccoc1"),
    ("thiophene", "c1ccsc1"), ("thiazole", "c1cscn1"), ("benzimidazole", "c1ccc2[nH]cnc2c1"), ("2-bromopyridine", "Brc1ccccn1"), ("3-bromopyridine", "Brc1cccnc1"),
    ("urea", "NC(N)=O"), ("acetamide", "CC(N)=O"), ("benzamide", "NC(=O)c1ccccc1"), ("acetonitrile", "CC#N"), ("benzonitrile", "N#Cc1ccccc1"),
    ("nitromethane", "C[N+](=O)[O-]"), ("nitrobenzene", "O=[N+]([O-])c1ccccc1"), ("4-nitrotoluene", "Cc1ccc([N+](=O)[O-])cc1"), ("benzene", "c1ccccc1"),
    ("toluene", "Cc1ccccc1"), ("o-xylene", "Cc1ccccc1C"), ("m-xylene", "Cc1cccc(C)c1"), ("p-xylene", "Cc1ccc(C)cc1"), ("ethylbenzene", "CCc1ccccc1"),
    ("cumene", "CC(C)c1ccccc1"), ("mesitylene", "Cc1cc(C)cc(C)c1"), ("styrene", "C=Cc1ccccc1"), ("naphthalene", "c1ccc2ccccc2c1"), ("biphenyl", "c1ccc(-c2ccccc2)cc1"),
    ("anisole", "COc1ccccc1"), ("diphenyl ether", "c1ccc(Oc2ccccc2)cc1"), ("chlorobenzene", "Clc1ccccc1"), ("bromobenzene", "Brc1ccccc1"), ("iodobenzene", "Ic1ccccc1"),
    ("4-bromotoluene", "Cc1ccc(Br)cc1"), ("4-bromoanisole", "COc1ccc(Br)cc1"), ("4-chlorotoluene", "Cc1ccc(Cl)cc1"), ("1,4-dibromobenzene", "Brc1ccc(Br)cc1"),
    ("benzyl bromide", "BrCc1ccccc1"), ("benzyl chloride", "ClCc1ccccc1"), ("benzotrifluoride", "FC(F)(F)c1ccccc1"), ("fluorobenzene", "Fc1ccccc1"),
    ("phenylboronic acid", "OB(O)c1ccccc1"), ("4-methylphenylboronic acid", "Cc1ccc(B(O)O)cc1"), ("4-methoxyphenylboronic acid", "COc1ccc(B(O)O)cc1"),
    ("pyridine-3-boronic acid", "OB(O)c1cccnc1"), ("thiophene-2-boronic acid", "OB(O)c1cccs1"), ("phenylacetylene", "C#Cc1ccccc1"), ("acetylene", "C#C"),
    ("propyne", "CC#C"), ("1-hexyne", "CCCCC#C"), ("ethylene", "C=C"), ("propene", "CC=C"), ("1-butene", "CCC=C"), ("1-hexene", "CCCCC=C"), ("1-octene", "CCCCCCC=C"),
    ("cyclohexene", "C1=CCCCC1"), ("cyclopentene", "C1=CCCC1"), ("isobutylene", "C=C(C)C"), ("methyl iodide", "CI"), ("ethyl bromide", "CCBr"), ("ethyl iodide", "CCI"),
    ("1-bromopropane", "CCCBr"), ("2-bromopropane", "CC(C)Br"), ("1-bromobutane", "CCCCBr"), ("2-bromobutane", "CCC(C)Br"), ("tert-butyl bromide", "CC(C)(C)Br"),
    ("tert-butyl chloride", "CC(C)(C)Cl"), ("1-bromopentane", "CCCCCBr"), ("1-bromohexane", "CCCCCCBr"), ("1-bromooctane", "CCCCCCCCBr"), ("1-bromodecane", "CCCCCCCCCCBr"),
    ("1-bromododecane", "CCCCCCCCCCCCBr"), ("allyl bromide", "C=CCBr"), ("propargyl bromide", "C#CCBr"), ("cyclohexyl bromide", "BrC1CCCCC1"), ("cyclopentyl bromide", "BrC1CCCC1"),
    ("1-chlorobutane", "CCCCCl"), ("dichloromethane", "ClCCl"), ("chloroform", "ClC(Cl)Cl"), ("1,2-dibromoethane", "BrCCBr"), ("2-bromoethanol", "OCCBr"),
    ("ethanethiol", "CCS"), ("thiophenol", "Sc1ccccc1"), ("dimethyl sulfide", "CSC"), ("methanesulfonyl chloride", "CS(=O)(=O)Cl"), ("benzenesulfonyl chloride", "O=S(=O)(Cl)c1ccccc1"),
    ("tosyl chloride", "Cc1ccc(S(=O)(=O)Cl)cc1"), ("p-toluenesulfonic acid", "Cc1ccc(S(=O)(=O)O)cc1"), ("benzenesulfonic acid", "O=S(=O)(O)c1ccccc1"),
    ("benzenesulfonamide", "NS(=O)(=O)c1ccccc1"), ("sulfanilamide", "Nc1ccc(S(N)(=O)=O)cc1"), ("dimethyl sulfoxide", "CS(C)=O"), ("tetrahydrofuran", "C1CCOC1"),
    ("1,4-dioxane", "C1COCCO1"), ("diethyl ether", "CCOCC"), ("ethylene oxide", "C1CO1"), ("propylene oxide", "CC1CO1"), ("styrene oxide", "c1ccc(C2CO2)cc1"),
    ("water", "O"), ("hydrogen peroxide", "OO"), ("carbon dioxide", "O=C=O"), ("methyl tert-butyl ether", "COC(C)(C)C"), ("glyoxal", "O=CC=O"),
    ("2-aminoethanethiol", "NCCS"), ("4-aminobenzenesulfonic acid", "Nc1ccc(S(=O)(=O)O)cc1"), ("acetanilide", "CC(=O)Nc1ccccc1"), ("paracetamol", "CC(=O)Nc1ccc(O)cc1"),
    ("aspirin", "CC(=O)Oc1ccccc1C(=O)O"), ("caffeine", "Cn1c(=O)c2c(ncn2C)n(C)c1=O"), ("glucose", "OCC1OC(O)C(O)C(O)C1O"), ("citric acid", "OC(=O)CC(O)(CC(=O)O)C(=O)O"),
]

OUT = Path(__file__).resolve().parents[1] / "src" / "retro" / "buildingBlocks.ts"


def main() -> None:
    entries: dict[str, str] = {}
    for name, smi in RAW:
        mol = Chem.MolFromSmiles(smi)
        if mol is None:
            raise SystemExit(f"bad SMILES for {name}: {smi}")
        Chem.RemoveStereochemistry(mol)
        can = Chem.MolToSmiles(mol)
        entries.setdefault(can, name)
    lines = [
        "// GENERATED FILE - do not edit by hand. Source: apps/web/scripts/building_blocks.py (RDKit canonical SMILES, stereo stripped).",
        "/** Common commercially available building blocks: canonical SMILES → name. The planner stops a route here. */",
        "export const BUILDING_BLOCKS: ReadonlyMap<string, string> = new Map<string, string>([",
    ]
    for can, name in sorted(entries.items(), key=lambda kv: kv[1]):
        lines.append(f'  [{can!r}, {name!r}],'.replace("'", '"'))
    lines.append("]);")
    lines.append("")
    OUT.write_text("\n".join(lines))
    print(f"wrote {OUT} ({len(entries)} building blocks)")


if __name__ == "__main__":
    main()
