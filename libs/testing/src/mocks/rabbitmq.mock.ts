/**
 * Mock implementation of RabbitmqService for testing
 *
 * Provides a mock message queue service that doesn't require
 * a real RabbitMQ connection.
 */
export const createMockRabbitmqService = () => ({
  emit: jest.fn(),
  send: jest.fn(() => Promise.resolve()),
  emitToQueue: jest.fn(),
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
  isInitialized: jest.fn(() => true),
  healthCheck: jest.fn(() => Promise.resolve(true)),
  getClient: jest.fn(),
});

export type MockRabbitmqService = ReturnType<typeof createMockRabbitmqService>;
