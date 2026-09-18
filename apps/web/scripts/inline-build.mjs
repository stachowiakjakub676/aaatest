// Produces dist/molecular-cad.html: the Vite build with its JS and CSS inlined, plus the RDKit
// WebAssembly engine embedded (glue script inline, .wasm as base64) so the page needs no network
// and no server: open it in Safari on an iPad, host it anywhere, or hand it over by e-mail.
// dist/index.html (multi-file, loads ./rdkit/* lazily) is kept as well.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
let html = readFileSync(join(dist, "index.html"), "utf8");

const escapeScript = (s) => s.replace(/<\/script>/g, "<\\/script>");

html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+)"[^>]*><\/script>/g, (_m, file) => {
  const js = readFileSync(join(dist, file), "utf8");
  return `<script type="module">${escapeScript(js)}</script>`;
});
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+)"[^>]*>/g, (_m, file) => {
  const css = readFileSync(join(dist, file), "utf8");
  return `<style>${css}</style>`;
});
html = html.replace(/<link rel="modulepreload"[^>]*>/g, "");

// Embed RDKit before the app script so window.initRDKitModule and the wasm bytes are ready.
const glue = readFileSync(join(dist, "rdkit", "RDKit_minimal.js"), "utf8");
const wasm = readFileSync(join(dist, "rdkit", "RDKit_minimal.wasm")).toString("base64");
const rdkitScripts = `<script>window.__RDKIT_WASM_BASE64=${JSON.stringify(wasm)};</script>\n<script>${escapeScript(glue)}</script>\n`;
html = html.replace(/<script type="module">/, `${rdkitScripts}<script type="module">`);

const out = join(dist, "molecular-cad.html");
writeFileSync(out, html);
const size = (Buffer.byteLength(html) / (1024 * 1024)).toFixed(1);
console.log(`wrote ${out} (${size} MB, RDKit embedded); assets: ${readdirSync(join(dist, "assets")).join(", ")}`);
