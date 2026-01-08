# Lyrebird

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-red.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

A distributed microservices platform for real-time sentiment analysis of Bluesky content.

## Overview

Lyrebird ingests data from Bluesky (AT Protocol), performs sentiment analysis, and delivers insights through a REST API. Built with NestJS, RabbitMQ, and PostgreSQL/TimescaleDB.

## Quick Start

```bash
# Clone and install
git clone https://github.com/0-sayed/lyrebird.git
cd lyrebird
pnpm install

# Start infrastructure
docker compose up -d

# Run services
pnpm start:all
```

## Services

| Service   | Port | Description               |
| --------- | ---- | ------------------------- |
| Gateway   | 3000 | REST API & Swagger docs   |
| Ingestion | 3001 | Bluesky scraper           |
| Analysis  | 3002 | Sentiment analysis engine |

## Development

```bash
pnpm start:dev          # Start with hot-reload
pnpm test               # Run tests
pnpm lint               # Lint code
pnpm db:studio          # Drizzle Studio
```

## Tech Stack

- **Runtime**: Node.js 22+, TypeScript 5.7
- **Framework**: NestJS 11
- **Database**: PostgreSQL 16 + TimescaleDB
- **Queue**: RabbitMQ 4.0
- **ORM**: Drizzle

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) - Sayed Ashraf
