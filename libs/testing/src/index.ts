/**
 * Shared testing utilities for E2E and integration tests
 *
 * This library provides mock implementations of common services
 * to enable testing without external dependencies (database, message queues).
 */

export * from './mocks/database.mock';
export * from './mocks/rabbitmq.mock';
export * from './mocks/repositories.mock';
export * from './mocks/bluesky.mock';
export * from './mocks/polling-scraper.mock';
export * from './factories/job.factory';
export * from './utils/id.util';
