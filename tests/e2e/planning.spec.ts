import { expect, test } from "@playwright/test";
import { openApp, panelText, tapAtom } from "./helpers";

test("estimated properties come with breakdowns and reasoning", async ({ page }) => {
  const errors = await openApp(page);
  await page.selectOption("#sample-select", "ethanol");
  await page.click("#tab-chemistry");
  await expect(page.locator("#estimates")).toContainText("Normal boiling point", { timeout: 30_000 });
  const text = await panelText(page);
  expect(text).toMatch(/Physical \(group contribution\)/i);
  expect(text).toMatch(/Normal boiling point \| 64\.\d+ °C/); // Joback: 337.5 K
  expect(text).toContain("Physical state at 25 °C | liquid");
  expect(text).toContain("Acid/base character in water | neutral");
  await page.locator("#estimates details").first().locator("summary").click();
  await expect(page.locator("#estimates .breakdown").first()).toBeVisible();
  await expect(page.locator("#estimates")).toContainText("hydrogen bonding");
  await expect(page.locator("#estimates")).toContainText("−OH (alcohol)");
  expect(errors.list).toEqual([]);
});

test("assistant answers questions from the report and the planner finds the aspirin route", async ({ page }) => {
  const errors = await openApp(page);
  await page.selectOption("#sample-select", "aspirin");
  await page.click("#tab-chemistry");
  await expect(page.locator(".property-sheet")).toBeVisible({ timeout: 30_000 }); // estimates are in the report
  await page.click("#tab-assistant");
  await expect(page.locator(".inspector")).toContainText("Ask about this molecule");
  await page.getByRole("button", { name: "Is it acidic or basic?" }).click();
  await expect(page.locator(".qa-thread")).toContainText("Carboxylic acid: pKa ≈ 4–5", { timeout: 20_000 });
  await page.fill("#assistant-question", "why is the boiling point high?");
  await page.click("#btn-ask");
  await expect(page.locator(".qa-thread")).toContainText("Predicted boiling point about");
  await expect(page.locator(".qa-thread")).toContainText("hydrogen-bonded dimers");

  await page.click("#tab-retro");
  await page.click("#btn-plan");
  await expect(page.locator("#synthesis")).toContainText("Fischer esterification", { timeout: 30_000 });
  await expect(page.locator("#synthesis")).toContainText("salicylic acid");
  await expect(page.locator("#synthesis")).toContainText("acetic acid");
  await expect(page.locator("#synthesis")).toContainText("common building block");
  // Tapping a step highlights the ester bond in the viewport; the assistant now knows the route.
  await page.locator(".route-step").first().click();
  await expect(page.locator(".statusbar")).toContainText("1 bond");
  await page.click("#tab-assistant");
  await page.getByRole("button", { name: "How would I make it?" }).click();
  await expect(page.locator(".qa-thread")).toContainText("Step 1:");
  expect(errors.list).toEqual([]);
});

test("fragment search and attach-from-SMILES extend the library without limit", async ({ page }) => {
  const errors = await openApp(page);
  await page.selectOption("#sample-select", "benzene");
  await page.click("#tool-select");
  await tapAtom(page, 0);
  await page.fill("#fragment-search", "indol");
  await expect(page.locator("#frag-indol-3-yl")).toBeVisible();
  await expect(page.locator("#frag-phenyl")).toHaveCount(0);
  await page.fill("#fragment-search", "");
  await page.getByRole("radio", { name: "Protecting" }).click();
  await expect(page.locator("#frag-boc-amino")).toBeEnabled();
  await page.fill("#fragment-smiles", "C(=O)NC");
  await page.click("#btn-attach-smiles");
  await expect(page.locator(".statusbar")).toContainText("Attach C(=O)NC", { timeout: 20_000 });
  expect(await panelText(page)).toContain("C8H9NO"); // N-methylbenzamide
  expect(errors.list).toEqual([]);
});
