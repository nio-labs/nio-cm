# NioCM — The Agentic Terminal

<p align="center">
  <strong>Desktop-Grade Web Terminal Multiplexer for AI Coding Agents</strong><br>
  Built with Rust + Vue 3 + Shadcn-Vue + Xterm.js · Powered by NioAI
</p>

---

## Overview

**NioCM** (Nio Command Center) is an agentic terminal designed for human-agent pair programming. It combines a high-performance Rust PTY WebSocket backend with a responsive Vue 3 + Shadcn desktop interface featuring a 10-pane spatial grid.

- **Frontend**: Vue 3 (Composition API) + Shadcn-Vue tokens + Tailwind CSS + `@xterm/xterm` (FitAddon, WebLinksAddon).
- **Backend**: Rust (`axum` + `tokio` + `portable-pty`) serving both static PWA assets and WebSocket PTY streams on `http://localhost:1422`.
- **Heart of the Terminal**: Native integration with **NioAI** (`nio`).

---

## Features

- 🖥️ **Desktop PWA Shell**: Runs on `http://localhost:1422`, installable as a frameless standalone desktop application.
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

### 1. Build & Run Standalone

```bash
# Build frontend
cd web
pnpm install
pnpm run build
cd ..

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
