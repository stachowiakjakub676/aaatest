import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

/**
 * Visual smoke test: the viewport really renders the molecule (not a blank canvas) and the
 * label overlay matches the graph. A full-page screenshot is attached to the report for humans;
 * pixel-exact baselines are deliberately not enforced because software rendering differs
 * between machines.
 */
test("renders aspirin with element colours and one label per atom", async ({ page }, testInfo) => {
  await openApp(page);
  await page.selectOption("#sample-select", "aspirin");
  await expect(page.locator(".atom-label")).toHaveCount(21);
  await page.waitForTimeout(300);

  const stats = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".viewport-canvas")!;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return null;
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let red = 0;
    let grey = 0;
    let bg = 0;
    for (let i = 0; i < px.length; i += 16) {
      const r = px[i]!;
      const g = px[i + 1]!;
      const b = px[i + 2]!;
      if (r > 180 && g < 90 && b < 90) red++;
      else if (Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 90 && r < 200) grey++;
      else bg++;
    }
    return { red, grey, bg, sampled: px.length / 16 };
  });
  expect(stats).not.toBeNull();
  // Oxygen red and carbon grey must both be present; the background must dominate.
  expect(stats!.red).toBeGreaterThan(20);
  expect(stats!.grey).toBeGreaterThan(200);
  expect(stats!.bg).toBeGreaterThan(stats!.red + stats!.grey);

  const shot = await page.screenshot({ fullPage: true });
  await testInfo.attach("aspirin", { body: shot, contentType: "image/png" });
});
