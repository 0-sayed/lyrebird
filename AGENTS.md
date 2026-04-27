# Repository Guidelines

## Project Structure & Module Organization

Lyrebird is a `pnpm` monorepo. Backend services live in `apps/gateway`, `apps/ingestion`, and `apps/analysis`; the React dashboard lives in `apps/dashboard`. Shared code is in `libs/*` (`database`, `rabbitmq`, `bluesky`, `logger`, `shared-types`, `testing`). Backend tests are colocated as `*.spec.ts` plus service-level files under `apps/*/test`. Dashboard unit tests live under `apps/dashboard/src`, end-to-end tests under `apps/dashboard/e2e`, and static assets under `apps/dashboard/public`.

## Build, Test, and Development Commands

Use Node 22+ and `pnpm`.

- `pnpm install`: install workspace dependencies.
- `docker compose up -d`: start local Postgres and RabbitMQ.
- `pnpm start:all`: run backend services in watch mode.
- `pnpm --filter dashboard dev`: run the Vite dashboard locally.
- `pnpm lint` and `pnpm type-check`: run static checks.
- `pnpm test`, `pnpm test:integration`, `pnpm --filter dashboard test:run`, `pnpm --filter dashboard test:e2e`: run backend, integration, dashboard unit, and dashboard e2e suites.
- `pnpm validate`: run the full validation chain before opening a PR.

## Coding Style & Naming Conventions

TypeScript is the default across backend and frontend. ESLint and Prettier enforce style; run them instead of hand-formatting. Follow existing NestJS naming such as `*.module.ts`, `*.service.ts`, and `*.controller.ts`. Use PascalCase for React components, camelCase for functions/variables, and `_name` for intentionally unused parameters. Prefer backend imports through `@app/*` aliases and dashboard imports through `@/*`. Do not add inline lint-disable comments; the repo config rejects them.

## Testing Guidelines

Backend uses Jest, dashboard unit tests use Vitest, and dashboard browser tests use Playwright. Add or update tests with the change you make. Use `*.spec.ts` for unit tests, `*.integration.spec.ts` for integration coverage, and `*.e2e-spec.ts` for backend e2e cases. Keep verification targeted locally, then use `pnpm validate` before review.

## Security & Configuration Tips

Keep secrets in local `.env` files and never commit credentials. Use the root Docker Compose setup for local infrastructure, and prefer checked-in scripts such as `pnpm db:migrate` and `pnpm db:studio` for database work.
