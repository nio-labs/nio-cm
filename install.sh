#!/bin/sh
# NioCM installer
#
# Installs the native NioCM Desktop application for Linux and macOS,
# configures the terminal CLI, and bundles the NioAI agent.
# Re-running the script upgrades to the newest version.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/nio-labs/nio-cm/main/install.sh | bash
#
# Options:
#   VERSION=x.y.z bash install.sh          Install a specific version (default: latest)
#   bash install.sh --desktop              Install Desktop application (default)
#   bash install.sh --cli                  Install standalone CLI daemon only (headless)
#   bash install.sh --dry-run              Print what would happen, change nothing
#   bash install.sh --force                Reinstall even when the version matches
#
# Environment:
#   NIOCM_INSTALL_DIR                     Install directory for CLI (default ~/.local/bin, or
#                                         /usr/local/bin when run as root)

set -eu

REPO="nio-labs/nio-cm"
DRY_RUN=0
FORCE=0
MODE="desktop"

usage() {
  echo "Usage: bash install.sh [--desktop | --cli] [--dry-run] [--force]"
  echo "       VERSION=x.y.z bash install.sh [--desktop | --cli] [--dry-run] [--force]"
}

for arg in "$@"; do
  case "$arg" in
    --desktop) MODE="desktop" ;;
    --cli) MODE="cli" ;;
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    -h | --help) usage; exit 0 ;;
    *) echo "unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

# --- Detect OS / arch ----------------------------------------------------------

OS="$(uname -s 2>/dev/null || echo unknown)"
ARCH="$(uname -m 2>/dev/null || echo unknown)"

case "$OS" in
  Linux) OS_SUFFIX="linux" ;;
  Darwin) OS_SUFFIX="darwin" ;;
  *)
    echo "error: unsupported OS '$OS'. NioCM supports Linux and macOS." >&2
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64 | amd64) ARCH_SUFFIX="x86_64" ;;
  aarch64 | arm64) ARCH_SUFFIX="aarch64" ;;
  *)
    echo "error: unsupported architecture '$ARCH'. Supported: x86_64, aarch64." >&2
    exit 1
    ;;
esac

SUFFIX="${OS_SUFFIX}-${ARCH_SUFFIX}"

if ! command -v curl >/dev/null 2>&1; then
  echo "error: curl is required to install NioCM" >&2
  exit 1
fi

# --- Resolve version -----------------------------------------------------------

if [ -z "${VERSION:-}" ]; then
  echo "Fetching the latest NioCM release…" >&2
  TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" |
    sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  if [ -z "$TAG" ]; then
    echo "error: could not determine the latest release from GitHub." >&2
    echo "       Set VERSION=x.y.z to install a specific version." >&2
    exit 1
  fi
else
  case "$VERSION" in
    v*) TAG="$VERSION" ;;
    *) TAG="v${VERSION}" ;;
  esac
fi

VER="${TAG#v}"
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"

# --- Install directory ----------------------------------------------------------

if [ "$(id -u)" -eq 0 ]; then
  INSTALL_DIR="${NIOCM_INSTALL_DIR:-/usr/local/bin}"
else
  INSTALL_DIR="${NIOCM_INSTALL_DIR:-${HOME}/.local/bin}"
fi

# --- Helper: Install CLI binary ------------------------------------------------

