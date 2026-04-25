import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitmqService } from './rabbitmq.service';
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import * as amqplib from 'amqplib';
import { of, throwError } from 'rxjs';
import {
  RABBITMQ_CONSTANTS,
  PATTERN_TO_QUEUE,
  getQueueForPattern,
} from './rabbitmq.constants';
import { MESSAGE_PATTERNS } from '@app/shared-types';
import {
  createMockAmqpChannel,
  createMockAmqpConnection,
  createMockClientProxy,
} from '@app/testing';

jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

/**
 * Sets up the service with mock clients for all queues
 */
function setupMockClients(
  service: RabbitmqService,
  mockClients: Map<string, ClientProxy>,
): void {
  (service as unknown as { clients: Map<string, ClientProxy> }).clients =
    mockClients;
}

function setupMockMonitor(
  service: RabbitmqService,
  options: {
    connected?: boolean;
    channel?: ReturnType<typeof createMockAmqpChannel> | undefined;
    connection?: ReturnType<typeof createMockAmqpConnection> | undefined;
    lastError?: string | undefined;
  } = {},
): void {
  const channel = options.channel;
  const connection =
    options.connection ??
    (channel ? createMockAmqpConnection(channel) : undefined);
  const serviceWithMonitor = service as unknown as {
    monitorConnected: boolean;
    monitorChannel?: ReturnType<typeof createMockAmqpChannel>;
    monitorConnection?: ReturnType<typeof createMockAmqpConnection>;
    lastMonitorError?: string;
    handleMonitorDisconnect(error?: Error): void;
  };

  Object.assign(serviceWithMonitor, {
    monitorConnected: options.connected ?? Boolean(channel && connection),
    monitorChannel: channel,
    monitorConnection: connection,
    lastMonitorError: options.lastError,
  });

  if (connection) {
    connection.removeAllListeners('close');
    connection.removeAllListeners('error');
    connection.on('close', () => {
      serviceWithMonitor.handleMonitorDisconnect();
    });
    connection.on('error', (error: Error) => {
      serviceWithMonitor.handleMonitorDisconnect(error);
    });
  }
}

