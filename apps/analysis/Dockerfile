# ========================================
# Analysis Service Dockerfile
# ========================================
# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-alpine

# Build stage
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY apps/analysis ./apps/analysis
COPY libs ./libs

RUN pnpm build:analysis

# Production stage
FROM node:${NODE_VERSION} AS production

ENV NODE_ENV=production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --production

COPY --from=builder --chown=nodejs:nodejs /app/dist/apps/analysis ./dist

RUN apk add --no-cache wget

USER nodejs

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3002}/health || exit 1

CMD ["node", "dist/main.js"]
