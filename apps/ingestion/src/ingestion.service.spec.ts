import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { RabbitmqService } from '@app/rabbitmq';
import { JobsRepository } from '@app/database/repositories/jobs.repository';
import {
  JetstreamManagerService,
  JetstreamJobConfig,
} from './jetstream/jetstream-manager.service';
import { MESSAGE_PATTERNS, JobStatus, RawDataMessage } from '@app/shared-types';
import {
  createMockJetstreamManagerService,
  createMockRabbitmqService,
  createMockJobsRepository,
  MockJobStore,
} from '@app/testing';
import {
  createMockStartJobMessage,
  createMockRawDataMessage,
  createMockRawDataMessageBatch,
  resetMessageCounter,
} from '../../../test/fixtures';

describe('IngestionService', () => {
  let service: IngestionService;
  let mockRabbitmqService: ReturnType<typeof createMockRabbitmqService>;
  let mockJetstreamManager: ReturnType<
    typeof createMockJetstreamManagerService
  >;
  let mockConfigService: { get: jest.Mock };
  let mockJobsRepository: ReturnType<typeof createMockJobsRepository>;
  let mockJobStore: MockJobStore;

  // Default test data
  const DEFAULT_MAX_DURATION_MS = 120000;
  const TEST_JOB_ID = '123e4567-e89b-12d3-a456-426614174000';
  const TEST_CORRELATION_ID = 'test-correlation';

  beforeEach(async () => {
    resetMessageCounter();
    mockJobStore = new MockJobStore();

    mockRabbitmqService = createMockRabbitmqService();
    mockJetstreamManager = createMockJetstreamManagerService();
    mockJetstreamManager.isEnabled.mockReturnValue(true);

    mockConfigService = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue: unknown) => {
          if (key === 'JETSTREAM_MAX_DURATION_MS')
            return DEFAULT_MAX_DURATION_MS;
          return defaultValue;
        }),
    };

    mockJobsRepository = createMockJobsRepository(mockJobStore);

    // Create a job in the store by default
    mockJobStore.set(TEST_JOB_ID, {
      id: TEST_JOB_ID,
      status: JobStatus.IN_PROGRESS,
      prompt: 'Test product',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: RabbitmqService, useValue: mockRabbitmqService },
        { provide: JetstreamManagerService, useValue: mockJetstreamManager },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JobsRepository, useValue: mockJobsRepository },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processJob', () => {
    /**
     * Helper to setup Jetstream mock with custom behavior
     */
    function setupJetstreamMock(
      options: {
        dataItems?: RawDataMessage[];
        completeCount?: number;
        skipComplete?: boolean;
      } = {},
    ) {
      const {
        dataItems = [],
        completeCount = dataItems.length,
        skipComplete = false,
      } = options;

      mockJetstreamManager.registerJob.mockImplementation(
        (config: JetstreamJobConfig) => {
          // Emit data items via onData callback
          for (const data of dataItems) {
            void config.onData(data);
          }
          // Call onComplete unless skipped
          if (!skipComplete) {
            config.onComplete(completeCount);
          }
          return Promise.resolve();
        },
      );
    }

    describe('job registration', () => {
      it('should register job with Jetstream manager', async () => {
        setupJetstreamMock();
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(mockJetstreamManager.registerJob).toHaveBeenCalledWith(
          expect.objectContaining({
            jobId: message.jobId,
            prompt: message.prompt,
            correlationId: TEST_CORRELATION_ID,
            maxDurationMs: DEFAULT_MAX_DURATION_MS,
          }),
        );
      });

      it('should skip processing when job not found in database', async () => {
        setupJetstreamMock();
        // Remove job from store (simulates deleted job)
        mockJobStore.delete(TEST_JOB_ID);
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(mockJetstreamManager.registerJob).not.toHaveBeenCalled();
        expect(mockRabbitmqService.emit).not.toHaveBeenCalled();
      });

      it('should check job existence before starting Jetstream', async () => {
        setupJetstreamMock();
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(mockJobsRepository.findById).toHaveBeenCalledWith(message.jobId);
        expect(mockJetstreamManager.registerJob).toHaveBeenCalled();
      });
    });

    describe('maxDurationMs configuration', () => {
      it('should use message options when provided', async () => {
        setupJetstreamMock();
        const customDuration = 60000;
        const message = createMockStartJobMessage({
          jobId: TEST_JOB_ID,
          options: { job: { maxDurationMs: customDuration } },
        });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(mockJetstreamManager.registerJob).toHaveBeenCalledWith(
          expect.objectContaining({ maxDurationMs: customDuration }),
        );
      });

      it('should use environment config when options not provided', async () => {
        setupJetstreamMock();
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(mockJetstreamManager.registerJob).toHaveBeenCalledWith(
          expect.objectContaining({ maxDurationMs: DEFAULT_MAX_DURATION_MS }),
        );
      });

      it.each([
        [30000, 'short duration'],
        [300000, 'long duration'],
        [0, 'zero duration'],
      ])('should pass %i ms for %s', async (duration) => {
        setupJetstreamMock();
        const message = createMockStartJobMessage({
          jobId: TEST_JOB_ID,
          options: { job: { maxDurationMs: duration } },
        });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(mockJetstreamManager.registerJob).toHaveBeenCalledWith(
          expect.objectContaining({ maxDurationMs: duration }),
        );
      });
    });

    describe('message emission', () => {
      it('should emit JOB_INITIAL_BATCH_COMPLETE with streamingActive=true', async () => {
        setupJetstreamMock();
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
          MESSAGE_PATTERNS.JOB_INITIAL_BATCH_COMPLETE,
          expect.objectContaining({
            jobId: message.jobId,
            initialBatchCount: 0,
            streamingActive: true,
            completedAt: expect.any(Date) as Date,
          }),
        );
      });

      it('should emit JOB_INGESTION_COMPLETE with totalItems count', async () => {
        const dataItems = createMockRawDataMessageBatch(3, {
          jobId: TEST_JOB_ID,
        });
        setupJetstreamMock({ dataItems });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
          MESSAGE_PATTERNS.JOB_INGESTION_COMPLETE,
          expect.objectContaining({
            jobId: message.jobId,
            totalItems: 3,
            completedAt: expect.any(Date) as Date,
          }),
        );
      });

      it('should emit raw data messages via onData callback', async () => {
        const dataItems = createMockRawDataMessageBatch(3, {
          jobId: TEST_JOB_ID,
        });
        setupJetstreamMock({ dataItems });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        await service.processJob(message, TEST_CORRELATION_ID);

        // 1 initial batch + 3 raw data + 1 ingestion complete = 5 total
        expect(mockRabbitmqService.emit).toHaveBeenCalledTimes(5);
        expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
          MESSAGE_PATTERNS.JOB_RAW_DATA,
          expect.objectContaining({ jobId: message.jobId }),
        );
      });

      it('should handle empty results gracefully', async () => {
        setupJetstreamMock({ dataItems: [], completeCount: 0 });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        await service.processJob(message, TEST_CORRELATION_ID);

        // 1 initial batch + 1 ingestion complete = 2 total
        expect(mockRabbitmqService.emit).toHaveBeenCalledTimes(2);
        expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
          MESSAGE_PATTERNS.JOB_INGESTION_COMPLETE,
          expect.objectContaining({ totalItems: 0 }),
        );
      });
    });

    describe('raw data content', () => {
      it('should include source as bluesky', async () => {
        const dataItems = [
          createMockRawDataMessage({ jobId: TEST_JOB_ID, source: 'bluesky' }),
        ];
        setupJetstreamMock({ dataItems });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
          MESSAGE_PATTERNS.JOB_RAW_DATA,
          expect.objectContaining({ source: 'bluesky' }),
        );
      });

      it('should include timestamps in raw data', async () => {
        const dataItems = [createMockRawDataMessage({ jobId: TEST_JOB_ID })];
        setupJetstreamMock({ dataItems });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
          MESSAGE_PATTERNS.JOB_RAW_DATA,
          expect.objectContaining({
            publishedAt: expect.any(Date) as Date,
            collectedAt: expect.any(Date) as Date,
          }),
        );
      });
    });
  });

  describe('error handling', () => {
    /**
     * Helper to setup Jetstream mock with custom behavior
     */
    function setupJetstreamMock(
      options: {
        dataItems?: RawDataMessage[];
        completeCount?: number;
      } = {},
    ) {
      const { dataItems = [], completeCount = dataItems.length } = options;

      mockJetstreamManager.registerJob.mockImplementation(
        (config: JetstreamJobConfig) => {
          for (const data of dataItems) {
            void config.onData(data);
          }
          config.onComplete(completeCount);
          return Promise.resolve();
        },
      );
    }

    describe('onData callback errors', () => {
      it('should not crash when RabbitMQ emit throws in onData', async () => {
        const dataItems = createMockRawDataMessageBatch(3, {
          jobId: TEST_JOB_ID,
        });
        setupJetstreamMock({ dataItems });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        // First call (JOB_INITIAL_BATCH_COMPLETE) succeeds, rest throw
        let callCount = 0;
        mockRabbitmqService.emit.mockImplementation(() => {
          callCount++;
          if (callCount > 1) {
            throw new Error('RabbitMQ connection lost');
          }
        });

        await expect(
          service.processJob(message, TEST_CORRELATION_ID),
        ).resolves.not.toThrow();
      });

      it('should continue processing after one emit fails', async () => {
        const dataItems = createMockRawDataMessageBatch(3, {
          jobId: TEST_JOB_ID,
        });
        setupJetstreamMock({ dataItems });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        const emittedPatterns: string[] = [];
        mockRabbitmqService.emit.mockImplementation((pattern: string) => {
          emittedPatterns.push(pattern);
          // Fail on second raw data emit only
          if (
            pattern === MESSAGE_PATTERNS.JOB_RAW_DATA &&
            emittedPatterns.filter((p) => p === MESSAGE_PATTERNS.JOB_RAW_DATA)
              .length === 2
          ) {
            throw new Error('Transient network error');
          }
        });

        await service.processJob(message, TEST_CORRELATION_ID);

        // Should have attempted all emits (1 initial + 3 raw + 1 complete = 5)
        expect(mockRabbitmqService.emit).toHaveBeenCalledTimes(5);
      });
    });

    describe('onComplete callback errors', () => {
      it('should handle RabbitMQ emit failure in onComplete gracefully', async () => {
        setupJetstreamMock({ dataItems: [], completeCount: 0 });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        mockRabbitmqService.emit.mockImplementation((pattern: string) => {
          if (pattern === MESSAGE_PATTERNS.JOB_INGESTION_COMPLETE) {
            throw new Error('Failed to emit completion message');
          }
        });

        await expect(
          service.processJob(message, TEST_CORRELATION_ID),
        ).resolves.not.toThrow();
      });

      it('should still attempt ingestion complete emit after data processing', async () => {
        setupJetstreamMock({ dataItems: [], completeCount: 5 });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
          MESSAGE_PATTERNS.JOB_INGESTION_COMPLETE,
          expect.objectContaining({ jobId: message.jobId, totalItems: 5 }),
        );
      });
    });

    describe('RabbitMQ emit failures', () => {
      it('should handle initial batch complete emit failure', async () => {
        setupJetstreamMock({ dataItems: [], completeCount: 0 });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        mockRabbitmqService.emit.mockImplementation((pattern: string) => {
          if (pattern === MESSAGE_PATTERNS.JOB_INITIAL_BATCH_COMPLETE) {
            throw new Error('RabbitMQ unavailable');
          }
        });

        await expect(
          service.processJob(message, TEST_CORRELATION_ID),
        ).resolves.not.toThrow();

        // Should still register the job with Jetstream
        expect(mockJetstreamManager.registerJob).toHaveBeenCalled();
      });

      it('should emit to correct patterns even when some fail', async () => {
        const dataItems = [createMockRawDataMessage({ jobId: TEST_JOB_ID })];
        setupJetstreamMock({ dataItems, completeCount: 1 });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        const emittedPatterns: string[] = [];
        mockRabbitmqService.emit.mockImplementation((pattern: string) => {
          emittedPatterns.push(pattern);
          if (pattern === MESSAGE_PATTERNS.JOB_RAW_DATA) {
            throw new Error('Queue full');
          }
        });

        await service.processJob(message, TEST_CORRELATION_ID);

        expect(emittedPatterns).toContain(
          MESSAGE_PATTERNS.JOB_INITIAL_BATCH_COMPLETE,
        );
        expect(emittedPatterns).toContain(MESSAGE_PATTERNS.JOB_RAW_DATA);
        expect(emittedPatterns).toContain(
          MESSAGE_PATTERNS.JOB_INGESTION_COMPLETE,
        );
      });

      it('should handle all RabbitMQ emits failing without crashing', async () => {
        const dataItems = [createMockRawDataMessage({ jobId: TEST_JOB_ID })];
        setupJetstreamMock({ dataItems, completeCount: 1 });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        mockRabbitmqService.emit.mockImplementation(() => {
          throw new Error('RabbitMQ completely unavailable');
        });

        await expect(
          service.processJob(message, TEST_CORRELATION_ID),
        ).resolves.not.toThrow();
      });

      it('should log errors for multiple consecutive emit failures', async () => {
        const dataItems = createMockRawDataMessageBatch(3, {
          jobId: TEST_JOB_ID,
        });
        setupJetstreamMock({ dataItems, completeCount: 3 });
        const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

        // Spy on Logger.prototype.error to verify error logging
        const loggerErrorSpy = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation();

        // All emits fail
        mockRabbitmqService.emit.mockImplementation(() => {
          throw new Error('RabbitMQ connection lost');
        });

        await service.processJob(message, TEST_CORRELATION_ID);

        // Verify errors were logged (not silently swallowed)
        // 1 error for JOB_INITIAL_BATCH_COMPLETE + 3 errors for JOB_RAW_DATA + 1 for JOB_INGESTION_COMPLETE = 5
        expect(loggerErrorSpy).toHaveBeenCalledTimes(5);

        // Verify error messages include correlation ID and context
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(TEST_CORRELATION_ID),
          expect.any(String),
        );
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to emit'),
          expect.any(String),
        );

        loggerErrorSpy.mockRestore();
      });
    });
  });

  describe('isJobActive', () => {
    it('should return true when the specific job is registered', () => {
      mockJetstreamManager.isJobRegistered.mockReturnValue(true);

      expect(service.isJobActive('job-123')).toBe(true);
      expect(mockJetstreamManager.isJobRegistered).toHaveBeenCalledWith(
        'job-123',
      );
    });

    it('should return false when the specific job is not registered', () => {
      mockJetstreamManager.isJobRegistered.mockReturnValue(false);

      expect(service.isJobActive('job-123')).toBe(false);
      expect(mockJetstreamManager.isJobRegistered).toHaveBeenCalledWith(
        'job-123',
      );
    });

    it('should check the specific job ID passed to it', () => {
      mockJetstreamManager.isJobRegistered.mockImplementation(
        (jobId: string) => jobId === 'job-456',
      );

      expect(service.isJobActive('job-123')).toBe(false);
      expect(service.isJobActive('job-456')).toBe(true);
    });
  });

  describe('getActiveJobCount', () => {
    it.each([
      [0, 'no active jobs'],
      [1, 'one active job'],
      [3, 'multiple active jobs'],
      [100, 'many active jobs'],
    ])('should return %i for %s', (count) => {
      mockJetstreamManager.getStatus.mockReturnValue({
        enabled: true,
        isListening: true,
        connectionStatus: 'connected',
        activeJobCount: count,
        metrics: {},
      });

      expect(service.getActiveJobCount()).toBe(count);
    });
  });

  describe('cancelJob', () => {
    it('should delegate to jetstreamManager.cancelJob', () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174001';

      service.cancelJob(jobId);

      expect(mockJetstreamManager.cancelJob).toHaveBeenCalledWith(jobId);
      expect(mockJetstreamManager.cancelJob).toHaveBeenCalledTimes(1);
    });

    it('should cancel different jobs independently', () => {
      const jobId1 = '123e4567-e89b-12d3-a456-426614174001';
      const jobId2 = '123e4567-e89b-12d3-a456-426614174002';

      service.cancelJob(jobId1);
      service.cancelJob(jobId2);

      expect(mockJetstreamManager.cancelJob).toHaveBeenNthCalledWith(1, jobId1);
      expect(mockJetstreamManager.cancelJob).toHaveBeenNthCalledWith(2, jobId2);
    });

    it('should cancel job while processing is ongoing', () => {
      // Setup Jetstream mock that doesn't complete immediately
      mockJetstreamManager.registerJob.mockImplementation(() => {
        // Simulate long-running job by not calling onComplete
        return Promise.resolve();
      });

      const message = createMockStartJobMessage({ jobId: TEST_JOB_ID });

      // Start processing
      void service.processJob(message, TEST_CORRELATION_ID);

      // Cancel while processing
      service.cancelJob(TEST_JOB_ID);

      expect(mockJetstreamManager.cancelJob).toHaveBeenCalledWith(TEST_JOB_ID);
    });
  });

  describe('onModuleInit', () => {
    it('should log ingestion mode on startup', () => {
      // Just verify the method doesn't throw
      expect(() => service.onModuleInit()).not.toThrow();
    });
  });
});
