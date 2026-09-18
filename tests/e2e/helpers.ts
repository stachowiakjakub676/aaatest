import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Playwright transpiles these files as CommonJS, so __dirname is available.
export const APP_URL = pathToFileURL(path.resolve(__dirname, "../../apps/web/dist/molecular-cad.html")).href;

export interface AppErrors {
  list: string[];
}

/** Open the built app, wait for the in-browser RDKit engine, collect page errors. */
export async function openApp(page: Page): Promise<AppErrors> {
  const errors: AppErrors = { list: [] };
  page.on("pageerror", (e) => errors.list.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // Google Fonts is blocked in some sandboxes; that is not an application error.
    if (m.type() === "error" && !/ERR_CERT|fonts\.g|ERR_CONNECTION_REFUSED/.test(m.text())) errors.list.push(`console: ${m.text()}`);
  });
  await page.goto(APP_URL);
  await page.click("#tab-chemistry");
  await expect(page.locator(".inspector .status-chip.ok")).toBeVisible({ timeout: 60_000 });
  await page.click("#tab-inspect");
  return errors;
}

export const statusText = async (page: Page) => (await page.locator(".statusbar").innerText()).replace(/\n/g, " | ");
export const panelText = async (page: Page) => (await page.locator(".inspector").innerText()).replace(/\n/g, " | ");

/** Screen position of atom i, read from the CSS2D label transform (exact projected centre). */
export async function atomScreen(page: Page, i: number): Promise<[number, number]> {
  const box = await page.locator(".viewport-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  const t = await page.locator(".atom-label").nth(i).evaluate((el) => (el as HTMLElement).style.transform);
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(t);
  if (!m) throw new Error(`label ${i} has no transform: ${t}`);
  return [box.x + parseFloat(m[1]!), box.y + parseFloat(m[2]!)];
}

export async function tapAtom(page: Page, i: number): Promise<void> {
  const [x, y] = await atomScreen(page, i);
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
}

export async function tapEmptyCentre(page: Page): Promise<void> {
  const box = await page.locator(".viewport-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(150);
}
