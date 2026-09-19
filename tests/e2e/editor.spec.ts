import { expect, test } from "@playwright/test";
import { atomScreen, openApp, panelText, statusText, tapAtom, tapEmptyCentre } from "./helpers";

test("builds a structure from an empty canvas, closes a ring, undoes and redoes", async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator(".viewport-empty")).toBeVisible();

  await tapEmptyCentre(page);
  expect(await statusText(page)).toContain("Add C");
  for (let i = 0; i < 5; i++) await tapAtom(page, i);
  await expect(page.locator(".atom-label")).toHaveCount(6);

  // Close the ring with the bond tool; auto-tidy relaxes it to ideal C-C lengths.
  await page.click("#tool-bond");
  await tapAtom(page, 0);
  await tapAtom(page, 5);
  expect(await statusText(page)).toMatch(/Bond a\d+-a\d+ \(single\)/);
  const length = /Length \| ([\d.]+) Å/.exec(await panelText(page))?.[1];
  expect(parseFloat(length ?? "0")).toBeGreaterThan(1.45);
  expect(parseFloat(length ?? "9")).toBeLessThan(1.6);

  await page.click("#btn-undo");
  await expect(page.locator(".statusbar")).toContainText("Undo: Bond");
  await page.click("#btn-redo");
  await expect(page.locator(".statusbar")).toContainText("Redo: Bond");

  // Add hydrogens, then change an element through the inspector.
  await page.click("#btn-add-h");
  await expect(page.locator(".inspector")).toContainText("C6H12");
  await page.click("#tool-select");
  await tapAtom(page, 0);
  await page.selectOption("#inspector-element", "N");
  await expect(page.locator(".inspector")).toContainText("C5H12N");

  // Delete tool + keyboard undo.
  await page.click("#tool-delete");
  await tapAtom(page, 1);
  await expect(page.locator(".statusbar")).toContainText("Delete");
  await page.keyboard.press("Control+z");
  await expect(page.locator(".statusbar")).toContainText("Undo: Delete");

  expect(errors.list).toEqual([]);
});

test("move tool drags an atom and records one undo step", async ({ page }) => {
  await openApp(page);
  await page.selectOption("#sample-select", "water");
  await page.click("#tool-move");
  const [x, y] = await atomScreen(page, 1);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 40, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".statusbar")).toContainText("Move a2");
  await expect(page.locator("#btn-undo")).toHaveAttribute("title", /Undo: Move a2/);
});
