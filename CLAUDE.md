# Lyrebird

Distributed microservices for real-time Bluesky sentiment analysis.

## Architecture

NestJS monorepo with RabbitMQ message passing:

- `apps/gateway` - REST API (port 3000)
- `apps/ingestion` - Bluesky scraper (port 3001)
- `apps/analysis` - Sentiment engine (port 3002)
- `apps/dashboard` - React frontend (Vite)
- `libs/*` - Shared modules (database, rabbitmq, bluesky, logger, shared-types, testing)

## Commands

```bash
pnpm start:all                             # Run all services with hot-reload
pnpm test                                  # All unit tests
pnpm test -- --testPathPattern=<pattern>   # Single backend test
pnpm validate                              # Full validation (lint + type-check + test + knip + build)
docker compose up -d                       # Start infrastructure (Postgres, RabbitMQ)
pnpm db:studio                             # Drizzle Studio for DB inspection
```

## Conventions

- Conventional commits required
- Libs use `@app/*` path aliases (e.g., `@app/database`)
- Tests colocated with source (`.spec.ts`)
- Services communicate via RabbitMQ patterns defined in `libs/shared-types`

## Dashboard (apps/dashboard)

- Vite + React 19 + Tailwind + shadcn/ui (new-york style, zinc base)
- TanStack Query for server state, Recharts + Lightweight Charts for visualization
- Uses `@/*` path aliases (maps to `./src/*`)
- Vitest + Testing Library for unit tests, Playwright for e2e
- MSW for API mocking in tests
- API requests proxied to gateway via Vite dev server (`/api` -> `localhost:3000`)

```bash
pnpm --filter dashboard dev              # Dev server (port 5173)
pnpm --filter dashboard test:run         # All unit tests
pnpm --filter dashboard test:run <file>  # Single unit test
pnpm --filter dashboard test:e2e         # Playwright e2e tests
```

## Gotchas

- Backend uses Jest, dashboard uses Vitest - don't mix test APIs
- Dashboard is a separate pnpm workspace - always use `pnpm --filter dashboard <cmd>`
- Run `docker compose up -d` before starting services (needs Postgres + RabbitMQ)
- ML models cached in `models-cache/` - first run downloads ~500MB
