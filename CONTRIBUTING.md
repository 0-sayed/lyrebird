# Contributing to Lyrebird

Thank you for your interest in contributing to Lyrebird!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/lyrebird.git`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development Setup

```bash
# Start infrastructure
docker compose up -d

# Run all services in development
pnpm start:all

# Run tests
pnpm test

# Check for unused code/dependencies
pnpm knip

# Auto-fix unused code/dependencies (WARNING: modifies files)
pnpm knip:fix
```

## Code Standards

- Run `pnpm lint` before committing
- Run `pnpm test` to ensure tests pass
- Run `pnpm knip` to find unused code/dependencies
  - **Note:** `pnpm knip:fix` can automatically remove unused code/dependencies, but it **modifies files** (package.json and source files). Always review changes or run it in a branch/with git stash.
- Use conventional commits (e.g., `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`). See [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for more details.

```text
feat: add sentiment analysis endpoint
fix(gateway): resolve authentication issue
docs: update API documentation
deps(npm): update nestjs to v11
```

### Code Quality Commands

```bash
pnpm lint          # Run ESLint
pnpm type-check    # TypeScript type checking
pnpm test          # Run tests
pnpm knip          # Find unused code/dependencies
pnpm knip:fix      # Auto-fix unused code/dependencies (WARNING: modifies files)
pnpm validate      # Run all checks (lint, type-check, test, knip, build)
```

## Pull Request Process

1. Update documentation if needed
2. Ensure all tests pass
3. PRs are automatically labeled based on files changed
4. Author is automatically assigned to the PR
5. Request review from maintainers

## Reporting Issues

Use GitHub Issues with:

- Clear description
- Steps to reproduce
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under MIT.
