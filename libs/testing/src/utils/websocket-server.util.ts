import WebSocket from 'ws';

/**
 * Mock WebSocket instance for testing
 */
export interface MockWebSocketInstance {
  /** Register event handler */
  on: jest.Mock;
  /** Remove event handler */
  off: jest.Mock;
  /** Close the connection */
  close: jest.Mock;
  /** Send data */
  send: jest.Mock;
  /** Current ready state */
  readyState: number;
  /** Event handlers registered via on() */
  _handlers: Map<string, Array<(...args: unknown[]) => void>>;
  /** Simulate an incoming message */
  _receiveMessage: (data: unknown) => void;
  /** Simulate connection open */
  _triggerOpen: () => void;
  /** Simulate connection close */
  _triggerClose: (code?: number, reason?: string) => void;
  /** Simulate connection error */
  _triggerError: (error: Error) => void;
  /** Set ready state */
  _setReadyState: (state: number) => void;
}

/**
 * Options for creating a mock WebSocket server
 */
export interface CreateMockWebSocketServerOptions {
  /** Initial ready state (default: CONNECTING) */
  initialReadyState?: number;
  /** Auto-connect on creation (triggers 'open' event) */
  autoConnect?: boolean;
}

/**
 * Creates a mock WebSocket instance for testing WebSocket-based services.
 *
 * This utility provides a fully controllable WebSocket mock that can simulate
 * incoming messages, connection events, and errors.
 *
 * @example
 * // Basic usage - mock the ws module
 * jest.mock('ws');
 * const MockWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;
 *
 * const mockWs = createMockWebSocketInstance();
 * MockWebSocket.mockImplementation(() => mockWs as unknown as WebSocket);
 *
 * // Create your service...
 * await service.connect();
 *
 * // Simulate connection open
 * mockWs._triggerOpen();
 *
 * // Simulate incoming message
 * mockWs._receiveMessage({ kind: 'commit', did: 'did:plc:test' });
 *
 * // Verify behavior
 * expect(mockWs.close).toHaveBeenCalled();
 *
 * @example
 * // Testing reconnection
 * const mockWs = createMockWebSocketInstance();
 *
 * // Simulate connection failure
 * mockWs._triggerError(new Error('Connection refused'));
 * mockWs._triggerClose(1006, 'Abnormal closure');
 *
 * // Verify reconnection logic...
 */
export function createMockWebSocketInstance(
  options: CreateMockWebSocketServerOptions = {},
): MockWebSocketInstance {
  const { initialReadyState = WebSocket.CONNECTING, autoConnect = false } =
    options;

  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  let readyState = initialReadyState;

  const instance: MockWebSocketInstance = {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) {
        handlers.set(event, []);
      }
      handlers.get(event)!.push(handler);
      return instance;
    }),

    off: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      const eventHandlers = handlers.get(event);
      if (eventHandlers) {
        const index = eventHandlers.indexOf(handler);
        if (index > -1) {
          eventHandlers.splice(index, 1);
        }
      }
      return instance;
    }),

    close: jest.fn(),
    send: jest.fn(),

    get readyState() {
      return readyState;
    },

    _handlers: handlers,

    _receiveMessage: (data: unknown) => {
      const messageHandlers = handlers.get('message');
      if (messageHandlers) {
        // If data is already a Buffer, pass it as-is
        // If it's a string, convert to Buffer
        // If it's an object, JSON stringify and convert to Buffer
        let messageData: Buffer | string;
        if (Buffer.isBuffer(data)) {
          messageData = data;
        } else if (typeof data === 'string') {
          messageData = data;
        } else {
          messageData = JSON.stringify(data);
        }
        for (const handler of messageHandlers) {
          handler(messageData);
        }
      }
    },

    _triggerOpen: () => {
      readyState = WebSocket.OPEN;
      const openHandlers = handlers.get('open');
      if (openHandlers) {
        for (const handler of openHandlers) {
          handler();
        }
      }
    },

    _triggerClose: (code = 1000, reason = 'Normal closure') => {
      readyState = WebSocket.CLOSED;
      const closeHandlers = handlers.get('close');
      if (closeHandlers) {
        for (const handler of closeHandlers) {
          handler(code, Buffer.from(reason));
        }
      }
    },

    _triggerError: (error: Error) => {
      const errorHandlers = handlers.get('error');
      if (errorHandlers) {
        for (const handler of errorHandlers) {
          handler(error);
        }
      }
    },

    _setReadyState: (state: number) => {
      readyState = state;
    },
  };

  if (autoConnect) {
    // Schedule open event for next tick to allow setup
    setImmediate(() => instance._triggerOpen());
  }

  return instance;
}

/**
 * Creates a Jest mock class for WebSocket that returns the provided instance.
 *
 * This is a convenience function for common mocking patterns.
 *
 * @example
 * import WebSocket from 'ws';
 * jest.mock('ws');
 *
 * const { mockInstance, setupMock } = createWebSocketMock();
 * setupMock(WebSocket as jest.MockedClass<typeof WebSocket>);
 *
 * // Now any new WebSocket() will return mockInstance
 */
export function createWebSocketMock() {
  const mockInstance = createMockWebSocketInstance();

  return {
    mockInstance,
    setupMock: (MockWebSocket: jest.MockedClass<typeof WebSocket>) => {
      MockWebSocket.mockImplementation(
        () => mockInstance as unknown as WebSocket,
      );
    },
  };
}

/**
 * WebSocket ready states for convenience
 */
export const WS_READY_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;
