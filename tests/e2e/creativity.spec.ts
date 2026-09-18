import { expect, test } from "@playwright/test";
import { openApp, panelText, statusText, tapAtom } from "./helpers";

test("display styles and hidden hydrogens re-render from the same graph", async ({ page }) => {
  const errors = await openApp(page);
  await page.selectOption("#sample-select", "aspirin");
  await expect(page.locator(".atom-label")).toHaveCount(21);
  await page.check("#toggle-hide-h");
  await expect(page.locator(".atom-label")).toHaveCount(13); // heavy atoms only
  await page.selectOption("#style-select", "spacefill");
  await page.waitForTimeout(300);
  await expect(page.locator(".atom-label")).toHaveCount(13);
  await page.selectOption("#style-select", "sticks");
  await page.uncheck("#toggle-hide-h");
  await expect(page.locator(".atom-label")).toHaveCount(21);
  // The graph never changed: still C9H8O4 and no history entry.
  expect(await panelText(page)).toContain("C9H8O4");
  await expect(page.locator("#btn-undo")).toBeDisabled();
  expect(errors.list).toEqual([]);
});

test("stereo labels appear from 3D coordinates and mirror flips them", async ({ page }) => {
  await openApp(page);
  await page.selectOption("#sample-select", "glucose");
  await expect(page.locator(".atom-label.has-stereo")).toHaveCount(5, { timeout: 30_000 });
  const before = await page.locator(".atom-label.has-stereo").allInnerTexts();
  await page.click("#btn-mirror");
  await expect(page.locator(".statusbar")).toContainText("Mirror");
  await expect(page.locator(".atom-label.has-stereo")).toHaveCount(5, { timeout: 30_000 });
  await expect
    .poll(async () => (await page.locator(".atom-label.has-stereo").allInnerTexts()).join(","), { timeout: 30_000 })
    .not.toBe(before.join(","));
  await page.click("#tab-chemistry");
  await expect(page.locator(".inspector")).toContainText("Stereochemistry");
  await expect(page.locator(".inspector")).toContainText("Aqueous solubility, log S");
  await expect(page.locator(".inspector")).toContainText("Delaney");
  await expect(page.locator(".inspector")).toContainText("open PubChem");
});

test("builds a new compound from fragments and gets estimates for it", async ({ page }) => {
  const errors = await openApp(page);
  await page.selectOption("#sample-select", "benzene");
  await page.click("#tool-select");
  await tapAtom(page, 0); // a ring carbon
  await page.getByRole("radio", { name: "Groups" }).click();
  await expect(page.locator("#frag-carboxy")).toBeEnabled();
  await page.click("#frag-carboxy");
  await expect(page.locator(".statusbar")).toContainText("Attach Carboxy");
  expect(await panelText(page)).toContain("C7H6O2"); // benzoic acid
  // Attach a fragment to the new attachment atom's neighbour ring: pick another ring carbon.
  await tapAtom(page, 2);
  await page.getByRole("radio", { name: "Halogens" }).click();
  await page.click("#frag-chloro");
  expect(await panelText(page)).toContain("C7H5ClO2");
  await page.click("#tab-chemistry");
  await expect(page.locator(".inspector")).toContainText("Canonical SMILES", { timeout: 30_000 });
  await expect(page.locator(".inspector")).toContainText("log S");
  await expect(page.locator(".inspector")).toContainText("InChIKey");
  await page.keyboard.press("Control+z");
  await page.click("#tab-inspect");
  expect(await statusText(page)).toContain("Undo: Attach");
  expect(errors.list).toEqual([]);
});
