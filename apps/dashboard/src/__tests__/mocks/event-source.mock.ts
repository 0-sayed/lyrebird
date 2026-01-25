/**
 * EventSource mock for testing SSE connections
 *
 * This mock provides full control over EventSource lifecycle and events,
 * allowing tests to simulate various SSE scenarios including:
 * - Connection establishment
 * - Named event emission
 * - Error states
 * - Reconnection behavior
 */
import { vi, type Mock } from 'vitest';

// =============================================================================
// Types
// =============================================================================

type EventHandler = (event: MessageEvent) => void;
type ErrorHandler = (event: Event) => void;
type OpenHandler = (event: Event) => void;

interface MockEventSourceInstance {
  url: string;
  readyState: number;
  onopen: OpenHandler | null;
  onerror: ErrorHandler | null;
  onmessage: EventHandler | null;
  close: Mock;
  addEventListener: Mock;
  removeEventListener: Mock;
  dispatchEvent: Mock;
  // Test helpers
  _eventListeners: Map<string, Set<EventHandler>>;
  _simulateOpen: () => void;
  _simulateError: () => void;
  _simulateEvent: (eventType: string, data: unknown) => void;
  _simulateRawEvent: (eventType: string, rawData: string) => void;
  _simulateClose: () => void;
}

// =============================================================================
// Mock Implementation
// =============================================================================

/** All created mock instances for test access */
export const mockEventSourceInstances: MockEventSourceInstance[] = [];

/** Get the most recently created EventSource instance */
export function getLastEventSource(): MockEventSourceInstance | undefined {
  return mockEventSourceInstances[mockEventSourceInstances.length - 1];
}

/** Clear all mock instances */
export function clearEventSourceMocks(): void {
  mockEventSourceInstances.length = 0;
}

/**
 * Creates a mock EventSource constructor
 *
 * Usage in tests:
 * ```ts
 * const EventSourceMock = createEventSourceMock();
 * vi.stubGlobal('EventSource', EventSourceMock);
 *
 * // Later in test:
 * const es = getLastEventSource();
 * es._simulateOpen();
 * es._simulateEvent('job.subscribed', { jobId: '123', status: 'pending' });
 * ```
 */
export function createEventSourceMock() {
  return class MockEventSource implements MockEventSourceInstance {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;

    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSED = 2;

    url: string;
    readyState: number = MockEventSource.CONNECTING;
    withCredentials = false;

    onopen: OpenHandler | null = null;
    onerror: ErrorHandler | null = null;
    onmessage: EventHandler | null = null;

    _eventListeners: Map<string, Set<EventHandler>> = new Map();

    close = vi.fn(() => {
      this.readyState = MockEventSource.CLOSED;
    });

    addEventListener = vi.fn((type: string, handler: EventHandler) => {
      if (!this._eventListeners.has(type)) {
        this._eventListeners.set(type, new Set());
      }
      this._eventListeners.get(type)!.add(handler);
    });

    removeEventListener = vi.fn((type: string, handler: EventHandler) => {
      this._eventListeners.get(type)?.delete(handler);
    });

    dispatchEvent = vi.fn(() => true);

    constructor(url: string) {
      this.url = url;
      mockEventSourceInstances.push(this);

      // Auto-open after a tick (like real EventSource)
      queueMicrotask(() => {
        if (this.readyState === MockEventSource.CONNECTING) {
          this._simulateOpen();
        }
      });
    }

    /**
     * Simulate the connection opening
     */
    _simulateOpen(): void {
      this.readyState = MockEventSource.OPEN;
      const event = new Event('open');
      this.onopen?.(event);
    }

    /**
     * Simulate an error (triggers reconnection in real EventSource)
     */
    _simulateError(): void {
      this.readyState = MockEventSource.CLOSED;
      const event = new Event('error');
      this.onerror?.(event);
    }

    /**
     * Simulate receiving a named SSE event
     */
    _simulateEvent(eventType: string, data: unknown): void {
      const messageEvent = new MessageEvent(eventType, {
        data: JSON.stringify(data),
        origin: this.url,
      });

      // Dispatch to addEventListener handlers
      const handlers = this._eventListeners.get(eventType);
      if (handlers) {
        handlers.forEach((handler) => handler(messageEvent));
      }

      // Also dispatch to onmessage for unnamed events
      if (eventType === 'message') {
        this.onmessage?.(messageEvent);
      }
    }

    /**
     * Simulate the connection closing cleanly
     */
    _simulateClose(): void {
      this.readyState = MockEventSource.CLOSED;
    }

    /**
     * Simulate receiving a raw SSE event with unprocessed data
     * Useful for testing parse error handling
     */
    _simulateRawEvent(eventType: string, rawData: string): void {
      const messageEvent = new MessageEvent(eventType, {
        data: rawData,
        origin: this.url,
      });

      // Dispatch to addEventListener handlers
      const handlers = this._eventListeners.get(eventType);
      if (handlers) {
        handlers.forEach((handler) => handler(messageEvent));
      }
    }
  };
}

/**
 * Install the EventSource mock globally
 */
export function installEventSourceMock(): void {
  clearEventSourceMocks();
  vi.stubGlobal('EventSource', createEventSourceMock());
}

/**
 * Uninstall the EventSource mock
 */
export function uninstallEventSourceMock(): void {
  clearEventSourceMocks();
  vi.unstubAllGlobals();
}