describe('RabbitmqService', () => {
  let service: RabbitmqService;
  let mockClients: Map<string, ClientProxy>;
  let mockIngestionClient: ReturnType<typeof createMockClientProxy>;
  let mockAnalysisClient: ReturnType<typeof createMockClientProxy>;
  let mockGatewayClient: ReturnType<typeof createMockClientProxy>;

  beforeEach(async () => {
    mockIngestionClient = createMockClientProxy();
    mockAnalysisClient = createMockClientProxy();
    mockGatewayClient = createMockClientProxy();

    mockClients = new Map<string, ClientProxy>([
      [RABBITMQ_CONSTANTS.QUEUES.INGESTION, mockIngestionClient],
      [RABBITMQ_CONSTANTS.QUEUES.ANALYSIS, mockAnalysisClient],
      [RABBITMQ_CONSTANTS.QUEUES.GATEWAY, mockGatewayClient],
    ]);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [RabbitmqService],
    }).compile();

    service = module.get<RabbitmqService>(RabbitmqService);
    setupMockClients(service, mockClients);
  });

  describe('emit', () => {
    describe('pattern routing', () => {
      it.each(Object.entries(PATTERN_TO_QUEUE))(
        'should route %s to %s queue',
        (pattern, expectedQueue) => {
          const data = { jobId: 'test-123', prompt: 'Test' };

          service.emit(pattern, data);

          const client = mockClients.get(expectedQueue);
          expect(client?.emit).toHaveBeenCalledWith(pattern, data);
        },
      );

      it('should throw error for unknown pattern', () => {
        expect(() => service.emit('unknown.pattern', {})).toThrow(
          'No queue configured for pattern: unknown.pattern',
        );
      });

      it('should subscribe to observable to ensure message delivery', () => {
        const data = { jobId: 'test-123' };

        service.emit(MESSAGE_PATTERNS.JOB_START, data);

        expect(mockIngestionClient._emitSubscriptions.length).toBeGreaterThan(
          0,
        );
      });
    });

    describe('error handling', () => {
      it('should log error when emit fails but not throw', () => {
        const error = new Error('Connection lost');
        mockIngestionClient.emit.mockReturnValue(throwError(() => error));

        // Should not throw
        expect(() =>
          service.emit(MESSAGE_PATTERNS.JOB_START, { jobId: 'test' }),
        ).not.toThrow();
      });

      it('should handle non-Error objects in emit failure', () => {
        mockIngestionClient.emit.mockReturnValue(
          throwError(() => 'string error'),
        );

        expect(() =>
          service.emit(MESSAGE_PATTERNS.JOB_START, { jobId: 'test' }),
        ).not.toThrow();
      });
    });
  });

  describe('send', () => {
    it('should send message and return response', async () => {
      const data = { query: 'test' };
      const expectedResponse = { success: true, data: 'result' };
      mockIngestionClient.send.mockReturnValue(of(expectedResponse));

      const result = await service.send(MESSAGE_PATTERNS.JOB_START, data);

      expect(mockIngestionClient.send).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_START,
        data,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should route to correct queue based on pattern', async () => {
      const data = { jobId: 'test' };

      await service.send(MESSAGE_PATTERNS.JOB_RAW_DATA, data);

      expect(mockAnalysisClient.send).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_RAW_DATA,
        data,
      );
    });

    it('should propagate errors from send', async () => {
      const error = new Error('Send failed');
      mockIngestionClient.send.mockReturnValue(throwError(() => error));

      await expect(
        service.send(MESSAGE_PATTERNS.JOB_START, {}),
      ).rejects.toThrow('Send failed');
    });
  });

  describe('emitToQueue', () => {
    it('should emit directly to specified queue', () => {
      const data = { test: 'data' };
      const customPattern = 'custom.pattern';

      service.emitToQueue(
        RABBITMQ_CONSTANTS.QUEUES.INGESTION,
        customPattern,
        data,
      );

      expect(mockIngestionClient.emit).toHaveBeenCalledWith(
        customPattern,
        data,
      );
    });

    it('should throw error for non-existent queue', () => {
      expect(() =>
        service.emitToQueue('non_existent_queue', 'pattern', {}),
      ).toThrow('No client available for queue: non_existent_queue');
    });

    it('should handle emit errors gracefully', () => {
      mockAnalysisClient.emit.mockReturnValue(
        throwError(() => new Error('Queue full')),
      );

      expect(() =>
        service.emitToQueue(RABBITMQ_CONSTANTS.QUEUES.ANALYSIS, 'pattern', {
          data: 'test',
        }),
      ).not.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return true when the monitor connection and channel are healthy', () => {
      setupMockMonitor(service, {
        channel: createMockAmqpChannel(),
      });

      const healthStatus = service.getHealthStatus();

      expect(healthStatus).toEqual({
        healthy: true,
        connected: true,
        initializedQueues: [
          RABBITMQ_CONSTANTS.QUEUES.INGESTION,
          RABBITMQ_CONSTANTS.QUEUES.ANALYSIS,
          RABBITMQ_CONSTANTS.QUEUES.GATEWAY,
        ],
      });
    });

    it('should return false when no clients exist', () => {
      setupMockClients(service, new Map());

      const isHealthy = service.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should report unhealthy when not all expected queues are initialized', () => {
      setupMockClients(
        service,
        new Map<string, ClientProxy>([
          [RABBITMQ_CONSTANTS.QUEUES.INGESTION, mockIngestionClient],
          [RABBITMQ_CONSTANTS.QUEUES.ANALYSIS, mockAnalysisClient],
        ]),
      );
      setupMockMonitor(service, {
        channel: createMockAmqpChannel(),
      });

      expect(service.getHealthStatus()).toEqual({
        healthy: false,
        connected: true,
        initializedQueues: [
          RABBITMQ_CONSTANTS.QUEUES.INGESTION,
          RABBITMQ_CONSTANTS.QUEUES.ANALYSIS,
        ],
      });
    });

    it('should report unhealthy state after the monitor connection closes', () => {
      const monitorChannel = createMockAmqpChannel();
      const monitorConnection = createMockAmqpConnection(monitorChannel);
      setupMockMonitor(service, {
        channel: monitorChannel,
        connection: monitorConnection,
      });

      monitorConnection.emitClose();

      expect(service.healthCheck()).toBe(false);
      expect(service.getHealthStatus()).toEqual({
        healthy: false,
        connected: false,
        initializedQueues: [
          RABBITMQ_CONSTANTS.QUEUES.INGESTION,
          RABBITMQ_CONSTANTS.QUEUES.ANALYSIS,
          RABBITMQ_CONSTANTS.QUEUES.GATEWAY,
        ],
        lastError: 'RabbitMQ monitor connection closed',
      });
    });

    it('should capture the last monitor error when the monitor connection errors', () => {
      const monitorChannel = createMockAmqpChannel();
      const monitorConnection = createMockAmqpConnection(monitorChannel);
      setupMockMonitor(service, {
        channel: monitorChannel,
        connection: monitorConnection,
      });

      monitorConnection.emitError(new Error('Monitor heartbeat lost'));

      expect(service.getHealthStatus()).toEqual({
        healthy: false,
        connected: false,
        initializedQueues: [
          RABBITMQ_CONSTANTS.QUEUES.INGESTION,
          RABBITMQ_CONSTANTS.QUEUES.ANALYSIS,
          RABBITMQ_CONSTANTS.QUEUES.GATEWAY,
        ],
        lastError: 'Monitor heartbeat lost',
      });
    });
  });

  describe('getBackpressureStatus', () => {
    it('should report queue depth and threshold backpressure from the monitor channel', async () => {
      const monitorChannel = createMockAmqpChannel({
        checkQueue: jest.fn().mockResolvedValue({
          queue: RABBITMQ_CONSTANTS.QUEUES.ANALYSIS,
          messageCount: 100,
          consumerCount: 4,
        }),
      });
      setupMockMonitor(service, {
        channel: monitorChannel,
      });

      await expect(
        service.getBackpressureStatus(RABBITMQ_CONSTANTS.QUEUES.ANALYSIS, 100),
      ).resolves.toEqual({
        queue: RABBITMQ_CONSTANTS.QUEUES.ANALYSIS,
        messageCount: 100,
        consumerCount: 4,
        threshold: 100,
        isBackpressured: true,
      });
    });

    it('should return a sentinel backpressure result when the monitor is unavailable', async () => {
      await expect(
        service.getBackpressureStatus(RABBITMQ_CONSTANTS.QUEUES.INGESTION, 25),
      ).resolves.toEqual({
        queue: RABBITMQ_CONSTANTS.QUEUES.INGESTION,
        messageCount: -1,
        consumerCount: 0,
        threshold: 25,
        isBackpressured: true,
      });
    });

    it('should return the sentinel contract when queue inspection fails', async () => {
      const monitorChannel = createMockAmqpChannel({
        checkQueue: jest
          .fn()
          .mockRejectedValue(new Error('Queue inspect failed')),
      });
      setupMockMonitor(service, {
        channel: monitorChannel,
      });

      await expect(
        service.getBackpressureStatus(RABBITMQ_CONSTANTS.QUEUES.GATEWAY, 10),
      ).resolves.toEqual({
        queue: RABBITMQ_CONSTANTS.QUEUES.GATEWAY,
        messageCount: -1,
        consumerCount: 0,
        threshold: 10,
        isBackpressured: true,
      });
      expect(service.getHealthStatus()).toMatchObject({
        lastError: 'Queue inspect failed',
      });
    });
  });

  describe('isInitialized', () => {
    it('should return true when clients exist', () => {
      expect(service.isInitialized()).toBe(true);
    });

    it('should return false when clients map is empty', () => {
      setupMockClients(service, new Map());

      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('getClient', () => {
    it.each([
      ['INGESTION', RABBITMQ_CONSTANTS.QUEUES.INGESTION],
      ['ANALYSIS', RABBITMQ_CONSTANTS.QUEUES.ANALYSIS],
      ['GATEWAY', RABBITMQ_CONSTANTS.QUEUES.GATEWAY],
    ] as const)('should return client for %s queue', (_name, queue) => {
      const client = service.getClient(queue);

      expect(client).toBe(mockClients.get(queue));
    });

    it('should throw error for non-existent queue', () => {
      expect(() => service.getClient('non_existent_queue')).toThrow(
        'No client available for queue: non_existent_queue',
      );
    });

    it('should return first client when no queue specified', () => {
      const client = service.getClient();

      expect(client).toBeDefined();
    });

    it('should throw when no queue specified and no clients available', () => {
      setupMockClients(service, new Map());

      expect(() => service.getClient()).toThrow(
        'No RabbitMQ clients available',
      );
    });
  });

  describe('onModuleInit', () => {
    let freshService: RabbitmqService;
    let mockConfigService: jest.Mocked<ConfigService>;
    let mockMonitorChannel: ReturnType<typeof createMockAmqpChannel>;
    let mockMonitorConnection: ReturnType<typeof createMockAmqpConnection>;

    beforeEach(async () => {
      mockMonitorChannel = createMockAmqpChannel();
      mockMonitorConnection = createMockAmqpConnection(mockMonitorChannel);
      jest
        .mocked(amqplib.connect)
        .mockResolvedValue(
          mockMonitorConnection as unknown as Awaited<
            ReturnType<typeof amqplib.connect>
          >,
        );

      mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
          const config: Record<string, string | number> = {
            RABBITMQ_HOST: 'localhost',
            RABBITMQ_PORT: 5672,
            RABBITMQ_USER: 'guest',
            RABBITMQ_PASSWORD: 'guest',
            RABBITMQ_VHOST: '/',
          };
          return config[key];
        }),
      } as unknown as jest.Mocked<ConfigService>;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RabbitmqService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      freshService = module.get<RabbitmqService>(RabbitmqService);
    });

    it('should create clients for all queues during initialization', async () => {
      const createSpy = jest
        .spyOn(ClientProxyFactory, 'create')
        .mockReturnValue(createMockClientProxy());

      await freshService.onModuleInit();

      expect(createSpy).toHaveBeenCalledTimes(3);
      expect(freshService.isInitialized()).toBe(true);

      createSpy.mockRestore();
    });

    it('should initialize a monitor connection and report healthy status after startup', async () => {
      jest
        .spyOn(ClientProxyFactory, 'create')
        .mockReturnValue(createMockClientProxy());

      await freshService.onModuleInit();

      expect(amqplib.connect).toHaveBeenCalled();
      expect(mockMonitorConnection.createChannel).toHaveBeenCalled();
      expect(freshService.getHealthStatus()).toEqual({
        healthy: true,
        connected: true,
        initializedQueues: [
          RABBITMQ_CONSTANTS.QUEUES.INGESTION,
          RABBITMQ_CONSTANTS.QUEUES.ANALYSIS,
          RABBITMQ_CONSTANTS.QUEUES.GATEWAY,
        ],
      });
    });

    it('should connect each client after creation', async () => {
      const mockClient = createMockClientProxy();
      jest.spyOn(ClientProxyFactory, 'create').mockReturnValue(mockClient);

      await freshService.onModuleInit();

      expect(mockClient.connect).toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should throw when connection fails', async () => {
      const connectionError = new Error('ECONNREFUSED');
      const failingClient = {
        ...createMockClientProxy(),
        connect: jest.fn().mockRejectedValue(connectionError),
      };
      jest
        .spyOn(ClientProxyFactory, 'create')
        .mockReturnValue(failingClient as unknown as ClientProxy);

      await expect(freshService.onModuleInit()).rejects.toThrow('ECONNREFUSED');

      jest.restoreAllMocks();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close the monitor channel and connection', async () => {
      const monitorChannel = createMockAmqpChannel();
      const monitorConnection = createMockAmqpConnection(monitorChannel);
      setupMockMonitor(service, {
        channel: monitorChannel,
        connection: monitorConnection,
      });

      await service.onModuleDestroy();

      expect(monitorChannel.close).toHaveBeenCalled();
      expect(monitorConnection.close).toHaveBeenCalled();
    });

    it('should close all client connections', async () => {
      await service.onModuleDestroy();

      expect(mockIngestionClient.close).toHaveBeenCalled();
      expect(mockAnalysisClient.close).toHaveBeenCalled();
      expect(mockGatewayClient.close).toHaveBeenCalled();
    });

    it('should clear clients map after closing', async () => {
      setupMockMonitor(service, {
        channel: createMockAmqpChannel(),
        lastError: 'stale monitor error',
      });

      await service.onModuleDestroy();

      expect(service.isInitialized()).toBe(false);
      expect(service.getHealthStatus()).toEqual({
        healthy: false,
        connected: false,
        initializedQueues: [],
      });
    });

    it('should handle close errors gracefully', async () => {
      const monitorChannel = createMockAmqpChannel();
      const monitorConnection = createMockAmqpConnection(monitorChannel);
      setupMockMonitor(service, {
        channel: monitorChannel,
        connection: monitorConnection,
      });
      mockIngestionClient.close.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
      expect(monitorChannel.close).toHaveBeenCalled();
      expect(monitorConnection.close).toHaveBeenCalled();
    });
  });

  describe('PATTERN_TO_QUEUE routing', () => {
    it.each(Object.entries(PATTERN_TO_QUEUE))(
      'getQueueForPattern(%s) should return %s',
      (pattern, expectedQueue) => {
        expect(getQueueForPattern(pattern)).toBe(expectedQueue);
      },
    );

    it('should cover all defined MESSAGE_PATTERNS', () => {
      const messagePatternValues = Object.values(MESSAGE_PATTERNS);
      const routedPatterns = Object.keys(PATTERN_TO_QUEUE);

      for (const pattern of messagePatternValues) {
        expect(routedPatterns).toContain(pattern);
      }
    });
  });
});
