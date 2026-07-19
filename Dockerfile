# ============================================================
# sparkDash — Multi-DGX Spark Monitoring Dashboard
# Dockerfile for arm64 (DGX Spark GB10 platform)
# ============================================================

FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ make python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ============================================================
# Production image — lean runtime
# ============================================================
FROM node:22-bookworm-slim

# SSH client + sshpass for remote Sparks; util-linux provides nsenter for host GPU/net
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client sshpass procps util-linux iproute2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy server code + package files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/server ./server
COPY --from=builder /app/config ./config

# Install production deps only
RUN npm ci --omit=dev

# Volume for persistent sparks.json
VOLUME /app/config

# Expose dashboard port
EXPOSE 5555

# Default environment
ENV PORT=5555
ENV LLM_PORT=8888
ENV NODE_ENV=production

CMD ["node", "server/index.js"]