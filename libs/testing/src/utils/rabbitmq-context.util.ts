/**
 * Mock RabbitMQ channel for testing message acknowledgment
 */
export interface MockRabbitMqChannel {
  /** Acknowledge a message */
  ack: jest.Mock;
  /** Negative acknowledge a message (requeue or discard) */
  nack: jest.Mock;
  /** Reject a message */
  reject: jest.Mock;
}

/**
 * Mock RabbitMQ message structure
 */
export interface MockRabbitMqMessage {
  content: Buffer;
  fields: {
    routingKey: string;
    exchange: string;
    redelivered: boolean;
  };
  properties: {
    correlationId: string;
    headers: Record<string, unknown>;
    replyTo?: string;
    messageId: string;
  };
}

/**
 * Mock RabbitMQ context for testing message handlers
 */
export interface MockRabbitMqContext {
  /** Get the channel reference */
  getChannelRef: jest.Mock<MockRabbitMqChannel, []>;
  /** Get the original message */
  getMessage: jest.Mock<MockRabbitMqMessage, []>;
  /** Get the pattern (routing key) */
  getPattern: jest.Mock<string, []>;
  /** The underlying mock channel for assertions */
  _channel: MockRabbitMqChannel;
  /** The underlying mock message for assertions */
  _message: MockRabbitMqMessage;
}

/**
 * Options for creating a mock RabbitMQ context
 */
export interface CreateMockRabbitMqContextOptions {
  /** Custom message properties */
  message?: Record<string, unknown>;
  /** The routing key/pattern for this message */
  pattern?: string;
  /** Message properties (headers, correlationId, etc.) */
  properties?: {
    correlationId?: string;
    headers?: Record<string, unknown>;
    replyTo?: string;
    messageId?: string;
  };
}

/**
 * Creates a mock RabbitMQ context for testing message handlers.
 *
 * This utility simplifies testing of NestJS RabbitMQ message handlers
 * by providing a fully mocked RmqContext with channel operations.
 *
 * @example
 * // Basic usage
 * const ctx = createMockRabbitMqContext();
 *
 * controller.handleMessage(payload, ctx as unknown as RmqContext);
 *
 * expect(ctx._channel.ack).toHaveBeenCalled();
 *
 * @example
 * // With custom message and pattern
 * const ctx = createMockRabbitMqContext({
 *   pattern: 'job.start',
 *   message: { jobId: '123', prompt: 'test' },
 *   properties: { correlationId: 'corr-123' },
 * });
 *
 * @example
 * // Testing nack behavior
 * const ctx = createMockRabbitMqContext();
 *
 * controller.handleInvalidMessage({}, ctx as unknown as RmqContext);
 *
 * expect(ctx._channel.nack).toHaveBeenCalledWith(
 *   ctx._message,
 *   false, // allUpTo
 *   false, // requeue
 * );
 */
export function createMockRabbitMqContext(
  options: CreateMockRabbitMqContextOptions = {},
): MockRabbitMqContext {
  const { message = {}, pattern = 'test.pattern', properties = {} } = options;

  const mockMessage: MockRabbitMqMessage = {
    content: Buffer.from(JSON.stringify(message)),
    fields: {
      routingKey: pattern,
      exchange: 'test-exchange',
      redelivered: false,
    },
    properties: {
      correlationId: properties.correlationId ?? 'test-correlation-id',
      headers: properties.headers ?? {},
      replyTo: properties.replyTo,
      messageId: properties.messageId ?? 'test-message-id',
    },
  };

  const mockChannel: MockRabbitMqChannel = {
    ack: jest.fn(),
    nack: jest.fn(),
    reject: jest.fn(),
  };

  const context: MockRabbitMqContext = {
    getChannelRef: jest
      .fn<MockRabbitMqChannel, []>()
      .mockReturnValue(mockChannel),
    getMessage: jest.fn<MockRabbitMqMessage, []>().mockReturnValue(mockMessage),
    getPattern: jest.fn<string, []>().mockReturnValue(pattern),
    _channel: mockChannel,
    _message: mockMessage,
  };

  return context;
}

/**
 * Helper to assert a message was acknowledged
 *
 * @example
 * const ctx = createMockRabbitMqContext();
 * controller.handleMessage(payload, ctx as unknown as RmqContext);
 * assertMessageAcked(ctx);
 */
export function assertMessageAcked(ctx: MockRabbitMqContext): void {
  expect(ctx._channel.ack).toHaveBeenCalledWith(ctx._message);
}

/**
 * Helper to assert a message was negatively acknowledged
 *
 * @param ctx - The mock context
 * @param requeue - Whether the message should be requeued (default: false)
 *
 * @example
 * const ctx = createMockRabbitMqContext();
 * controller.handleInvalidMessage({}, ctx as unknown as RmqContext);
 * assertMessageNacked(ctx, false);
 */
export function assertMessageNacked(
  ctx: MockRabbitMqContext,
  requeue = false,
): void {
  expect(ctx._channel.nack).toHaveBeenCalledWith(ctx._message, false, requeue);
}
