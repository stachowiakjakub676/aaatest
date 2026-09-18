import { expect, test } from "@playwright/test";
import { openApp, panelText, statusText } from "./helpers";

test("imports SMILES through the dialog and exports every format", async ({ page }) => {
  const errors = await openApp(page);
  await page.keyboard.press("Control+o");
  await page.fill("#import-text", "c1ccccc1O");
  await expect(page.locator(".modal")).toContainText("smiles");
  await page.click("text=Parse and validate");
  await expect(page.locator("#btn-import-confirm")).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator(".import-summary")).toContainText("13 atoms, 13 bonds");
  await expect(page.locator(".import-summary")).toContainText("passed");
  await page.click("#btn-import-confirm");
  expect(await statusText(page)).toContain("Import SMILES");
  expect(await panelText(page)).toContain("13 / 13");

  await page.keyboard.press("Control+s");
  await page.selectOption("#export-format", "smiles");
  await expect(page.locator("#export-text")).toHaveValue("Oc1ccccc1", { timeout: 20_000 });
  await page.selectOption("#export-format", "sdf");
  await expect(page.locator("#export-text")).toHaveValue(/\$\$\$\$/);
  await page.selectOption("#export-format", "molfile");
  await expect(page.locator("#export-text")).toHaveValue(/V2000/);
  await page.selectOption("#export-format", "mcad-json");
  await expect(page.locator("#export-text")).toHaveValue(/"schemaVersion": 1/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal")).toHaveCount(0);

  // Round trip: the exported MOL block imports back with the same atom count.
  await page.keyboard.press("Control+s");
  await page.selectOption("#export-format", "molfile");
  const mol = await page.locator("#export-text").inputValue();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+o");
  await page.fill("#import-text", mol);
  await page.click("text=Parse and validate");
  await expect(page.locator(".import-summary")).toContainText("MOLFILE · 13 atoms, 13 bonds");
  await page.click("#btn-import-confirm");
  expect(await panelText(page)).toContain("13 / 13");
  expect(errors.list).toEqual([]);
});

test("blocks imports with structural errors", async ({ page }) => {
  await openApp(page);
  const bad = {
    schemaVersion: 1,
    id: "bad",
    atoms: [{ id: "c", element: "C", formalCharge: 0, position: { x: 0, y: 0, z: 0 } }, ...[1, 2, 3, 4, 5].map((i) => ({ id: `h${i}`, element: "H", formalCharge: 0, position: { x: i, y: 0, z: 0 } }))],
    bonds: [1, 2, 3, 4, 5].map((i) => ({ id: `b${i}`, atomA: "c", atomB: `h${i}`, order: "single" })),
  };
  await page.keyboard.press("Control+o");
  await page.fill("#import-text", JSON.stringify(bad));
  await page.click("text=Parse and validate");
  await expect(page.locator(".import-summary")).toContainText("VALENCE_EXCEEDED");
  await expect(page.locator("#btn-import-confirm")).toBeDisabled();
});
