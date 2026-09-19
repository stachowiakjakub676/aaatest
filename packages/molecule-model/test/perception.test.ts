import { describe, expect, it } from "vitest";
import { bondInRing, connectedComponents, createMolecule, detectFunctionalGroups, findCycles, getSampleMolecule, ringCount } from "../src";

const s = (id: string) => getSampleMolecule(id)!;
const groupIds = (id: string) => detectFunctionalGroups(s(id)).map((g) => g.id).sort();

describe("ring perception", () => {
  it("counts rings and detects ring bonds", () => {
    expect(ringCount(s("benzene"))).toBe(1);
    expect(ringCount(s("caffeine"))).toBe(2);
    expect(ringCount(s("ethanol"))).toBe(0);
    const bz = s("benzene");
    const cc = bz.bonds.find((b) => bz.atoms.find((a) => a.id === b.atomA)!.element === "C" && bz.atoms.find((a) => a.id === b.atomB)!.element === "C")!;
    const ch = bz.bonds.find((b) => bz.atoms.find((a) => a.id === b.atomB)!.element === "H")!;
    expect(bondInRing(bz, cc.id)).toBe(true);
    expect(bondInRing(bz, ch.id)).toBe(false);
    expect(findCycles(bz, 6)).toHaveLength(1);
    expect(findCycles(s("caffeine"), 6)).toHaveLength(1);
    expect(findCycles(s("caffeine"), 5)).toHaveLength(1);
  });

  it("finds connected components", () => {
    const two = createMolecule({
      id: "two",
      atoms: [
        { id: "a", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } },
        { id: "b", element: "C", formalCharge: 0, position: { x: 1, y: 0, z: 0 } },
        { id: "c", element: "O", formalCharge: 0, position: { x: 5, y: 0, z: 0 } },
      ],
      bonds: [{ id: "ab", atomA: "a", atomB: "b", order: "single" }],
    });
    expect(connectedComponents(two)).toEqual([["a", "b"], ["c"]]);
    expect(ringCount(two)).toBe(0);
  });
});

describe("functional group detection", () => {
  it("classifies the sample molecules", () => {
    expect(groupIds("aspirin")).toEqual(["aromatic-ring", "carboxylic-acid", "ester"]);
    expect(groupIds("acetic-acid")).toEqual(["carboxylic-acid"]);
    expect(groupIds("ethanol")).toEqual(["alcohol"]);
    expect(groupIds("benzene")).toEqual(["aromatic-ring"]);
    expect(groupIds("water")).toEqual([]);
    expect(groupIds("glucose")).toEqual(["alcohol", "alcohol", "alcohol", "alcohol", "alcohol", "ether"]);
    expect(groupIds("caffeine")).toEqual(expect.arrayContaining(["amide"]));
  });

  it("marks the disconnectable bond of an ester and an amide", () => {
    const asp = s("aspirin");
    const ester = detectFunctionalGroups(asp).find((g) => g.id === "ester")!;
    expect(ester.keyBondIds).toHaveLength(1);
    const bond = asp.bonds.find((b) => b.id === ester.keyBondIds[0])!;
    const elements = [asp.atoms.find((a) => a.id === bond.atomA)!.element, asp.atoms.find((a) => a.id === bond.atomB)!.element].sort();
    expect(elements).toEqual(["C", "O"]);
    expect(bond.order).toBe("single");
  });

  it("recognises amines, ketones, nitriles and halides on hand-built graphs", () => {
    const mk = (atoms: Array<[string, string]>, bonds: Array<[string, string, "single" | "double" | "triple"]>) =>
      createMolecule({
        id: "t",
        atoms: atoms.map(([id, element], i) => ({ id, element, formalCharge: 0, position: { x: i * 1.4, y: 0, z: 0 } })),
        bonds: bonds.map(([a, b, order], i) => ({ id: `b${i}`, atomA: a, atomB: b, order })),
      });
    expect(detectFunctionalGroups(mk([["c", "C"], ["n", "N"]], [["c", "n", "single"]])).map((g) => g.name)).toEqual(["Primary amine"]);
    expect(detectFunctionalGroups(mk([["c1", "C"], ["c2", "C"], ["o", "O"], ["c3", "C"]], [["c1", "c2", "single"], ["c2", "o", "double"], ["c2", "c3", "single"]])).map((g) => g.id)).toEqual(["ketone"]);
    expect(detectFunctionalGroups(mk([["c1", "C"], ["c2", "C"], ["n", "N"]], [["c1", "c2", "single"], ["c2", "n", "triple"]])).map((g) => g.id)).toEqual(["nitrile"]);
    expect(detectFunctionalGroups(mk([["c", "C"], ["br", "Br"]], [["c", "br", "single"]])).map((g) => g.name)).toEqual(["Bromide"]);
  });
});
