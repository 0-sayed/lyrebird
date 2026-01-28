/**
 * Test Fixtures Barrel Export
 *
 * Centralized exports for all test fixtures used across
 * unit, integration, and E2E tests.
 *
 * @example
 * import {
 *   createMockStartJobMessage,
 *   createMockJetstreamEvent,
 *   createMockSseDataUpdateEvent,
 *   SENTIMENT_TEST_CASES,
 * } from '../fixtures';
 */

// Sentiment analysis fixtures
export * from './sentiment-fixtures';

// RabbitMQ message fixtures
export * from './rabbitmq-fixtures';

// Jetstream WebSocket event fixtures
export * from './jetstream-fixtures';

// SSE (Server-Sent Events) fixtures
export * from './sse-fixtures';