install_cli_binary() {
  local BIN_NAME="$1"
  local ASSET="${BIN_NAME}-${SUFFIX}"
  local DEST="${INSTALL_DIR}/${BIN_NAME}"

  echo "Installing CLI: ${BIN_NAME} ${TAG} (${SUFFIX}) → ${DEST}" >&2
  echo "  download: ${BASE_URL}/${ASSET}" >&2

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "(dry run — nothing installed)" >&2
    return 0
  fi

  mkdir -p "$INSTALL_DIR"

  # No-op upgrade when the installed version already matches (unless --force).
  if [ "$FORCE" -eq 0 ] && [ -x "$DEST" ] && "$DEST" --version 2>/dev/null | grep -q " ${VER}"; then
    echo "${BIN_NAME} ${VER} is already installed at ${DEST}." >&2
    return 0
  fi

  local TMP_DIR
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT

  echo "Verifying SHA-256 checksum…" >&2
  curl -fsSL "${BASE_URL}/SHA256SUMS" -o "${TMP_DIR}/SHA256SUMS"
  local EXPECTED
  EXPECTED="$(awk -v a="${ASSET}" '$2 == a || $2 == ("*" a) { print $1; exit }' "${TMP_DIR}/SHA256SUMS")"

  if [ -z "$EXPECTED" ]; then
    echo "error: no checksum found for ${ASSET} in SHA256SUMS." >&2
    exit 1
  fi

  curl -fsSL "${BASE_URL}/${ASSET}" -o "${TMP_DIR}/${ASSET}"

  local ACTUAL
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL="$(sha256sum "${TMP_DIR}/${ASSET}" | awk '{print $1}')"
  else
    ACTUAL="$(shasum -a 256 "${TMP_DIR}/${ASSET}" | awk '{print $1}')"
  fi

  if [ "$ACTUAL" != "$EXPECTED" ]; then
    echo "error: checksum mismatch for ${ASSET}." >&2
    echo "  expected: ${EXPECTED}" >&2
    echo "  actual:   ${ACTUAL}" >&2
    exit 1
  fi

  install -m 0755 "${TMP_DIR}/${ASSET}" "$DEST"
  ln -sf "$DEST" "${INSTALL_DIR}/nio-cm"
  echo "✓ Installed ${BIN_NAME} to ${DEST}" >&2
}

# --- Helper: Install Desktop App on macOS --------------------------------------

install_desktop_macos() {
  local MAC_ARCH
  if [ "$ARCH_SUFFIX" = "aarch64" ]; then
    MAC_ARCH="aarch64"
  else
    MAC_ARCH="x64"
  fi
  local ASSET="NioCM_${VER}_${MAC_ARCH}.dmg"
  local DMG_URL="${BASE_URL}/${ASSET}"

  echo "Downloading NioCM Desktop for macOS (${MAC_ARCH})…" >&2
  echo "  download: ${DMG_URL}" >&2

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "(dry run — NioCM.app would be installed to /Applications/NioCM.app)" >&2
    install_cli_binary "niocm"
    return 0
  fi

  local TMP_DIR
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT

  curl -fSL "$DMG_URL" -o "${TMP_DIR}/${ASSET}"

  local MOUNT_DIR="${TMP_DIR}/mount"
  mkdir -p "$MOUNT_DIR"
  echo "Mounting disk image…" >&2
  hdiutil attach -nobrowse -readonly -mountpoint "$MOUNT_DIR" "${TMP_DIR}/${ASSET}" >/dev/null

  echo "Installing to /Applications/NioCM.app…" >&2
  rm -rf /Applications/NioCM.app
  cp -R "${MOUNT_DIR}/NioCM.app" /Applications/
  hdiutil detach "$MOUNT_DIR" >/dev/null

  echo "✓ Installed NioCM Desktop to /Applications/NioCM.app" >&2

  # Also install CLI daemon for terminal access
  install_cli_binary "niocm"
}

# --- Helper: Install Desktop App on Linux --------------------------------------

