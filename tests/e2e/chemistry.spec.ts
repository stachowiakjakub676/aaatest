import { expect, test } from "@playwright/test";
import { openApp, panelText, tapAtom, tapEmptyCentre } from "./helpers";

test("in-browser RDKit computes properties and reports valence errors", async ({ page }) => {
  const errors = await openApp(page);
  // Ethanol skeleton: C, C, O.
  await tapEmptyCentre(page);
  await tapAtom(page, 0);
  await page.click("#el-O");
  await tapAtom(page, 1);
  await page.click("#tab-chemistry");
  await expect(page.locator(".inspector")).toContainText("Canonical SMILES", { timeout: 30_000 });
  const text = await panelText(page);
  expect(/Canonical SMILES \| CCO/.test(text)).toBe(true);
  expect(text).toContain("LFQSCWFLJHTTHZ-UHFFFAOYSA-N"); // ethanol InChIKey
  expect(text).toContain("ESOL"); // predictions are a separate, labelled section

  // Make it chemically impossible (C≡C≡O) and check both validators react.
  await page.click("#tool-bond");
  await page.click("#order-triple");
  await tapAtom(page, 0);
  await tapAtom(page, 1);
  await tapAtom(page, 1);
  await tapAtom(page, 2);
  await expect(page.locator(".inspector")).toContainText("RDKIT_VALENCE", { timeout: 20_000 });
  await expect(page.locator(".inspector")).not.toContainText("Canonical SMILES");
  await page.click("#tab-inspect");
  await expect(page.locator(".inspector")).toContainText("VALENCE_EXCEEDED");
  expect(errors.list).toEqual([]);
});

test("geometry optimisation is only offered by the server engine", async ({ page }) => {
  await openApp(page);
  await page.selectOption("#sample-select", "ethanol");
  await page.click("#tab-chemistry");
  await expect(page.locator("#btn-optimize")).toBeDisabled();
  await expect(page.locator(".inspector")).toContainText("only available with the server engine");
});
