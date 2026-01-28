# ========================================
# Analysis Service Dockerfile
# ========================================
# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-alpine
ARG PNPM_VERSION=10.23.0

# Build stage
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@"${PNPM_VERSION}" --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY apps/analysis ./apps/analysis
COPY libs ./libs

RUN pnpm build:analysis

# Production stage - using slim (Debian) instead of Alpine for glibc compatibility
# onnxruntime-node requires glibc, which Alpine's musl cannot provide
FROM node:22-slim AS production

ARG PNPM_VERSION=10.23.0

ENV NODE_ENV=production

WORKDIR /app

RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs -s /bin/false nodejs

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --production

COPY --from=builder --chown=nodejs:nodejs /app/dist/apps/analysis ./dist

# Install wget for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends wget && \
    rm -rf /var/lib/apt/lists/*

# Pre-download the sentiment analysis model during build
# This avoids runtime downloads and ensures the container works offline
ENV ML_MODEL_CACHE_DIR=/app/models-cache
RUN mkdir -p /app/models-cache && \
    node -e "import('@huggingface/transformers').then(m => m.pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', { dtype: 'q8', cache_dir: '/app/models-cache' }))" && \
    chown -R nodejs:nodejs /app/models-cache

USER nodejs

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3002}/health || exit 1

CMD ["node", "dist/main.js"]
