import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { RmqContext } from '@nestjs/microservices';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { RabbitmqService } from '@app/rabbitmq';
import { JobsRepository } from '@app/database/repositories/jobs.repository';
import { JetstreamManagerService } from './jetstream/jetstream-manager.service';
import {
  createMockRabbitMqContext,
  createMockJetstreamManagerService,
  createMockJobsRepository,
  MockJobStore,
  assertMessageAcked,
  assertMessageNacked,
} from '@app/testing';
import {
  createMockStartJobMessage,
  createMockCancelJobMessage,
  resetMessageCounter,
} from '../../../test/fixtures';

describe('IngestionController', () => {
  let controller: IngestionController;
  let service: IngestionService;
  let mockJetstreamManager: ReturnType<
    typeof createMockJetstreamManagerService
  >;
  let mockJobStore: MockJobStore;
  let mockJobsRepository: ReturnType<typeof createMockJobsRepository>;

  beforeEach(async () => {
    resetMessageCounter();
    mockJobStore = new MockJobStore();
    mockJobsRepository = createMockJobsRepository(mockJobStore);
    mockJetstreamManager = createMockJetstreamManagerService();

    const mockRabbitmqService = {
      emit: jest.fn(),
      getClient: jest.fn(),
    };

    const mockConfigService = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue: unknown) => {
          if (key === 'JETSTREAM_MAX_DURATION_MS') return 120000;
          return defaultValue;
        }),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        IngestionService,
        { provide: RabbitmqService, useValue: mockRabbitmqService },
        { provide: JetstreamManagerService, useValue: mockJetstreamManager },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JobsRepository, useValue: mockJobsRepository },
      ],
    }).compile();

    controller = app.get<IngestionController>(IngestionController);
    service = app.get<IngestionService>(IngestionService);
  });

  describe('controller instantiation', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('handleStartJob', () => {
    describe('message acknowledgment', () => {
      it('should ack message when processing succeeds', async () => {
        const message = createMockStartJobMessage({ prompt: 'test prompt' });
        const ctx = createMockRabbitMqContext({
          pattern: 'job.start',
          message: message as unknown as Record<string, unknown>,
          properties: { correlationId: message.jobId },
        });

        // Simulate job exists in DB
        (mockJobsRepository.findById as jest.Mock).mockResolvedValue({
          id: message.jobId,
          status: 'pending',
          prompt: message.prompt,
        });

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        assertMessageAcked(ctx);
      });

      it('should nack without requeue when jobId is missing', async () => {
        const message = { ...createMockStartJobMessage(), jobId: '' };
        const ctx = createMockRabbitMqContext({ pattern: 'job.start' });

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        assertMessageNacked(ctx, false);
        expect(mockJetstreamManager.registerJob).not.toHaveBeenCalled();
      });

      it('should nack without requeue when prompt is missing', async () => {
        const message = { ...createMockStartJobMessage(), prompt: '' };
        const ctx = createMockRabbitMqContext({ pattern: 'job.start' });

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        assertMessageNacked(ctx, false);
        expect(mockJetstreamManager.registerJob).not.toHaveBeenCalled();
      });
    });

    describe('error handling with requeue logic', () => {
      beforeEach(() => {
        // Simulate job exists in DB for all error tests
        (mockJobsRepository.findById as jest.Mock).mockResolvedValue({
          id: 'test-job-id',
          status: 'pending',
          prompt: 'test',
        });
      });

      it('should requeue message when timeout error occurs', async () => {
        const message = createMockStartJobMessage();
        const ctx = createMockRabbitMqContext({
          pattern: 'job.start',
          properties: { correlationId: message.jobId },
        });

        jest
          .spyOn(service, 'processJob')
          .mockRejectedValue(new Error('Connection timeout'));

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        // Nack with requeue=true for transient errors
        expect(ctx._channel.nack).toHaveBeenCalledWith(
          ctx._message,
          false,
          true,
        );
      });

      it('should requeue message when connection error occurs', async () => {
        const message = createMockStartJobMessage();
        const ctx = createMockRabbitMqContext({ pattern: 'job.start' });

        jest
          .spyOn(service, 'processJob')
          .mockRejectedValue(new Error('ECONNREFUSED'));

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        expect(ctx._channel.nack).toHaveBeenCalledWith(
          ctx._message,
          false,
          true,
        );
      });

      it('should requeue message when temporary error occurs', async () => {
        const message = createMockStartJobMessage();
        const ctx = createMockRabbitMqContext({ pattern: 'job.start' });

        jest
          .spyOn(service, 'processJob')
          .mockRejectedValue(new Error('Temporary failure'));

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        expect(ctx._channel.nack).toHaveBeenCalledWith(
          ctx._message,
          false,
          true,
        );
      });

      it('should not requeue message when validation error occurs', async () => {
        const message = createMockStartJobMessage();
        const ctx = createMockRabbitMqContext({ pattern: 'job.start' });

        jest
          .spyOn(service, 'processJob')
          .mockRejectedValue(new Error('Validation failed'));

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        // Nack with requeue=false for permanent errors
        expect(ctx._channel.nack).toHaveBeenCalledWith(
          ctx._message,
          false,
          false,
        );
      });

      it('should not requeue message when invalid input error occurs', async () => {
        const message = createMockStartJobMessage();
        const ctx = createMockRabbitMqContext({ pattern: 'job.start' });

        jest
          .spyOn(service, 'processJob')
          .mockRejectedValue(new Error('Invalid prompt format'));

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        expect(ctx._channel.nack).toHaveBeenCalledWith(
          ctx._message,
          false,
          false,
        );
      });

      it('should not requeue message when resource not found', async () => {
        const message = createMockStartJobMessage();
        const ctx = createMockRabbitMqContext({ pattern: 'job.start' });

        jest
          .spyOn(service, 'processJob')
          .mockRejectedValue(new Error('Resource not found'));

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        expect(ctx._channel.nack).toHaveBeenCalledWith(
          ctx._message,
          false,
          false,
        );
      });

      it('should not requeue message for unknown errors (default behavior)', async () => {
        const message = createMockStartJobMessage();
        const ctx = createMockRabbitMqContext({ pattern: 'job.start' });

        jest
          .spyOn(service, 'processJob')
          .mockRejectedValue(new Error('Unknown error'));

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        // Unknown errors default to no requeue to avoid infinite loops
        expect(ctx._channel.nack).toHaveBeenCalledWith(
          ctx._message,
          false,
          false,
        );
      });

      it('should not requeue message when non-Error object is thrown', async () => {
        const message = createMockStartJobMessage();
        const ctx = createMockRabbitMqContext({ pattern: 'job.start' });

        jest.spyOn(service, 'processJob').mockRejectedValue('string error');

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        expect(ctx._channel.nack).toHaveBeenCalledWith(
          ctx._message,
          false,
          false,
        );
      });
    });

    describe('correlation ID extraction', () => {
      it('should use correlationId from message properties when available', async () => {
        const message = createMockStartJobMessage();
        const correlationId = 'custom-correlation-id';
        const ctx = createMockRabbitMqContext({
          pattern: 'job.start',
          properties: { correlationId },
        });

        (mockJobsRepository.findById as jest.Mock).mockResolvedValue({
          id: message.jobId,
          status: 'pending',
          prompt: message.prompt,
        });

        const processJobSpy = jest.spyOn(service, 'processJob');

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        expect(processJobSpy).toHaveBeenCalledWith(message, correlationId);
      });

      it('should fallback to jobId when correlationId is not set', async () => {
        const message = createMockStartJobMessage();
        const ctx = createMockRabbitMqContext({
          pattern: 'job.start',
          properties: { correlationId: '' },
        });
        // Override the mock to return no correlationId
        (ctx.getMessage as jest.Mock).mockReturnValue({
          ...ctx._message,
          properties: { ...ctx._message.properties, correlationId: undefined },
        });

        (mockJobsRepository.findById as jest.Mock).mockResolvedValue({
          id: message.jobId,
          status: 'pending',
          prompt: message.prompt,
        });

        const processJobSpy = jest.spyOn(service, 'processJob');

        await controller.handleStartJob(message, ctx as unknown as RmqContext);

        expect(processJobSpy).toHaveBeenCalledWith(message, message.jobId);
      });
    });
  });

  describe('handleCancelJob', () => {
    describe('message acknowledgment', () => {
      it('should ack message and call cancelJob when valid jobId provided', () => {
        const message = createMockCancelJobMessage({ jobId: 'job-to-cancel' });
        const ctx = createMockRabbitMqContext({ pattern: 'job.cancel' });

        controller.handleCancelJob(message, ctx as unknown as RmqContext);

        assertMessageAcked(ctx);
        expect(mockJetstreamManager.cancelJob).toHaveBeenCalledWith(
          'job-to-cancel',
        );
      });

      it('should nack without requeue when jobId is missing', () => {
        const message = { ...createMockCancelJobMessage(), jobId: '' };
        const ctx = createMockRabbitMqContext({ pattern: 'job.cancel' });

        controller.handleCancelJob(message, ctx as unknown as RmqContext);

        assertMessageNacked(ctx, false);
        expect(mockJetstreamManager.cancelJob).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should nack without requeue when cancelJob throws', () => {
        const message = createMockCancelJobMessage();
        const ctx = createMockRabbitMqContext({ pattern: 'job.cancel' });

        // Make the service throw via the jetstream manager
        jest.spyOn(service, 'cancelJob').mockImplementation(() => {
          throw new Error('Cancel failed');
        });

        controller.handleCancelJob(message, ctx as unknown as RmqContext);

        // Cancel messages should never be requeued
        assertMessageNacked(ctx, false);
      });
    });
  });
});
