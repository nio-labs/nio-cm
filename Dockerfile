# ==============================================================================
# Stage 1: Build Web Frontend
# ==============================================================================
FROM node:22-bookworm-slim AS web-builder

WORKDIR /usr/src/nio-cm/web

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY web/package.json web/pnpm-lock.yaml* web/pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY web/ ./
RUN pnpm build

# ==============================================================================
# Stage 2: Build Rust Server binary
# ==============================================================================
FROM rust:1-slim-bookworm AS server-builder

WORKDIR /usr/src/nio-cm

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY server/ ./server/
COPY --from=web-builder /usr/src/nio-cm/web/dist ./web/dist

RUN cargo build --release --locked --bin niocm

# ==============================================================================
# Stage 3: Runtime image
# ==============================================================================
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    git \
    bash \
    procps \
    python3 \
    python3-pip \
    build-essential \
    nodejs \
    npm \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Pre-install Nio CLI and NioAI agent
RUN npm install -g @nio-labs/nio-ai || true
RUN curl -fsSL https://raw.githubusercontent.com/nio-labs/nio/main/install.sh | bash || true

# Copy compiled binary and create alias symlink
COPY --from=server-builder /usr/src/nio-cm/target/release/niocm /usr/local/bin/niocm
RUN ln -sf /usr/local/bin/niocm /usr/local/bin/nio-cm

# Copy static frontend assets as optional disk fallback
COPY --from=web-builder /usr/src/nio-cm/web/dist /app/web/dist

# Set up persistent workspace volume
RUN mkdir -p /workspace /root/.local/bin /root/.nio/bin
WORKDIR /workspace

# Default environment configuration
ENV PORT=1422 \
    HOST=0.0.0.0 \
    NIOCM_STATIC_DIR=/app/web/dist \
    HOME=/root \
    PATH=/root/.local/bin:/root/.nio/bin:/usr/local/bin:$PATH

EXPOSE 1422

CMD ["niocm"]
