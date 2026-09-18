import { expect, test } from "@playwright/test";
import { openApp, panelText, statusText, tapAtom, tapEmptyCentre } from "./helpers";

test("assistant explains computed results and applies suggestions only on confirmation", async ({ page }) => {
  const errors = await openApp(page);
  await tapEmptyCentre(page);
  await tapAtom(page, 0);
  await tapAtom(page, 1);
  await page.click("#tab-assistant");
  await expect(page.locator(".inspector")).toContainText("Add 8 explicit hydrogens");
  // Nothing changes until Apply is pressed.
  expect(await statusText(page)).toContain("Add C to");
  await page.click("text=Apply (undoable)");
  await expect(page.locator(".statusbar")).toContainText("Apply suggestion: Add 8 explicit hydrogens");
  await expect(page.locator("#btn-undo")).toHaveAttribute("title", /Undo: Apply suggestion/);

  await page.click("#btn-explain");
  await expect(page.locator(".explanation")).toContainText("has 11 atoms (3 heavy)");
  await expect(page.locator(".explanation")).toContainText("built-in templates");

  await page.selectOption("#explainer-select", "remote");
  await page.click("#btn-explain");
  await expect(page.locator(".inspector")).toContainText(/unreachable|Server/, { timeout: 15_000 });
  expect(errors.list).toEqual([]);
});

test("mock retrosynthesis ranks conceptual disconnections and stores reaction notes with provenance", async ({ page }) => {
  await openApp(page);
  await page.selectOption("#sample-select", "aspirin");
  await page.click("#tab-retro");
  await page.click("#btn-retro");
  await expect(page.locator(".inspector")).toContainText(/conceptual disconnections/i, { timeout: 30_000 });
  const text = await panelText(page);
  expect(text).toContain("Ester, Carboxylic acid, Aromatic six-membered ring");
  expect(text).toContain("no screener configured");
  const first = page.locator(".candidate").first();
  await expect(first).toContainText("#1 Ester C(=O)–O disconnection");
  await expect(first).toContainText("CC=O");
  await first.locator(".candidate-body").click();
  expect(await statusText(page)).toContain("1 bond");
  await expect(first).toContainText("Not provided: the mock has no reaction knowledge base");

  // Add user notes: they appear with provenance "your notes" and survive re-selection.
  await first.locator("#btn-add-reaction").click();
  await first.getByLabel("Reagent name").first().fill("example reagent");
  await first.getByLabel("Temperature").fill("25");
  await first.getByLabel("Yield", { exact: true }).fill("70");
  await first.getByLabel("Procedure").fill("my own lab notes");
  await first.locator("#btn-save-reaction").click();
  await expect(first).toContainText("your notes");
  await expect(first).toContainText("70 % (isolated)");
  await expect(first).toContainText("my own lab notes");
});
