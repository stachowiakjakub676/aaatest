import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

const celsius = (s: string) => Number(/(-?\d+(?:\.\d+)?) °C/.exec(s)?.[1]);

test("phase tab: vacuum boiling point, conditions and the P–T diagram", async ({ page }) => {
  const errors = await openApp(page);
  await page.selectOption("#sample-select", "ethanol");
  await page.click("#tab-phase");
  await expect(page.locator("#phase")).toContainText("Acentric factor");
  await expect(page.locator("#phase")).toContainText("Triple point");
  // Default preset is the rotary evaporator (20 mbar): far below the normal boiling point.
  const vac = celsius(await page.locator("#vac-result").innerText());
  expect(vac).toBeLessThan(30);
  await page.getByRole("button", { name: "1 atm" }).click();
  const atm = celsius(await page.locator("#vac-result").innerText());
  expect(atm).toBeCloseTo(64.4, 0); // the Joback Tb of ethanol (337.5 K)
  expect(atm - vac).toBeGreaterThan(40);
  await page.fill("#vac-pressure", "0");
  await expect(page.locator("#vac-result")).toContainText("enter a pressure");
  await page.fill("#vac-pressure", "500");
  await page.selectOption("#vac-unit", "bar");
  await expect(page.locator("#vac-result")).toContainText("no boiling above pc");
  // Conditions: liquid at 25 °C / 1 atm, gas at 200 °C, solid far below the melting estimate.
  await page.getByRole("button", { name: "1 atm" }).click();
  await expect(page.locator("#cond-phase")).toHaveText("liquid");
  await page.fill("#cond-temperature", "200");
  await expect(page.locator("#cond-phase")).toHaveText("gas");
  await page.fill("#cond-temperature", "-200");
  await expect(page.locator("#cond-phase")).toHaveText("solid");
  await expect(page.locator(".phase-diagram svg path.series")).toHaveCount(3);
  await expect(page.locator(".phase-diagram .legend")).toContainText("liquid–vapour");
  // The chemistry tab carries the same numbers as predictions with reasoning.
  await page.click("#tab-chemistry");
  await expect(page.locator("#estimates")).toContainText("Boiling point at 20 mbar", { timeout: 30_000 });
  await expect(page.locator("#estimates")).toContainText("Hansen parameters");
  expect(errors.list).toEqual([]);
});

test("materials tab: Hansen parameters, solvent ranking and greener substitutes", async ({ page }) => {
  const errors = await openApp(page);
  await page.selectOption("#sample-select", "ethanol");
  await page.click("#tab-materials");
  await expect(page.locator("#hansen")).toContainText("δd dispersion");
  await expect(page.locator("#hansen")).toContainText("Molar volume");
  await page.locator("#hansen summary").click();
  await expect(page.locator("#hansen .breakdown")).toContainText("−OH");
  // Ethanol-like parameters rank the alcohols first.
  const rows = page.locator("#solvent-match .solvent-table tbody tr");
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText(/Ethanol|Methanol|2-Propanol|1-Butanol/);
  await expect(rows.first()).toContainText("similar");
  await page.selectOption("#match-class", "recommended");
  await expect(page.locator("#solvent-match .class-chip")).toHaveCount(await page.locator("#solvent-match .class-chip.class-0").count());
  // DCM replacement: ethyl acetate is among the top substitutes.
  await page.selectOption("#replace-solvent", "dcm");
  await expect(page.locator("#greener")).toContainText("Dichloromethane");
  await expect(page.locator("#greener .alternatives")).toContainText("Ethyl acetate");
  await expect(page.locator("#greener .alternatives .class-chip.class-2")).toHaveCount(0);
  await page.selectOption("#replace-class", "recommended");
  await expect(page.locator("#greener .alternatives .class-chip.class-1")).toHaveCount(0);
  // The assistant answers solvent and vacuum questions from the same report (once the estimates are in).
  await page.click("#tab-chemistry");
  await expect(page.locator("#estimates")).toContainText("Boiling point at 20 mbar", { timeout: 30_000 });
  await page.click("#tab-assistant");
  await page.fill("#assistant-question", "w jakiej temperaturze wrze na rotawaporze?");
  await page.click("#btn-ask");
  await expect(page.locator(".qa-thread")).toContainText("20 mbar", { timeout: 20_000 });
  await page.fill("#assistant-question", "which solvent should I use?");
  await page.click("#btn-ask");
  await expect(page.locator(".qa-thread")).toContainText("Hansen parameters");
  expect(errors.list).toEqual([]);
});

test("phase and materials refuse structures outside their group tables", async ({ page }) => {
  const errors = await openApp(page);
  await page.selectOption("#sample-select", "caffeine"); // fused hetero-aromatic rings
  await page.click("#tab-materials");
  await expect(page.locator("#hansen")).toContainText("refuses rather than guess");
  await expect(page.locator("#solvent-match")).toHaveCount(0);
  await expect(page.locator("#greener")).toBeVisible(); // the replacement tool does not need the molecule
  expect(errors.list).toEqual([]);
});
