import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

test("design workspace: build a specification, validate it and check the open molecule against it", async ({ page }) => {
  const errors = await openApp(page);
  await page.selectOption("#sample-select", "ethanol");
  await page.click("#tab-chemistry");
  await expect(page.locator("#estimates")).toContainText("Normal boiling point", { timeout: 30_000 });
  await page.click("#view-design");
  await expect(page.locator(".design-view")).toBeVisible();
  await expect(page.locator("#spec-issues")).toContainText("The specification is empty");
  await page.fill("#spec-name", "Green solvent, mid-boiling");

  // A boiling-point range: incomplete first, then satisfied by ethanol's predicted 64 °C.
  await page.click("#btn-add-constraint");
  await expect(page.locator("#spec-issues")).toContainText("a range needs both a lower and an upper bound");
  const row = page.locator(".constraint-row").first();
  await row.getByLabel("Lower bound").fill("60");
  await row.getByLabel("Upper bound").fill("80");
  await expect(page.locator("#spec-issues")).toContainText("complete and consistent");
  await expect(page.locator("#preview-overall")).toHaveText("✓ pass");
  await expect(page.locator("#spec-preview")).toContainText("Normal boiling point between 60 and 80 °C");
  await expect(page.locator("#spec-preview .check-table")).toContainText("predicted");

  // Molecular weight at most 40 g/mol: ethanol (46) fails, and the sheet says why.
  await page.click("#btn-add-constraint");
  const row2 = page.locator(".constraint-row").nth(1);
  await row2.locator("select.prop").selectOption("mw");
  await row2.locator("select.op").selectOption("<=");
  await row2.getByLabel("Upper bound").fill("40");
  await expect(page.locator("#preview-overall")).toHaveText("✗ fail");
  await expect(page.locator("#spec-preview tr.check-fail")).toHaveAttribute("title", /46.1 g\/mol is above 40 g\/mol/);

  // A category constraint and a structural rule.
  await page.click("#btn-add-constraint");
  const row3 = page.locator(".constraint-row").nth(2);
  await row3.locator("select.prop").selectOption("acidBase");
  await expect(row3.locator(".chip-on")).toHaveText("neutral");
  await page.click("#allow-C");
  await page.click("#allow-O");
  await expect(page.locator("#spec-preview")).toContainText("Elements limited to C, O");
  await expect(page.locator("#spec-preview tr.check-pass")).toHaveCount(3);
  await page.fill("#spec-required", "[OX2H]");
  await page.locator("#spec-required").blur();
  await expect(page.locator("#spec-preview")).toContainText("phase 3B");
  await expect(page.locator("#preview-overall")).toHaveText("✗ fail"); // the weight constraint still fails

  // Soft preference with weight; persists across a reload.
  await page.click("#btn-add-preference");
  await expect(page.locator("#sheet-soft")).toContainText("Aqueous solubility, log S: higher is better (weight 0.50)");
  await page.reload();
  await page.click("#view-design");
  await expect(page.locator("#spec-name")).toHaveValue("Green solvent, mid-boiling");
  await expect(page.locator(".constraint-row")).toHaveCount(4);

  // Export downloads a specification file.
  const download = page.waitForEvent("download");
  await page.click("#btn-spec-export");
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.clapeyron-spec\.json$/);
  const text = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks as Buffer[]).toString("utf8"));
  expect(text).toContain('"kind": "clapeyron-specification"');
  expect(text).toContain('"property": "mw"');
  await page.click("#btn-open-editor");
  await expect(page.locator(".viewport-area")).toBeVisible();
  expect(errors.list).toEqual([]);
});
