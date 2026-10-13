# NioCM — The Agentic Terminal

<p align="center">
  <strong>Desktop-Grade Web Terminal Multiplexer for AI Coding Agents</strong><br>
  Built with Rust + Vue 3 + Shadcn-Vue + Xterm.js · Powered by NioAI
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nio-labs/nio-cm"><img src="https://img.shields.io/npm/v/@nio-labs/nio-cm.svg?style=flat-square" alt="npm version"></a>
  <a href="https://github.com/nio-labs/nio-cm/actions/workflows/ci.yml"><img src="https://github.com/nio-labs/nio-cm/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2Fnio-labs%2Fnio-cm"><img src="https://railway.app/button.svg" alt="Deploy on Railway" height="30"></a>
  &nbsp;&nbsp;
  <a href="https://app.koyeb.com/deploy?type=git&repository=github.com/nio-labs/nio-cm&branch=main&name=nio-cm"><img src="https://www.koyeb.com/static/images/deploy/button.svg" alt="Deploy to Koyeb" height="30"></a>
</p>

---

## Overview

**NioCM** (Nio Command Center) is an agentic terminal designed for human-agent pair programming. It combines a high-performance Rust PTY WebSocket backend with a responsive Vue 3 + Shadcn desktop interface featuring a 10-pane spatial grid.

- **Frontend**: Vue 3 (Composition API) + Shadcn-Vue tokens + Tailwind CSS + `@xterm/xterm` (FitAddon, WebLinksAddon).
- **Backend**: Rust (`axum` + `tokio` + `portable-pty`) serving both static PWA assets and WebSocket PTY streams on `http://localhost:1422`.
- **Heart of the Terminal**: Native integration with **NioAI** (`nio`).

---

## Supported Platforms

| OS | Architectures | Native Desktop App | CLI Daemon / PWA |
|---|---|---|---|
| **macOS** | Apple Silicon (`aarch64`), Intel (`x86_64`) | `curl` installer, `.dmg` | `npx`, Binary, `curl --cli` |
| **Linux** | `x86_64`, `aarch64` | `curl` installer, `.AppImage`, `.deb` | `npx`, Docker, Binary, `curl --cli` |
| **Windows** | `x86_64` | `.exe` installer, `.msi` | `npx`, Binary (`.exe`) |

---

## Quick Start

### 1. One-Line Desktop App Installer (macOS & Linux)

Install the full **NioCM Desktop Application** and CLI with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/nio-labs/nio-cm/main/install.sh | bash
```

- **macOS**: Downloads and installs `NioCM.app` into `/Applications` and configures the `niocm` CLI in your `PATH`.
- **Linux**: Downloads and installs `NioCM.AppImage`, creates a desktop menu entry (`.desktop`), and configures the `niocm` / `niocm-desktop` CLI.
- **NioAI Agent**: Automatically bundles and verifies the **NioAI** (`nio`) agent.

> **Windows**: Download the Windows installer (`.exe` setup or `.msi`) from [GitHub Releases](https://github.com/nio-labs/nio-cm/releases/latest).

### 2. Standalone CLI Daemon Only (Headless / Servers)

For remote servers, Docker, or headless environments without a desktop GUI:

```bash
curl -fsSL https://raw.githubusercontent.com/nio-labs/nio-cm/main/install.sh | bash -s -- --cli
niocm
```

### 3. Instant Run with NPX (Zero-Install)

Run NioCM directly in any directory without installing:

```bash
npx @nio-labs/nio-cm
# or
npx niocm
```

Or install globally via npm:

```bash
npm install -g @nio-labs/nio-cm
niocm
```

Under the hood, `npx @nio-labs/nio-cm` auto-detects your OS/arch, downloads and verifies the native binary via SHA-256 checksums, caches it in `~/.niocm/bin`, and launches the daemon.

### 4. Docker

```bash
docker run -d \
  -p 1422:1422 \
  --name nio-cm \
  ghcr.io/nio-labs/nio-cm:latest
```

### 5. 1-Click Cloud Deploy

Deploy your personal remote Agentic Terminal in seconds:

- **Railway**: Click the [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2Fnio-labs%2Fnio-cm) button. Automatic Dockerfile detection with port mapping and `/health` probes.
- **Koyeb**: Click the [![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?type=git&repository=github.com/nio-labs/nio-cm&branch=main&name=nio-cm) button or deploy using `koyeb.yaml`.

### 6. Build & Run from Source

```bash
# Build frontend
cd web && pnpm install && pnpm run build && cd ..

# Build & run Rust daemon
cargo build --release --manifest-path server/Cargo.toml
./target/release/niocm
```

Visit **`http://localhost:1422`** in your browser, or click **Install** to add NioCM to your desktop.

### 7. Development Mode (with HMR)

```bash
# Terminal 1: Backend daemon
cargo run --manifest-path server/Cargo.toml

# Terminal 2: Frontend with Vite HMR
cd web && pnpm dev
```
Open **`http://localhost:5174`**.

---

## Configuration & CLI Options

```
USAGE:
    niocm [OPTIONS]

OPTIONS:
    --port, -p <port>  Port to bind to (default: 1422 or PORT env)
    --host, -H <host>  Host to bind to (default: 0.0.0.0 or HOST env)
    --version, -V      Print version and exit
    --help, -h         Print help information

ENVIRONMENT:
    PORT               Port to bind to (auto-detected on Railway & Koyeb)
    HOST               Host to bind to (default: 0.0.0.0)
    NIOCM_STATIC_DIR   Override static files directory
    NIOCM_SERVER_BIN   Override native binary path (for npm wrapper)
```

---

