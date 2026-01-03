# ========================================
# Gateway Service Dockerfile
# ========================================
# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-alpine

# Build stage
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY apps/gateway ./apps/gateway
COPY libs ./libs

# Build the gateway service
RUN pnpm build:gateway

# Production stage
FROM node:${NODE_VERSION} AS production

ENV NODE_ENV=production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Install pnpm for production deps
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy workspace files for prod deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install production dependencies only
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --production

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist/apps/gateway ./dist

# Install wget for healthcheck
RUN apk add --no-cache wget

# Switch to non-root user
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "dist/main.js"]
