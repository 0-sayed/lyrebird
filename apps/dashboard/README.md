# Lyrebird Dashboard

Production-grade frontend dashboard for Lyrebird sentiment analysis platform.

## Tech Stack

- **Build Tool:** Vite 6.x
- **Framework:** React 19
- **UI Components:** shadcn/ui (Radix primitives)
- **Data Fetching:** TanStack Query v5
- **Styling:** Tailwind CSS 3.x
- **Charts:** Recharts 2.x
- **Testing:** Vitest + Testing Library
- **E2E Testing:** Playwright

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+

### Development

```bash
# From the monorepo root
pnpm install

# Start the dev server (from apps/dashboard)
cd apps/dashboard
pnpm dev

# Or from monorepo root
pnpm --filter @lyrebird/dashboard dev
```

The app will be available at `http://localhost:5173`

### Scripts

| Command              | Description                  |
| -------------------- | ---------------------------- |
| `pnpm dev`           | Start development server     |
| `pnpm build`         | Build for production         |
| `pnpm preview`       | Preview production build     |
| `pnpm test`          | Run unit tests in watch mode |
| `pnpm test:run`      | Run unit tests once          |
| `pnpm test:coverage` | Run tests with coverage      |
| `pnpm test:e2e`      | Run Playwright E2E tests     |
| `pnpm lint`          | Run ESLint                   |
| `pnpm type-check`    | Run TypeScript type checking |

## Project Structure

```
apps/dashboard/
├── public/                    # Static assets
├── src/
│   ├── __tests__/             # Test utilities and setup
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── common/            # Shared components (ThemeToggle, etc.)
│   │   ├── layout/            # Layout components (coming in Phase 2)
│   │   ├── conversation/      # Chat UI components (coming in Phase 2)
│   │   └── sentiment/         # Sentiment visualization (coming in Phase 3)
│   ├── hooks/                 # Custom React hooks (coming in Phase 2)
│   ├── lib/                   # Utilities and API client
│   ├── providers/             # React context providers
│   └── types/                 # TypeScript type definitions
├── components.json            # shadcn/ui configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite configuration
└── vitest.config.ts           # Vitest configuration
```

## Security

This app follows security best practices:

- **Vite fs.strict:** Prevents directory traversal attacks (CVE-2025-30208)
- **DOMPurify:** XSS sanitization for user-generated content
- **Zod validation:** Runtime validation of API responses
- **CSP headers:** Content Security Policy (configure in production)

## API Integration

The app connects to the Lyrebird Gateway API:

- **Development:** Proxied via Vite (`/api` → `localhost:3000`)
- **Production:** Configure `VITE_API_URL` environment variable

## Theming

Supports light, dark, and system themes. Theme preference is persisted to localStorage.

## Phase 1 Complete

Phase 1 includes:

- ✅ Vite + React + TypeScript setup
- ✅ shadcn/ui component library
- ✅ Theme system with persistence
- ✅ TanStack Query configuration
- ✅ API client with Zod validation
- ✅ XSS protection utilities
- ✅ Testing infrastructure

Next phases will add:

- Phase 2: Conversational UI, API hooks, SSE integration
- Phase 3: Sentiment charts, E2E tests, accessibility
