import {
  createMockRabbitMqContext,
  assertMessageAcked,
  assertMessageNacked,
} from './rabbitmq-context.util';

describe('createMockRabbitMqContext', () => {
  describe('default behavior', () => {
    it('should create a mock context with default values', () => {
      const ctx = createMockRabbitMqContext();

      expect(ctx.getChannelRef).toBeDefined();
      expect(ctx.getMessage).toBeDefined();
      expect(ctx.getPattern).toBeDefined();
      expect(ctx._channel).toBeDefined();
      expect(ctx._message).toBeDefined();
    });

    it('should return mock channel with ack/nack methods', () => {
      const ctx = createMockRabbitMqContext();
      const channel = ctx.getChannelRef();

      expect(channel.ack).toBeDefined();
      expect(channel.nack).toBeDefined();
      expect(channel.reject).toBeDefined();
      expect(typeof channel.ack).toBe('function');
    });

    it('should return default pattern', () => {
      const ctx = createMockRabbitMqContext();

      expect(ctx.getPattern()).toBe('test.pattern');
    });

    it('should include default correlation ID in message', () => {
      const ctx = createMockRabbitMqContext();
      const message = ctx.getMessage();

      expect(message.properties.correlationId).toBe('test-correlation-id');
    });
  });

  describe('custom options', () => {
    it('should use custom pattern', () => {
      const ctx = createMockRabbitMqContext({
        pattern: 'job.start',
      });

      expect(ctx.getPattern()).toBe('job.start');
      expect(ctx.getMessage().fields.routingKey).toBe('job.start');
    });

    it('should use custom message content', () => {
      const ctx = createMockRabbitMqContext({
        message: { jobId: 'test-123', prompt: 'test prompt' },
      });

      const message = ctx.getMessage();
      const content = JSON.parse(message.content.toString()) as {
        jobId: string;
        prompt: string;
      };

      expect(content.jobId).toBe('test-123');
      expect(content.prompt).toBe('test prompt');
    });

    it('should use custom properties', () => {
      const ctx = createMockRabbitMqContext({
        properties: {
          correlationId: 'custom-corr-id',
          headers: { 'x-custom': 'value' },
          replyTo: 'reply-queue',
          messageId: 'msg-123',
        },
      });

      const message = ctx.getMessage();

      expect(message.properties.correlationId).toBe('custom-corr-id');
      expect(message.properties.headers).toEqual({ 'x-custom': 'value' });
      expect(message.properties.replyTo).toBe('reply-queue');
      expect(message.properties.messageId).toBe('msg-123');
    });
  });

  describe('channel operations', () => {
    it('should track ack calls', () => {
      const ctx = createMockRabbitMqContext();
      const channel = ctx.getChannelRef();

      channel.ack(ctx._message);

      expect(channel.ack).toHaveBeenCalledTimes(1);
      expect(channel.ack).toHaveBeenCalledWith(ctx._message);
    });

    it('should track nack calls with requeue option', () => {
      const ctx = createMockRabbitMqContext();
      const channel = ctx.getChannelRef();

      channel.nack(ctx._message, false, true);

      expect(channel.nack).toHaveBeenCalledWith(ctx._message, false, true);
    });

    it('should track reject calls', () => {
      const ctx = createMockRabbitMqContext();
      const channel = ctx.getChannelRef();

      channel.reject(ctx._message, false);

      expect(channel.reject).toHaveBeenCalledWith(ctx._message, false);
    });
  });
});

describe('assertMessageAcked', () => {
  it('should pass when message was acknowledged', () => {
    const ctx = createMockRabbitMqContext();
    ctx._channel.ack(ctx._message);

    expect(() => assertMessageAcked(ctx)).not.toThrow();
  });

  it('should fail when message was not acknowledged', () => {
    const ctx = createMockRabbitMqContext();

    expect(() => assertMessageAcked(ctx)).toThrow();
  });
});

describe('assertMessageNacked', () => {
  it('should pass when message was nacked without requeue', () => {
    const ctx = createMockRabbitMqContext();
    ctx._channel.nack(ctx._message, false, false);

    expect(() => assertMessageNacked(ctx, false)).not.toThrow();
  });

  it('should pass when message was nacked with requeue', () => {
    const ctx = createMockRabbitMqContext();
    ctx._channel.nack(ctx._message, false, true);

    expect(() => assertMessageNacked(ctx, true)).not.toThrow();
  });

  it('should fail when message was not nacked', () => {
    const ctx = createMockRabbitMqContext();

    expect(() => assertMessageNacked(ctx)).toThrow();
  });
});
