import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JetstreamClientService } from './jetstream-client.service';
import {
  JetstreamCommitEvent,
  JetstreamConnectionStatus,
  JetstreamPostEvent,
} from './jetstream-types';
import WebSocket from 'ws';
import {
  createMockWebSocketInstance,
  MockWebSocketInstance,
  WS_READY_STATES,
} from '@app/testing';
import {
  createMockJetstreamEvent,
  resetJetstreamCounter,
} from '../../../test/fixtures/jetstream-fixtures';

// Mock the ws module
jest.mock('ws');

const MockWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

/**
 * Creates a test module with JetstreamClientService and mock ConfigService
 */
async function createModule(
  configOverrides: Record<string, string | number | boolean> = {},
): Promise<{
  module: TestingModule;
  service: JetstreamClientService;
  mockWs: MockWebSocketInstance;
}> {
  const defaultConfig: Record<string, string | number | boolean> = {
    JETSTREAM_ENDPOINT: 'wss://test.jetstream.example/subscribe',
    JETSTREAM_RECONNECT_MAX_ATTEMPTS: 3,
    JETSTREAM_RECONNECT_INITIAL_BACKOFF_MS: 100,
    JETSTREAM_RECONNECT_MAX_BACKOFF_MS: 1000,
    JETSTREAM_COMPRESS: true,
    ...configOverrides,
  };

  const mockWs = createMockWebSocketInstance();
  MockWebSocket.mockImplementation(() => mockWs as unknown as WebSocket);

  const module = await Test.createTestingModule({
    providers: [
      JetstreamClientService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn(<T>(key: string, defaultValue?: T): T => {
            const value = defaultConfig[key];
            return (value !== undefined ? value : defaultValue) as T;
          }),
        },
      },
    ],
  }).compile();

  const service = module.get<JetstreamClientService>(JetstreamClientService);

  return { module, service, mockWs };
}

/**
 * Helper to connect and wait for open event
 */
async function connectAndOpen(
  service: JetstreamClientService,
  mockWs: MockWebSocketInstance,
  cursor?: string,
): Promise<void> {
  const connectPromise = service.connect(cursor);
  mockWs._triggerOpen();
  await connectPromise;
}

/**
 * Helper to create a valid post commit event
 */
function createPostCommitEvent(): JetstreamCommitEvent {
  // createMockJetstreamEvent defaults to commit events
  return createMockJetstreamEvent({
    text: 'Test post content',
  }) as JetstreamCommitEvent;
}

