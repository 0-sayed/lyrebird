import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { RabbitmqService } from './rabbitmq.service';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { RABBITMQ_CONSTANTS } from './rabbitmq.constants';

describe('RabbitmqService', () => {
  let service: RabbitmqService;
  let mockClient: Partial<ClientProxy>;

  beforeEach(async () => {
    // Mock ClientProxy
    mockClient = {
      emit: jest.fn().mockReturnValue(of(undefined)),
      send: jest.fn().mockReturnValue(of({ success: true })),
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

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

    // Manually inject mock clients (bypassing onModuleInit)
    const clientsMap = new Map<string, ClientProxy>();
    clientsMap.set(
      RABBITMQ_CONSTANTS.QUEUES.INGESTION,
      mockClient as ClientProxy,
    );
    clientsMap.set(
      RABBITMQ_CONSTANTS.QUEUES.ANALYSIS,
      mockClient as ClientProxy,
    );
    clientsMap.set(
      RABBITMQ_CONSTANTS.QUEUES.GATEWAY,
      mockClient as ClientProxy,
    );
    (service as unknown as { clients: Map<string, ClientProxy> }).clients =
      clientsMap;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emit', () => {
    it('should emit message to correct queue based on pattern', () => {
      const data = { jobId: '123', prompt: 'Test' };

      service.emit('job.start', data);

      expect(mockClient.emit).toHaveBeenCalledWith('job.start', data);
    });

    it('should throw error for unknown pattern', () => {
      expect(() => service.emit('unknown.pattern', {})).toThrow(
        'No queue configured for pattern: unknown.pattern',
      );
    });
  });

  describe('send', () => {
    it('should send message and return response', async () => {
      const data = { query: 'test' };

      const result = await service.send('job.start', data);

      expect(mockClient.send).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('healthCheck', () => {
    it('should return true when clients are initialized', async () => {
      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should return false when no clients exist', async () => {
      (service as unknown as { clients: Map<string, ClientProxy> }).clients =
        new Map();

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('isInitialized', () => {
    it('should return true when clients exist', () => {
      expect(service.isInitialized()).toBe(true);
    });

    it('should return false when clients map is empty', () => {
      (service as unknown as { clients: Map<string, ClientProxy> }).clients =
        new Map();

      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('getClient', () => {
    it('should return client for specific queue', () => {
      const client = service.getClient(RABBITMQ_CONSTANTS.QUEUES.INGESTION);

      expect(client).toBe(mockClient);
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
  });

  describe('emitToQueue', () => {
    it('should emit directly to specified queue', () => {
      const data = { test: 'data' };

      service.emitToQueue(
        RABBITMQ_CONSTANTS.QUEUES.INGESTION,
        'custom.pattern',
        data,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('custom.pattern', data);
    });
  });
});
