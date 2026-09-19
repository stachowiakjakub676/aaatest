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
  await expect(page.locator("#spec-preview")).toContainText("runs on generated candidates");
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

test("design workspace: generate derivatives of the editor molecule, validate them and open one", async ({ page }) => {
  const errors = await openApp(page);
  await page.selectOption("#sample-select", "ethanol");
  await page.click("#tab-chemistry");
  await expect(page.locator("#estimates")).toContainText("Normal boiling point", { timeout: 30_000 });
  await page.click("#view-design");
  await page.click("#btn-spec-new");
  await page.fill("#spec-name", "Small alcohols");
  await page.click("#allow-C");
  await page.click("#allow-O");
  await page.fill("#heavy-max", "5");
  await page.fill("#spec-required", "[OX2H]");
  await page.locator("#spec-required").blur();
  // A hard constraint the derivatives split on: molecular weight ≤ 62 g/mol (propanols pass, butanols fail).
  await page.click("#btn-add-constraint");
  const mwRow = page.locator(".constraint-row").first();
  await mwRow.locator("select.prop").selectOption("mw");
  await mwRow.locator("select.op").selectOption("<=");
  await mwRow.getByLabel("Upper bound").fill("62");
  // Two soft preferences → a two-objective ranking with a Pareto front.
  await page.click("#btn-add-preference");
  await page.click("#btn-add-preference");
  const pref2 = page.locator("#soft-preferences .constraint-row").nth(1);
  await pref2.locator("select.prop").selectOption("tb");
  await pref2.locator("select.op").selectOption("minimize");
  await page.fill("#gen-limit", "40");
  await page.click("#btn-generate");
  await expect(page.locator("#run-summary")).toContainText("valid of 40 generated", { timeout: 90_000 });
  await expect(page.locator("#run-summary")).toContainText(/[1-9]\d* pass/);
  await expect(page.locator("#run-summary")).toContainText(/[1-9]\d* fail/);
  const rows = page.locator(".candidate-table tbody tr:not(.checks-row)");
  await expect(rows).toHaveCount(40);
  await expect(page.locator(".candidate-table")).toContainText("attach Methyl (C) at C");
  await expect(page.locator(".candidate-table")).toContainText("lacks required substructure [OX2H]"); // methyl on the OH oxygen
  await expect(page.locator(".candidate-table")).toContainText("heavy atoms, more than 5");
  await expect(page.locator(".candidate-table")).toContainText("is above 62 g/mol");
  await expect(page.locator(".candidate-table th", { hasText: "Molecular weight (g/mol)" })).toBeVisible();
  await expect(page.locator("#candidates")).toContainText("rdkit-wasm");
  await expect(page.locator("#candidates")).toContainText("Joback");
  await expect(page.locator("#tradeoffs")).toContainText("best candidate");
  await expect(page.locator("#pareto-front")).toContainText("Pareto front");
  await expect(page.locator(".candidate-table .rank-badge.front").first()).toBeVisible();
  await expect(page.locator("#tradeoffs .xy-chart svg circle").first()).toBeVisible();
  await page.locator("#cand-filter").getByRole("radio", { name: "passing", exact: true }).click();
  const passing = await rows.count();
  expect(passing).toBeGreaterThan(0);
  expect(passing).toBeLessThan(40);
  await expect(page.locator(".candidate-table tr.check-fail")).toHaveCount(0);
  // Expand the checks of the first passing candidate: every hard requirement listed with its reason.
  await rows.first().locator(".link-btn").click();
  await expect(page.locator(".checks-row")).toContainText("Molecular weight ≤ 62 g/mol");
  await expect(page.locator(".checks-row")).toContainText("Must contain [OX2H]");
  await page.locator("#cand-filter").getByRole("radio", { name: "all" }).click();
  // Open the first valid candidate: it becomes a new editor tab, the seed stays.
  await page.locator(".candidate-table tr.check-pass").first().getByRole("button", { name: "Open" }).click();
  await expect(page.locator(".viewport-area")).toBeVisible();
  await expect(page.locator(".doc-tabs [role=tab]")).toHaveCount(2);
  await expect(page.locator(".doc-tabs [role=tab][aria-selected=true]")).toContainText("Ethanol + Methyl");
  // A borderline verdict: the seed's predicted boiling point misses a tight range by less than the model error.
  await page.click("#view-design");
  await page.click("#btn-add-constraint");
  const row = page.locator(".constraint-row").nth(1);
  await row.getByLabel("Lower bound").fill("70");
  await row.getByLabel("Upper bound").fill("90");
  await expect(page.locator("#preview-overall")).toHaveText("△ borderline");
  expect(errors.list).toEqual([]);
});
