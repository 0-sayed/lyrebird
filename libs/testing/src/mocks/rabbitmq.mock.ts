import { ClientProxy } from '@nestjs/microservices';
import type { Channel, ChannelModel, Replies } from 'amqplib';
import { of, Subscription } from 'rxjs';
import { EventEmitter } from 'events';
import type {
  RabbitmqBackpressureStatus,
  RabbitmqHealthStatus,
} from '@app/rabbitmq';

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
      (observable as any).subscribe = (
        ...args: Parameters<typeof originalSubscribe>
      ) => {
        const sub = originalSubscribe(...args);
        subscriptions.push(sub);
        return sub;
      };
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

export function createMockAmqpChannel(
  overrides: Partial<jest.Mocked<Pick<Channel, 'checkQueue' | 'close'>>> = {},
): jest.Mocked<Pick<Channel, 'checkQueue' | 'close'>> {
  return {
    checkQueue: jest.fn().mockResolvedValue({
      queue: 'test-queue',
      messageCount: 0,
      consumerCount: 0,
    } as Replies.AssertQueue),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function createMockAmqpConnection(
  channel = createMockAmqpChannel(),
): EventEmitter &
  jest.Mocked<Pick<ChannelModel, 'createChannel' | 'close'>> & {
    emitClose(): boolean;
    emitError(error: Error): boolean;
  } {
  const connection = new EventEmitter() as EventEmitter &
    jest.Mocked<Pick<ChannelModel, 'createChannel' | 'close'>> & {
      emitClose(): boolean;
      emitError(error: Error): boolean;
    };

  connection.createChannel = jest.fn().mockResolvedValue(channel);
  connection.close = jest.fn().mockResolvedValue(undefined);
  connection.emitClose = () => connection.emit('close');
  connection.emitError = (error: Error) => connection.emit('error', error);

  return connection;
}

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
  getHealthStatus: jest.fn<Promise<RabbitmqHealthStatus>, []>(() =>
    Promise.resolve({
      healthy: true,
      connected: true,
      initializedQueues: [],
    }),
  ),
  getBackpressureStatus: jest.fn<
    Promise<RabbitmqBackpressureStatus>,
    [string, number?]
  >((queue: string, threshold = 100) =>
    Promise.resolve({
      queue,
      messageCount: 0,
      consumerCount: 0,
      threshold,
      isBackpressured: false,
    }),
  ),
  getClient: jest.fn(),
});

export type MockRabbitmqService = ReturnType<typeof createMockRabbitmqService>;
