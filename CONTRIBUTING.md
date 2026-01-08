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
```

## Code Standards

- Run `pnpm lint` before committing
- Run `pnpm test` to ensure tests pass
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`

## Pull Request Process

1. Update documentation if needed
2. Ensure all tests pass
3. Request review from maintainers

## Reporting Issues

Use GitHub Issues with:

- Clear description
- Steps to reproduce
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under MIT.