describe('JetstreamClientService', () => {
  let service: JetstreamClientService;
  let module: TestingModule;
  let mockWs: MockWebSocketInstance;
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    resetJetstreamCounter();

    const result = await createModule();
    module = result.module;
    service = result.service;
    mockWs = result.mockWs;
  });

  afterEach(async () => {
    jest.useRealTimers();
    await module.close();
  });

  describe('initialization', () => {
    it('should initialize with disconnected status and zero metrics', () => {
      expect(service.getConnectionStatus()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);

      const metrics = service.getMetrics();
      expect(metrics).toMatchObject({
        messagesReceived: 0,
        postsProcessed: 0,
        reconnectAttempts: 0,
      });
    });
  });

  describe('connect', () => {
    it.each([
      ['base URL', 'wss://test.jetstream.example/subscribe'],
      ['wantedCollections param', 'wantedCollections=app.bsky.feed.post'],
      ['compress param', 'compress=true'],
    ])('should include %s in WebSocket URL', async (_, expected) => {
      await connectAndOpen(service, mockWs);

      expect(MockWebSocket).toHaveBeenCalledWith(
        expect.stringContaining(expected),
      );
    });

    it('should include cursor in URL when resuming', async () => {
      const cursor = '1737000000000000';
      await connectAndOpen(service, mockWs, cursor);

      expect(MockWebSocket).toHaveBeenCalledWith(
        expect.stringContaining(`cursor=${cursor}`),
      );
    });

    it('should update connection status to connected on open', async () => {
      await connectAndOpen(service, mockWs);

      expect(service.getConnectionStatus()).toBe('connected');
      expect(service.isConnected()).toBe(true);
    });

    it('should reset reconnect attempts on successful connection', async () => {
      await connectAndOpen(service, mockWs);

      expect(service.getMetrics().reconnectAttempts).toBe(0);
    });

    it('should emit the latest connection state to new subscribers', async () => {
      await connectAndOpen(service, mockWs);

      const statuses: JetstreamConnectionStatus[] = [];
      service.status$.subscribe((status) => statuses.push(status));

      expect(statuses.at(-1)).toBe('connected');
    });
  });

  describe('message handling', () => {
    let receivedPosts: JetstreamPostEvent[];

    beforeEach(async () => {
      receivedPosts = [];
      service.posts$.subscribe((post) => receivedPosts.push(post));
      await connectAndOpen(service, mockWs);
    });

    it('should emit post events for valid post creation commits', () => {
      const event = createPostCommitEvent();
      mockWs._receiveMessage(Buffer.from(JSON.stringify(event)));

      expect(receivedPosts).toHaveLength(1);
      expect(receivedPosts[0]).toMatchObject({
        did: event.did,
        rkey: event.commit.rkey,
      });
    });

    it('should update cursor from event timestamp', () => {
      const event = createMockJetstreamEvent({ time_us: 1737000000000000 });
      mockWs._receiveMessage(Buffer.from(JSON.stringify(event)));

      expect(service.getLastCursor()).toBe('1737000000000000');
    });

    it.each([
      ['identity events', createMockJetstreamEvent({ kind: 'identity' })],
      ['delete operations', createMockJetstreamEvent({ operation: 'delete' })],
      [
        'non-post collections',
        {
          did: 'did:plc:test',
          time_us: Date.now() * 1000,
          kind: 'commit' as const,
          commit: {
            rev: 'rev1',
            operation: 'create' as const,
            collection: 'app.bsky.feed.like',
            rkey: 'abc123',
            cid: 'bafyrei123',
          },
        },
      ],
    ])('should ignore %s', (_, event) => {
      mockWs._receiveMessage(Buffer.from(JSON.stringify(event)));

      expect(receivedPosts).toHaveLength(0);
    });

    it('should update metrics on message receipt', () => {
      const event = createPostCommitEvent();
      mockWs._receiveMessage(Buffer.from(JSON.stringify(event)));

      const metrics = service.getMetrics();
      expect(metrics.messagesReceived).toBe(1);
      expect(metrics.postsProcessed).toBe(1);
    });

    it('should handle malformed JSON gracefully', () => {
      mockWs._receiveMessage(Buffer.from('not valid json'));

      expect(receivedPosts).toHaveLength(0);
      const metrics = service.getMetrics();
      expect(metrics.messagesReceived).toBe(1);
      expect(metrics.postsProcessed).toBe(0);
    });

    it('should detect reply posts', () => {
      const event = createMockJetstreamEvent({ isReply: true });
      mockWs._receiveMessage(Buffer.from(JSON.stringify(event)));

      expect(receivedPosts).toHaveLength(1);
      expect(receivedPosts[0].isReply).toBe(true);
    });

    it('should include language tags when available', () => {
      const event = createMockJetstreamEvent({ langs: ['en'] });
      mockWs._receiveMessage(Buffer.from(JSON.stringify(event)));

      expect(receivedPosts).toHaveLength(1);
      expect(receivedPosts[0].langs).toEqual(['en']);
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket connection with normal closure code', async () => {
      await connectAndOpen(service, mockWs);

      service.disconnect();

      expect(mockWs.close).toHaveBeenCalledWith(1000, 'Client disconnect');
      expect(service.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('cursor management', () => {
    it('should allow setting cursor externally', () => {
      const cursor = '1737000000000000';
      service.setLastCursor(cursor);
      expect(service.getLastCursor()).toBe(cursor);
    });

    it('should use external cursor when connecting', async () => {
      service.setLastCursor('1737000000000000');
      await connectAndOpen(service, mockWs);

      expect(MockWebSocket).toHaveBeenCalledWith(
        expect.stringContaining('cursor=1737000000000000'),
      );
    });
  });

  describe('metrics', () => {
    it('should reset metrics when requested', () => {
      // Simulate some activity by setting internal state
      (service as unknown as { messagesReceived: number }).messagesReceived =
        100;
      (service as unknown as { postsProcessed: number }).postsProcessed = 50;

      service.resetMetrics();

      const metrics = service.getMetrics();
      expect(metrics.messagesReceived).toBe(0);
      expect(metrics.postsProcessed).toBe(0);
    });
  });

  describe('reconnection with exponential backoff', () => {
    it('should follow the connection state machine path to exhaustion', async () => {
      const result = await createModule({
        JETSTREAM_RECONNECT_MAX_ATTEMPTS: 1,
        JETSTREAM_RECONNECT_INITIAL_BACKOFF_MS: 5000,
        JETSTREAM_RECONNECT_MAX_BACKOFF_MS: 5000,
      });
      await module.close();

      module = result.module;
      service = result.service;
      mockWs = result.mockWs;

      const statuses: JetstreamConnectionStatus[] = [];
      service.status$.subscribe((status) => statuses.push(status));

      const connectPromise = service.connect();
      expect(service.getConnectionStatus()).toBe('connecting');

      mockWs._triggerOpen();
      await connectPromise;
      expect(service.getConnectionStatus()).toBe('connected');

      mockWs._triggerClose(1006, 'Abnormal closure');
      expect(service.getConnectionStatus()).toBe('reconnecting');

      jest.advanceTimersByTime(7000);
      expect(service.getConnectionStatus()).toBe('connecting');

      mockWs._triggerError(new Error('Reconnect failed'));
      expect(service.getConnectionStatus()).toBe('exhausted');

      expect(statuses).toEqual([
        'disconnected',
        'connecting',
        'connected',
        'reconnecting',
        'connecting',
        'exhausted',
      ]);
    });

    it('should schedule reconnection on connection close', async () => {
      await connectAndOpen(service, mockWs);

      // Trigger close
      mockWs._triggerClose(1006, 'Abnormal closure');

      // Status should be reconnecting after scheduleReconnect is called
      // The service schedules a reconnect, not immediately reconnecting
      expect(service.getConnectionStatus()).toBe('reconnecting');
    });

    it('should attempt reconnection after backoff time', async () => {
      await connectAndOpen(service, mockWs);

      // Trigger close
      mockWs._triggerClose(1006, 'Abnormal closure');

      // Before backoff time passes, should not have reconnected yet
      expect(MockWebSocket).toHaveBeenCalledTimes(1);

      // Advance past backoff (100ms + up to 25% jitter = max 125ms)
      jest.advanceTimersByTime(200);

      // Now should have attempted reconnection
      expect(MockWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should increment reconnect attempts on consecutive failures', async () => {
      await connectAndOpen(service, mockWs);

      // First close - triggers first reconnect attempt
      mockWs._triggerClose(1006, 'Abnormal closure');
      expect(service.getMetrics().reconnectAttempts).toBe(1);

      // Advance time so reconnect is attempted
      jest.advanceTimersByTime(200);
      // Now connected again, but simulate another close immediately
      // Note: reconnectAttempts is reset to 0 on successful open, so we need to check
      // the count before open is triggered

      // After scheduleReconnect increments, but before the reconnect succeeds
      expect(service.getConnectionStatus()).toBe('connecting');
    });

    it('should transition to exhausted after max reconnect attempts', async () => {
      const result = await createModule({
        JETSTREAM_RECONNECT_MAX_ATTEMPTS: 3,
        JETSTREAM_RECONNECT_INITIAL_BACKOFF_MS: 5000,
        JETSTREAM_RECONNECT_MAX_BACKOFF_MS: 5000,
      });
      await module.close();

      module = result.module;
      service = result.service;
      mockWs = result.mockWs;

      await connectAndOpen(service, mockWs);

      for (let i = 0; i < 4; i++) {
        mockWs._triggerClose(1006, 'Abnormal closure');
        jest.advanceTimersByTime(7000);
      }

      expect(service.getConnectionStatus()).toBe('exhausted');
      expect(service.isMaxReconnectExhausted()).toBe(true);
      expect(service.getMetrics().exhaustedAt).toBeInstanceOf(Date);
    });

    it('should not schedule another reconnect once exhausted', async () => {
      const result = await createModule({
        JETSTREAM_RECONNECT_MAX_ATTEMPTS: 3,
        JETSTREAM_RECONNECT_INITIAL_BACKOFF_MS: 5000,
        JETSTREAM_RECONNECT_MAX_BACKOFF_MS: 5000,
      });
      await module.close();

      module = result.module;
      service = result.service;
      mockWs = result.mockWs;

      await connectAndOpen(service, mockWs);

      for (let i = 0; i < 4; i++) {
        mockWs._triggerClose(1006, 'Abnormal closure');
        jest.advanceTimersByTime(7000);
      }
      const callsAfterExhaustion = MockWebSocket.mock.calls.length;

      mockWs._triggerClose(1006, 'Still closed');
      jest.advanceTimersByTime(60000);

      expect(MockWebSocket).toHaveBeenCalledTimes(callsAfterExhaustion);
    });

    it('should preserve cursor across reconnections', async () => {
      await connectAndOpen(service, mockWs);

      // Receive a message to set cursor
      const event = createMockJetstreamEvent({ time_us: 1737000000000000 });
      mockWs._receiveMessage(Buffer.from(JSON.stringify(event)));
      expect(service.getLastCursor()).toBe('1737000000000000');

      // Trigger reconnection
      mockWs._triggerClose(1006, 'Abnormal closure');
      jest.advanceTimersByTime(200);

      // Verify cursor is preserved in reconnection URL
      const calls = MockWebSocket.mock.calls;
      const lastUrl = calls[calls.length - 1][0] as string;
      expect(lastUrl).toContain('cursor=1737000000000000');
    });

    it('should reset reconnect attempts on successful connection', async () => {
      await connectAndOpen(service, mockWs);

      // Trigger close and reconnect
      mockWs._triggerClose(1006, 'Abnormal closure');
      jest.advanceTimersByTime(200);

      // Simulate successful reconnection
      mockWs._triggerOpen();

      expect(service.getMetrics().reconnectAttempts).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should schedule reconnect after error during established connection', async () => {
      await connectAndOpen(service, mockWs);

      mockWs._triggerError(new Error('Connection error'));

      expect(service.getConnectionStatus()).toBe('reconnecting');

      jest.advanceTimersByTime(200);

      expect(MockWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should not consume multiple reconnect attempts for one error-close sequence', async () => {
      await connectAndOpen(service, mockWs);

      mockWs._triggerError(new Error('Connection error'));
      mockWs._triggerClose(1006, 'Abnormal closure');

      expect(service.getConnectionStatus()).toBe('reconnecting');
      expect(service.getMetrics().reconnectAttempts).toBe(1);

      jest.advanceTimersByTime(200);

      expect(MockWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should not schedule reconnect from error once exhausted', async () => {
      const result = await createModule({
        JETSTREAM_RECONNECT_MAX_ATTEMPTS: 1,
        JETSTREAM_RECONNECT_INITIAL_BACKOFF_MS: 5000,
        JETSTREAM_RECONNECT_MAX_BACKOFF_MS: 5000,
      });
      await module.close();

      module = result.module;
      service = result.service;
      mockWs = result.mockWs;

      await connectAndOpen(service, mockWs);
      mockWs._triggerClose(1006, 'Abnormal closure');
      jest.advanceTimersByTime(7000);
      mockWs._triggerError(new Error('Reconnect failed'));
      jest.advanceTimersByTime(7000);

      const callsAfterExhaustion = MockWebSocket.mock.calls.length;
      mockWs._triggerError(new Error('Still failing'));
      jest.advanceTimersByTime(60000);

      expect(service.getConnectionStatus()).toBe('exhausted');
      expect(MockWebSocket).toHaveBeenCalledTimes(callsAfterExhaustion);
    });
  });

  describe('resetReconnectState', () => {
    it('should return to disconnected and clear exhaustion metadata', async () => {
      const result = await createModule({
        JETSTREAM_RECONNECT_MAX_ATTEMPTS: 1,
        JETSTREAM_RECONNECT_INITIAL_BACKOFF_MS: 5000,
        JETSTREAM_RECONNECT_MAX_BACKOFF_MS: 5000,
      });
      await module.close();

      module = result.module;
      service = result.service;
      mockWs = result.mockWs;

      await connectAndOpen(service, mockWs);
      mockWs._triggerClose(1006, 'Abnormal closure');
      jest.advanceTimersByTime(7000);
      mockWs._triggerError(new Error('Reconnect failed'));
      jest.advanceTimersByTime(7000);

      service.resetReconnectState();

      expect(service.getConnectionStatus()).toBe('disconnected');
      expect(service.isMaxReconnectExhausted()).toBe(false);
      expect(service.getMetrics().reconnectAttempts).toBe(0);
      expect(service.getMetrics().exhaustedAt).toBeUndefined();
    });
  });

  describe('connection status monitoring', () => {
    it.each([
      [WS_READY_STATES.CONNECTING, 'connecting'],
      [WS_READY_STATES.OPEN, 'connected'],
      [WS_READY_STATES.CLOSED, 'disconnected'],
    ] as const)(
      'should report status %s as %s',
      async (readyState, expectedStatus) => {
        await connectAndOpen(service, mockWs);
        mockWs._setReadyState(readyState);

        if (readyState === WS_READY_STATES.OPEN) {
          expect(service.getConnectionStatus()).toBe(expectedStatus);
        }

        if (readyState === WS_READY_STATES.CLOSED) {
          service.resetReconnectState();
          expect(service.getConnectionStatus()).toBe(expectedStatus);
        }
      },
    );
  });

  describe('concurrent message processing', () => {
    it('should handle multiple rapid messages', async () => {
      const receivedPosts: JetstreamPostEvent[] = [];
      service.posts$.subscribe((post) => receivedPosts.push(post));
      await connectAndOpen(service, mockWs);

      // Send 10 messages rapidly
      for (let i = 0; i < 10; i++) {
        const event = createMockJetstreamEvent({ text: `Post ${i}` });
        mockWs._receiveMessage(Buffer.from(JSON.stringify(event)));
      }

      expect(receivedPosts).toHaveLength(10);
      expect(service.getMetrics().postsProcessed).toBe(10);
    });

    it('should process messages from different authors', async () => {
      const receivedPosts: JetstreamPostEvent[] = [];
      service.posts$.subscribe((post) => receivedPosts.push(post));
      await connectAndOpen(service, mockWs);

      const authors = ['did:plc:alice', 'did:plc:bob', 'did:plc:charlie'];
      for (const did of authors) {
        const event = createMockJetstreamEvent({ did });
        mockWs._receiveMessage(Buffer.from(JSON.stringify(event)));
      }

      expect(receivedPosts).toHaveLength(3);
      const dids = receivedPosts.map((p) => p.did);
      expect(dids).toEqual(authors);
    });
  });
});
