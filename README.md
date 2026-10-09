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

| OS | Architectures | Method |
|---|---|---|
| **Linux** | `x86_64`, `aarch64` | `npx`, `curl` installer, Docker, Binary |
| **macOS** | Apple Silicon (`aarch64`), Intel (`x86_64`) | `npx`, `curl` installer, Binary |
| **Windows** | `x86_64` | `npx`, Binary (`.exe`) |

---

## Quick Start

### 1. Instant Run with NPX (Zero-Install)

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

### 2. One-Line Native Installer (Linux & macOS)

Downloads the pre-built native binary for your architecture, verifies SHA-256 checksums, and installs to `~/.local/bin`:

```bash
curl -fsSL https://raw.githubusercontent.com/nio-labs/nio-cm/main/install.sh | bash
niocm
```

### 3. Docker

```bash
docker run -d \
  -p 1422:1422 \
  --name nio-cm \
  ghcr.io/nio-labs/nio-cm:latest
```

### 4. 1-Click Cloud Deploy

Deploy your personal remote Agentic Terminal in seconds:

- **Railway**: Click the [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2Fnio-labs%2Fnio-cm) button. Automatic Dockerfile detection with port mapping and `/health` probes.
- **Koyeb**: Click the [![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?type=git&repository=github.com/nio-labs/nio-cm&branch=main&name=nio-cm) button or deploy using `koyeb.yaml`.

### 5. Build & Run from Source

```bash
# Build frontend
cd web && pnpm install && pnpm run build && cd ..

# Build & run Rust daemon
cargo build --release --manifest-path server/Cargo.toml
./target/release/niocm
```

Visit **`http://localhost:1422`** in your browser, or click **Install** to add NioCM to your desktop.

### 6. Development Mode (with HMR)

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

- 🖥️ **Desktop PWA Shell**: Runs on `http://localhost:1422`, installable as a standalone application with an offline frontend.
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

## License

[MIT](LICENSE) © 2026 Nio Labs Team