install_desktop_linux() {
  if [ "$ARCH_SUFFIX" != "x86_64" ]; then
    echo "Notice: Native desktop GUI builds for Linux ${ARCH_SUFFIX} are coming soon." >&2
    echo "Installing the high-performance CLI daemon…" >&2
    install_cli_binary "niocm"
    return 0
  fi

  local ASSET="NioCM_${VER}_amd64.AppImage"
  local APPIMAGE_URL="${BASE_URL}/${ASSET}"
  local APP_DIR="${HOME}/.local/share/niocm"
  local DEST="${APP_DIR}/NioCM.AppImage"

  echo "Downloading NioCM Desktop for Linux (${ARCH_SUFFIX})…" >&2
  echo "  download: ${APPIMAGE_URL}" >&2

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "(dry run — NioCM AppImage would be installed to ${DEST})" >&2
    install_cli_binary "niocm"
    return 0
  fi

  mkdir -p "$APP_DIR" "$INSTALL_DIR"

  local TMP_DIR
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT

  curl -fSL "$APPIMAGE_URL" -o "${TMP_DIR}/${ASSET}"
  install -m 0755 "${TMP_DIR}/${ASSET}" "$DEST"

  # Create desktop launcher script
  cat <<EOF > "${INSTALL_DIR}/niocm-desktop"
#!/bin/sh
exec "${DEST}" "\$@"
EOF
  chmod +x "${INSTALL_DIR}/niocm-desktop"

  # Create .desktop file for system application menu
  local DESKTOP_DIR="${HOME}/.local/share/applications"
  mkdir -p "$DESKTOP_DIR"
  cat <<EOF > "${DESKTOP_DIR}/nio-cm.desktop"
[Desktop Entry]
Name=NioCM
Comment=The Agentic Terminal — Desktop Web & Native App powered by NioAI
Exec=${DEST} %U
Terminal=false
Type=Application
Icon=utilities-terminal
Categories=Development;System;TerminalEmulator;
StartupWMClass=niocm-desktop
EOF

  echo "✓ Installed NioCM Desktop AppImage to ${DEST}" >&2
  echo "✓ Created application menu launcher at ${DESKTOP_DIR}/nio-cm.desktop" >&2
  echo "✓ Created desktop command at ${INSTALL_DIR}/niocm-desktop" >&2

  # Also install CLI binary for terminal access
  install_cli_binary "niocm"
}

# --- Dispatch installation -----------------------------------------------------

if [ "$MODE" = "desktop" ]; then
  case "$OS" in
    Darwin) install_desktop_macos ;;
    Linux)  install_desktop_linux ;;
  esac
else
  install_cli_binary "niocm"
fi

# --- Bundle NioAI agent (mandatory for AI chat & terminal intelligence) --------

install_nio() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "Would check and install NioAI agent (@nio-labs/nio-ai)..." >&2
    return 0
  fi

  echo "Checking NioAI agent (@nio-labs/nio-ai)..." >&2
  if command -v nio >/dev/null 2>&1; then
    echo "NioAI is already installed ($(command -v nio))" >&2
    return 0
  fi

  echo "Installing NioAI agent (@nio-labs/nio-ai)..." >&2
  local INSTALLED=0
  if command -v npm >/dev/null 2>&1; then
    echo "Attempting install via npm (npm install -g @nio-labs/nio-ai)..." >&2
    if npm install -g @nio-labs/nio-ai >/dev/null 2>&1; then
      INSTALLED=1
      echo "Installed @nio-labs/nio-ai via npm" >&2
    fi
  fi

  if [ "$INSTALLED" -eq 0 ]; then
    echo "Attempting install via native installer (curl)..." >&2
    if curl -fsSL https://raw.githubusercontent.com/nio-labs/nio/main/install.sh | bash; then
      INSTALLED=1
      echo "Installed nio via native installer" >&2
    else
      echo "warning: could not automatically install @nio-labs/nio-ai. You can install it later with: npx @nio-labs/nio-ai" >&2
    fi
  fi
}

install_nio

# --- Post-install notes --------------------------------------------------------

case ":$PATH:" in
  *":${INSTALL_DIR}:"*) : ;;
  *) echo "note: ${INSTALL_DIR} is not on your PATH." >&2
     echo "     Add it, e.g.:  export PATH=\"${INSTALL_DIR}:\$PATH\"" >&2 ;;
esac

echo >&2
if [ "$MODE" = "desktop" ]; then
  if [ "$OS" = "Darwin" ]; then
    echo "Launch NioCM Desktop:  Open 'NioCM' from /Applications (or Spotlight)" >&2
  else
    echo "Launch NioCM Desktop:  Open 'NioCM' from application menu or run '${INSTALL_DIR}/niocm-desktop'" >&2
  fi
  echo "CLI Terminal Daemon:   ${INSTALL_DIR}/niocm (or nio-cm)" >&2
else
  echo "Start NioCM Daemon:    ${INSTALL_DIR}/niocm (or nio-cm)" >&2
  echo "Open in browser:       http://localhost:1422" >&2
fi

if command -v nio >/dev/null 2>&1; then
  echo "NioAI agent bundled:   $(command -v nio)" >&2
fi
echo "Re-run this installer any time to upgrade." >&2
