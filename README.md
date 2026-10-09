# NioCM — The Agentic Terminal

<p align="center">
  <strong>Desktop-Grade Web Terminal Multiplexer for AI Coding Agents</strong><br>
  Built with Rust + Vue 3 + Shadcn-Vue + Xterm.js · Powered by NioAI
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

## Features

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

## Quick Start

### 1. Instant Run with NPX

Run NioCM directly without installing:

```bash
npx @nio-labs/nio-cm
# or
npx niocm
```

Or install globally:

```bash
npm install -g @nio-labs/nio-cm
niocm
```

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

### 2. Development Mode (with HMR)

```bash
# Terminal 1: Backend daemon
cargo run --manifest-path server/Cargo.toml

# Terminal 2: Frontend with Vite HMR
cd web && pnpm dev
```
Open **`http://localhost:5174`**.

### Install NioCM as an app

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

New versions display an update prompt and can also be reviewed in Settings.
Updates never reload an active workspace automatically. **Reload and update**
stops active terminal processes and restores the saved pane layout, so finish or
save terminal work before applying an update.