## Features & Shortcuts

- 🖥️ **Desktop PWA + Native App**: Runs on `http://localhost:1422`, installable as a standalone application with an offline frontend, or ships as a native Tauri build for Windows, macOS, and Linux.
- 🪟 **10-Pane Spatial Grid**: Dynamic CSS Grid auto-scaling from 1 to 10 panes with hard limit enforcement.
- ⌨️ **2D Spatial Navigation**:
  - `Alt + ↑ / ↓ / ← / →`: Move focus across the 2D grid.
  - `Alt + Shift + ↑ / ↓ / ← / →`: Swap active pane position with adjacent neighbor without restarting processes.
  - `Alt + Z` or `Alt + Enter`: Zoom / Maximize active pane to 100%.
  - `Alt + N`: Spawn new NioAI agent pane.
  - `Alt + W`: Close active pane.
  - `Alt + 1` … `Alt + 0`: Direct jump to pane 1 through 10.
- 📁 **Session Management**: Left sidebar to organize project workspaces, inline renaming, and status indicators.
- 🛡️ **Ecosystem Ready**: Aligned with `nio`, `nio-db`, `nio-js`, and `nio-guard`.

---

## Install NioCM as a PWA Desktop App

Build the frontend and open `http://localhost:1422`. In Settings → Desktop app,
choose **Install NioCM** when your browser offers installation. You can also use
the browser's install menu. On iPhone and iPad, use **Share → Add to Home Screen**.
PWA installation and service workers require HTTPS or a trusted localhost origin.
The development server does not register a service worker, so HMR remains uncached.

On supported desktop Chrome and Edge installations, use the browser's title-bar
toggle to show or hide the window title bar. NioCM supports Window Controls Overlay
and reserves room for the native window buttons. The browser controls this toggle;
it is not available from a normal browser tab.

After the first successful visit, the production service worker caches the
interface, icons, and bundled Google Sans Code fonts. Workspace layouts and
settings continue to use browser storage. Terminal processes still require the
running NioCM daemon; the service worker does not cache WebSocket traffic or
`/health` responses. Optional fonts from Google Fonts require an internet connection.

---

## Native Desktop App (Tauri)

The same UI ships as a native desktop application for **Windows, macOS, and
Linux**. The Tauri shell (`src-tauri/`) runs the `niocm` daemon as a bundled
sidecar and loads `web/dist`; panes connect to `ws://127.0.0.1:1422` exactly as
before. The daemon is pinned to loopback in this mode, so PTY sessions are never
exposed to the network. If a daemon is already running, the app attaches to it
instead of starting a second one, and on exit it asks the daemon to reap every
PTY session (`POST /shutdown`) before terminating it.

### Install Desktop App

```bash
# macOS & Linux one-line installer
curl -fsSL https://raw.githubusercontent.com/nio-labs/nio-cm/main/install.sh | bash
```

Or download release packages directly from [GitHub Releases](https://github.com/nio-labs/nio-cm/releases/latest):
- **macOS (Apple Silicon)**: `NioCM_*_aarch64.dmg`
- **macOS (Intel)**: `NioCM_*_x64.dmg`
- **Linux (x64)**: `NioCM_*_amd64.AppImage` or `NioCM_*_amd64.deb`
- **Windows (x64)**: `NioCM_*_x64-setup.exe` or `NioCM_*_x64_en-US.msi`

### Building from Source

Prerequisites (once per OS):

- **Linux**: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`
- **macOS**: Xcode + Command Line Tools
- **Windows**: MSVC Build Tools (C++ workload); WebView2 runtime (preinstalled on Win10/11)
- All: Node 22+, pnpm, Rust stable

```bash
pnpm install            # once, installs the Tauri CLI at the repo root
pnpm install --dir web  # once, frontend dependencies
pnpm desktop:dev        # run the desktop app with HMR
pnpm desktop:build      # produce platform installers (msi/exe, dmg, deb/AppImage)
```

`desktop:dev` and `desktop:build` automatically build the `niocm` daemon and
stage it as a Tauri sidecar (`scripts/stage-sidecar.mjs` → `src-tauri/binaries/`);
run `pnpm desktop:sidecar` on its own after changing the Rust daemon. To
regenerate the app icons from `web/public/logo.svg`:

```bash
node_modules/.bin/tauri icon web/public/logo.svg -o src-tauri/icons
```

---

## Publishing releases

Push a version tag such as `v0.2.0` to run the release workflow. For a manual
run, select an existing version tag. The workflow sets the npm package version
from that tag; the npm launcher downloads binaries from the matching GitHub release.
Set the repository's `NPM_TOKEN` secret to enable npm publishing.

The same tag also runs `.github/workflows/desktop.yml`, which builds the native
desktop installers on `ubuntu-24.04`, `windows-latest`, and `macos-latest`
(x64 + arm64) and attaches them to the draft GitHub release. Without signing
secrets, macOS builds are ad-hoc signed (fine for testing); set `APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`,
and `APPLE_TEAM_ID` to sign and notarize for distribution.

Reruns skip npm versions that are already published. If npm reports that the
version is already staged, the workflow adds a warning and records the pending
approval in its job summary. The package is **not installable until approved**.
Sign in to npm as a package maintainer, review the upload in **Staged Packages**,
and approve it. If the contents are wrong, reject the staged upload before retrying.
See [npm's staged publishing documentation](https://docs.npmjs.com/cli/v11/commands/npm-stage/).

To publish changed code after a version is public, use a new version tag, such as
`v0.2.1`, so the npm version and GitHub binary release continue to match.

---

## License

[MIT](LICENSE) © 2026 Nio Labs Team
