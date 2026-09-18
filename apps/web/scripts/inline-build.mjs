// Produces dist/molecular-cad.html: the Vite build with its JS and CSS inlined.
// A single self-contained file is the simplest thing to open on an iPad, host as an
// artifact, or hand to someone by e-mail. dist/index.html (multi-file) is kept as well.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
let html = readFileSync(join(dist, "index.html"), "utf8");

html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+)"[^>]*><\/script>/g, (_m, file) => {
  const js = readFileSync(join(dist, file), "utf8").replace(/<\/script>/g, "<\\/script>");
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+)"[^>]*>/g, (_m, file) => {
  const css = readFileSync(join(dist, file), "utf8");
  return `<style>${css}</style>`;
});
// Vite emits a modulepreload link for the entry; it is meaningless once inlined.
html = html.replace(/<link rel="modulepreload"[^>]*>/g, "");

const out = join(dist, "molecular-cad.html");
writeFileSync(out, html);
const size = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`wrote ${out} (${size} kB); assets: ${readdirSync(join(dist, "assets")).join(", ")}`);
