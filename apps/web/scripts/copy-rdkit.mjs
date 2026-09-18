// Copies the RDKit WebAssembly build into public/rdkit so the dev server and the multi-file
// build can serve it next to the page. Runs before `dev` and `build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("@rdkit/rdkit"));
const out = new URL("../public/rdkit/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
for (const f of ["RDKit_minimal.js", "RDKit_minimal.wasm"]) copyFileSync(join(dist, f), join(out, f));
console.log(`copied RDKit_minimal.{js,wasm} from ${dist} to public/rdkit/`);
