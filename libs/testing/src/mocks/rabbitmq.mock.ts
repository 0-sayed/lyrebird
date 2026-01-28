import { ClientProxy } from '@nestjs/microservices';
import { of, Subscription } from 'rxjs';

/**
 * Creates a mock ClientProxy for testing RabbitMQ client interactions
 *
 * Provides mocked emit, send, connect, and close methods that return
 * appropriate observables/promises. Tracks subscriptions for verification.
 */
export function createMockClientProxy(): jest.Mocked<ClientProxy> & {
  _emitSubscriptions: Subscription[];
} {
  const subscriptions: Subscription[] = [];
  return {
    emit: jest.fn().mockImplementation(() => {
      const observable = of(undefined);
      const originalSubscribe = observable.subscribe.bind(observable);
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
      (observable as any).subscribe = (
        ...args: Parameters<typeof originalSubscribe>
      ) => {
        const sub = originalSubscribe(...args);
        subscriptions.push(sub);
        return sub;
      };
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
      return observable;
    }),
    send: jest.fn().mockReturnValue(of({ success: true })),
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    _emitSubscriptions: subscriptions,
  } as unknown as jest.Mocked<ClientProxy> & {
    _emitSubscriptions: Subscription[];
  };
}

export type MockClientProxy = ReturnType<typeof createMockClientProxy>;

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
