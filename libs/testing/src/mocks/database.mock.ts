/**
 * Mock implementation of DatabaseService for testing
 *
 * Provides a mock database service that doesn't require
 * a real PostgreSQL connection.
 */
export const createMockDatabaseService = () => ({
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
  healthCheck: jest.fn(() => Promise.resolve(true)),
  runMigrations: jest.fn(() => Promise.resolve()),
  get db() {
    return {};
  },
});

export type MockDatabaseService = ReturnType<typeof createMockDatabaseService>;
