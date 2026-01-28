import {
  createMockWebSocketInstance,
  createWebSocketMock,
  WS_READY_STATES,
} from './websocket-server.util';

describe('createMockWebSocketInstance', () => {
  describe('initialization', () => {
    it('should create a mock WebSocket instance', () => {
      const ws = createMockWebSocketInstance();

      expect(ws).toBeDefined();
      expect(ws.on).toBeDefined();
      expect(ws.close).toBeDefined();
      expect(ws.send).toBeDefined();
    });

    it('should start in CONNECTING state by default', () => {
      const ws = createMockWebSocketInstance();

      expect(ws.readyState).toBe(WS_READY_STATES.CONNECTING);
    });

    it('should allow custom initial ready state', () => {
      const ws = createMockWebSocketInstance({
        initialReadyState: WS_READY_STATES.OPEN,
      });

      expect(ws.readyState).toBe(WS_READY_STATES.OPEN);
    });
  });

  describe('event handling', () => {
    it('should register event handlers via on()', () => {
      const ws = createMockWebSocketInstance();
      const handler = jest.fn();

      ws.on('open', handler);

      expect(ws.on).toHaveBeenCalledWith('open', handler);
      expect(ws._handlers.get('open')).toContain(handler);
    });

    it('should support multiple handlers for same event', () => {
      const ws = createMockWebSocketInstance();
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      ws.on('message', handler1);
      ws.on('message', handler2);

      expect(ws._handlers.get('message')).toHaveLength(2);
    });

    it('should remove handlers via off()', () => {
      const ws = createMockWebSocketInstance();
      const handler = jest.fn();

      ws.on('message', handler);
      ws.off('message', handler);

      expect(ws._handlers.get('message')).toHaveLength(0);
    });
  });

  describe('_triggerOpen', () => {
    it('should call open handlers and set state to OPEN', () => {
      const ws = createMockWebSocketInstance();
      const openHandler = jest.fn();

      ws.on('open', openHandler);
      ws._triggerOpen();

      expect(openHandler).toHaveBeenCalled();
      expect(ws.readyState).toBe(WS_READY_STATES.OPEN);
    });
  });

  describe('_triggerClose', () => {
    it('should call close handlers with code and reason', () => {
      const ws = createMockWebSocketInstance();
      const closeHandler = jest.fn();

      ws.on('close', closeHandler);
      ws._triggerClose(1001, 'Going away');

      expect(closeHandler).toHaveBeenCalledWith(1001, expect.any(Buffer));
      expect(ws.readyState).toBe(WS_READY_STATES.CLOSED);
    });

    it('should use default code and reason', () => {
      const ws = createMockWebSocketInstance();
      const closeHandler = jest.fn();

      ws.on('close', closeHandler);
      ws._triggerClose();

      expect(closeHandler).toHaveBeenCalledWith(1000, expect.any(Buffer));
    });
  });

  describe('_triggerError', () => {
    it('should call error handlers with error object', () => {
      const ws = createMockWebSocketInstance();
      const errorHandler = jest.fn();
      const error = new Error('Connection failed');

      ws.on('error', errorHandler);
      ws._triggerError(error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });
  });

  describe('_receiveMessage', () => {
    it('should call message handlers with string data', () => {
      const ws = createMockWebSocketInstance();
      const messageHandler = jest.fn();

      ws.on('message', messageHandler);
      ws._receiveMessage('test message');

      expect(messageHandler).toHaveBeenCalledWith('test message');
    });

    it('should JSON stringify object data', () => {
      const ws = createMockWebSocketInstance();
      const messageHandler = jest.fn();
      const data = { kind: 'commit', did: 'did:plc:test' };

      ws.on('message', messageHandler);
      ws._receiveMessage(data);

      expect(messageHandler).toHaveBeenCalledWith(JSON.stringify(data));
    });

    it('should call all registered message handlers', () => {
      const ws = createMockWebSocketInstance();
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      ws.on('message', handler1);
      ws.on('message', handler2);
      ws._receiveMessage('test');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('_setReadyState', () => {
    it('should update ready state', () => {
      const ws = createMockWebSocketInstance();

      ws._setReadyState(WS_READY_STATES.CLOSING);

      expect(ws.readyState).toBe(WS_READY_STATES.CLOSING);
    });
  });

  describe('autoConnect option', () => {
    it('should trigger open on next tick when autoConnect is true', async () => {
      const ws = createMockWebSocketInstance({ autoConnect: true });
      const openHandler = jest.fn();

      ws.on('open', openHandler);

      // Open should not be called immediately
      expect(openHandler).not.toHaveBeenCalled();

      // Wait for setImmediate to execute
      await new Promise((resolve) => setImmediate(resolve));

      expect(openHandler).toHaveBeenCalled();
      expect(ws.readyState).toBe(WS_READY_STATES.OPEN);
    });
  });
});

describe('createWebSocketMock', () => {
  it('should return mock instance and setup function', () => {
    const { mockInstance, setupMock } = createWebSocketMock();

    expect(mockInstance).toBeDefined();
    expect(typeof setupMock).toBe('function');
  });
});

describe('WS_READY_STATES', () => {
  it('should have correct WebSocket ready state values', () => {
    expect(WS_READY_STATES.CONNECTING).toBe(0);
    expect(WS_READY_STATES.OPEN).toBe(1);
    expect(WS_READY_STATES.CLOSING).toBe(2);
    expect(WS_READY_STATES.CLOSED).toBe(3);
  });
});
