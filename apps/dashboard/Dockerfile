# syntax=docker/dockerfile:1
# ========================================
# Dashboard Service Dockerfile
# ========================================

ARG NODE_VERSION=22-alpine
ARG PNPM_VERSION=10.23.0

# Build stage
FROM node:${NODE_VERSION} AS builder

ARG PNPM_VERSION

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@"${PNPM_VERSION}" --activate

# Copy all workspace files needed for pnpm install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY libs ./libs

# Install dependencies using filter for dashboard only
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @lyrebird/dashboard...

# Build the dashboard
WORKDIR /app/apps/dashboard
RUN pnpm build

# Production stage
FROM nginx:1.27-alpine AS production

# NOTE: Using port 8080 allows running as non-root user if needed.
# Worker processes run as the 'nginx' user (configured in nginx.conf).
# Static files are owned by nginx for defense in depth.

# Copy nginx configuration
COPY apps/dashboard/nginx.conf /etc/nginx/nginx.conf

# Copy built static files with nginx ownership
COPY --from=builder --chown=nginx:nginx /app/apps/dashboard/dist /usr/share/nginx/html

# Copy entrypoint script
COPY apps/dashboard/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Ensure nginx user owns writable directories and pid file
RUN chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

EXPOSE 8080

USER nginx

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
