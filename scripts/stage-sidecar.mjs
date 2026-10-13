// Stages the compiled niocm daemon as a Tauri sidecar (src-tauri/binaries/niocm-<target-triple>).
// Runs automatically before `pnpm desktop:dev` / `pnpm desktop:build` via pnpm pre-scripts.
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";

function targetTriple() {
  if (platform() === "win32") {
    return arch() === "x64" ? "x86_64-pc-windows-msvc" : "aarch64-pc-windows-msvc";
  }
  if (platform() === "darwin") {
    return arch() === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  }
  return arch() === "x64" ? "x86_64-unknown-linux-gnu" : "aarch64-unknown-linux-gnu";
}

const triple = targetTriple();
const exe = platform() === "win32" ? "niocm.exe" : "niocm";

execSync(`cargo build --manifest-path server/Cargo.toml --target ${triple}`, {
  stdio: "inherit",
});

const from = join("target", triple, "debug", exe);
const toDir = join("src-tauri", "binaries");
const to = join(toDir, `niocm-${triple}${platform() === "win32" ? ".exe" : ""}`);
mkdirSync(toDir, { recursive: true });
copyFileSync(from, to);
console.log(`[niocm] sidecar staged: ${to}`);
