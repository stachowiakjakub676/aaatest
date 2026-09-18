# Packaging (phase 10)

One web client, three delivery shapes. The chemistry core stays portable: RDKit WebAssembly runs
inside the page everywhere; the Python API is optional and adds force-field optimisation, ETKDG
conformers and the language-model explainer.

| Target                  | Shape                                             | Chemistry available offline           | Status                        |
| ----------------------- | ------------------------------------------------- | ------------------------------------- | ----------------------------- |
| Any browser / iPad now  | `apps/web/dist/clapeyron.html` (single file)  | RDKit WASM (embedded)                 | built by `pnpm build` and CI  |
| iPad / phone, installed | PWA from the multi-file build (`apps/web/dist/`)  | RDKit WASM (cached by service worker) | manifest + service worker done; needs static hosting over https |
| Windows / macOS / Linux | Tauri 2 shell (`apps/desktop`)                    | RDKit WASM; Python API as a sidecar   | built by the "Desktop installers" GitHub Actions workflow (see below) |

## Single-file build (what you have been testing)

`pnpm build` writes `apps/web/dist/clapeyron.html` (≈10 MB): the app, the RDKit glue and the
wasm bytes, instantiated through Emscripten's `instantiateWasm` hook so nothing is fetched. Open
it from Files on an iPad, from a USB stick, or host it anywhere. CI uploads it as an artifact.

## PWA (iPad "Add to Home Screen", offline)

`apps/web/public/` carries `manifest.webmanifest`, the icons (`icons/logo.svg` is the source;
the PNG sizes are rendered from it) and `sw.js`, a cache-first service worker that
precaches the shell and the RDKit engine. `main.tsx` registers it only when served over http(s).

1. `pnpm build`, then host `apps/web/dist/` on any static https server (GitHub Pages, S3, nginx).
2. On the iPad open the URL in Safari, Share → Add to Home Screen. After the first load the app
   and the engine are cached and work without connectivity.
3. To use the server engine from the PWA, run `services/api` somewhere reachable over https and
   enter its URL in the Chemistry tab (CORS is open by default; restrict `allow_origins` for
   production).

An App Store build would wrap the same `dist/` with Capacitor; nothing in the client depends on
desktop-only APIs.

## Desktop installers without a local toolchain (GitHub Actions)

`.github/workflows/desktop.yml` builds Clapeyron on GitHub's Windows, macOS and Linux runners:

1. On GitHub open **Actions → Desktop installers → Run workflow** (branch of your choice).
2. When the three jobs finish, download the artifacts `clapeyron-Windows` (NSIS `.exe` and
   `.msi`), `clapeyron-macOS` (`.dmg`) and `clapeyron-Linux` (AppImage and `.deb`).
3. Pushing a tag such as `v0.2.0` runs the same build and attaches the installers to a GitHub
   release.

The installers are unsigned: Windows SmartScreen and macOS Gatekeeper will warn on first launch
until a code-signing certificate is added to the workflow (Tauri supports both through
environment variables).

## Building the installer locally (Tauri 2)

Prerequisites on the build machine: Rust stable, the
[Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) for the OS (on Windows: Visual
Studio Build Tools + WebView2), Node 22, pnpm 10.

```bash
pnpm install
pnpm --filter @molecular-cad/desktop icons        # regenerates src-tauri/icons/* from icon-1024.png (the Clapeyron logo)
pnpm --filter @molecular-cad/desktop dev          # runs the Vite dev server inside the shell
pnpm --filter @molecular-cad/desktop build        # produces NSIS (.exe) and MSI installers on Windows
```

`tauri.conf.json` points `frontendDist` at `apps/web/dist`, runs the web build first, and ships a
strict CSP (`wasm-unsafe-eval` for RDKit, `connect-src` limited to `localhost:8000` for the API).
The scaffold has not been compiled in this repository's development environment (no GTK/WebView
toolchain there); expect the usual first-build download of the Tauri crates.

### Python API as a sidecar (optional)

The desktop app works fully without Python. To bundle the API for MMFF94 optimisation and ETKDG:

1. Build a one-file binary of `services/api` with PyInstaller on each target OS
   (`pyinstaller --onefile --name molecular-cad-api -m uvicorn app.main:app` style entry, plus
   RDKit's data files via `--collect-all rdkit`).
2. Place it in `apps/desktop/src-tauri/binaries/molecular-cad-api-<target-triple>` and list it
   under `bundle.externalBin` in `tauri.conf.json`.
3. Spawn it from `lib.rs` with `tauri-plugin-shell` on startup (`Command::sidecar`), bind to
   `127.0.0.1:8000`, and the client's default server URL already matches.

## Release checklist

- `pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
- Python: `pytest` in `packages/chem-core` and `services/api`
- Bump `version` in `apps/web/package.json`, `apps/desktop/src-tauri/tauri.conf.json` and `Cargo.toml`
- Tag; CI attaches `clapeyron.html`; build installers on the platform runners
