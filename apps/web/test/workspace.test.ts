import { describe, expect, it } from "vitest";
import { getSampleMolecule } from "@molecular-cad/molecule-model";
import { commit, createHistory } from "../src/editor/history";
import { blankDoc, docsFromMolecules, isPristine, parseWorkspace, serializeWorkspace } from "../src/state/workspace";

const sample = (id: string) => getSampleMolecule(id)!;

describe("workspace", () => {
  it("round-trips several molecules and the active tab", () => {
    const docs = docsFromMolecules([sample("ethanol"), sample("aspirin")]);
    const text = serializeWorkspace(docs, docs[1]!.id, true);
    const back = parseWorkspace(text)!;
    expect(back.activeIndex).toBe(1);
    expect(back.molecules.map((m) => m.name)).toEqual(["Ethanol", "Aspirin"]);
    expect(back.molecules[1]!.atoms).toHaveLength(21);
  });

  it("ignores text that is not a workspace and rejects broken ones", () => {
    expect(parseWorkspace("CCO")).toBeNull();
    expect(parseWorkspace(JSON.stringify({ kind: "other" }))).toBeNull();
    expect(() => parseWorkspace(JSON.stringify({ kind: "clapeyron-workspace", version: 1 }))).toThrow(/molecules/);
    expect(() => parseWorkspace(JSON.stringify({ kind: "clapeyron-workspace", version: 1, molecules: [{ nope: 1 }] }))).toThrow();
  });

  it("knows which tabs are untouched", () => {
    const doc = blankDoc();
    expect(isPristine(doc)).toBe(true);
    expect(isPristine({ ...doc, history: createHistory(sample("water")) })).toBe(false);
    expect(isPristine({ ...doc, history: commit(doc.history, { ...doc.history.present, name: "x" }, "rename") })).toBe(false);
  });
});
