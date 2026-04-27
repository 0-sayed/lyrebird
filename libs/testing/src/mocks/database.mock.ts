import type { PostgresHealthStatus } from '@app/database';

/**
 * Mock implementation of DatabaseService for testing
 *
 * Provides a mock database service that doesn't require
 * a real PostgreSQL connection.
 */
export const createMockDatabaseService = () => {
  const service: {
    onModuleInit: jest.Mock;
    onModuleDestroy: jest.Mock;
    getHealthStatus: jest.Mock<Promise<PostgresHealthStatus>, []>;
    healthCheck: jest.Mock<Promise<boolean>, []>;
    runMigrations: jest.Mock<Promise<void>, []>;
    readonly db: Record<string, never>;
  } = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    getHealthStatus: jest.fn<Promise<PostgresHealthStatus>, []>(() =>
      Promise.resolve({
        healthy: true,
        latencyMs: 0,
      }),
    ),
    healthCheck: jest.fn<Promise<boolean>, []>(async () => {
      const health = await service.getHealthStatus();
      return health.healthy;
    }),
    runMigrations: jest.fn(() => Promise.resolve()),
    get db() {
      return {};
    },
  };

  return service;
};

export type MockDatabaseService = ReturnType<typeof createMockDatabaseService>;
