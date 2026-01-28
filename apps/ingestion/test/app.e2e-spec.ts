import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  DatabaseService,
  JobsRepository,
  SentimentDataRepository,
} from '@app/database';
import { RabbitmqService } from '@app/rabbitmq';
import { BlueskyClientService } from '@app/bluesky';
import {
  createMockDatabaseService,
  createMockRabbitmqService,
  createMockJobsRepository,
  createMockSentimentDataRepository,
  createMockBlueskyClientService,
  createMockJetstreamManagerService,
} from '@app/testing';
import { IngestionController } from '@app/ingestion/ingestion.controller';
import { IngestionService } from '@app/ingestion/ingestion.service';
import { HealthController } from '@app/ingestion/health/health.controller';
import {
  JetstreamManagerService,
  JetstreamJobConfig,
} from '@app/ingestion/jetstream/jetstream-manager.service';
import { MESSAGE_PATTERNS, RawDataMessage, JobStatus } from '@app/shared-types';

// Create mocks using shared utilities
const mockJobsRepository = createMockJobsRepository();
const mockSentimentDataRepository = createMockSentimentDataRepository();
const mockRabbitmqService = createMockRabbitmqService();
const mockDatabaseService = createMockDatabaseService();
const mockBlueskyClientService = createMockBlueskyClientService();
const mockJetstreamManager = createMockJetstreamManagerService();

describe('IngestionController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [IngestionController, HealthController],
      providers: [
        IngestionService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: RabbitmqService,
          useValue: mockRabbitmqService,
        },
        {
          provide: JobsRepository,
          useValue: mockJobsRepository,
        },
        {
          provide: SentimentDataRepository,
          useValue: mockSentimentDataRepository,
        },
        {
          provide: BlueskyClientService,
          useValue: mockBlueskyClientService,
        },
        {
          provide: JetstreamManagerService,
          useValue: mockJetstreamManager,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer() as App)
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('service', 'ingestion');
      });
  });
});

describe('IngestionService E2E', () => {
  let service: IngestionService;
  let app: INestApplication;
  let mockRmqService: ReturnType<typeof createMockRabbitmqService>;
  let mockJetstream: ReturnType<typeof createMockJetstreamManagerService>;
  let mockJobsRepo: ReturnType<typeof createMockJobsRepository>;

  beforeEach(async () => {
    mockRmqService = createMockRabbitmqService();
    mockJetstream = createMockJetstreamManagerService();
    mockJobsRepo = createMockJobsRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        IngestionService,
        { provide: RabbitmqService, useValue: mockRmqService },
        { provide: JetstreamManagerService, useValue: mockJetstream },
        { provide: JobsRepository, useValue: mockJobsRepo },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    service = moduleFixture.get<IngestionService>(IngestionService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('processJob', () => {
    it('should register job with Jetstream manager with correct configuration', async () => {
      const testMessage = {
        jobId: 'test-job-123',
        prompt: 'test search query',
        timestamp: new Date(),
      };

      // Mock findById to return a job so processing continues
      mockJobsRepo.findById.mockReturnValue({
        id: 'test-job-123',
        prompt: 'test search query',
        status: JobStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      });

      // Mock the registerJob to immediately complete
      mockJetstream.registerJob.mockImplementation(
        (config: JetstreamJobConfig) => {
          config.onComplete(0);
          return Promise.resolve();
        },
      );

      await service.processJob(testMessage, 'test-correlation-id');

      expect(mockJetstream.registerJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'test-job-123',
          prompt: 'test search query',
          correlationId: 'test-correlation-id',
        }),
      );
    });

    it('should emit raw data messages to RabbitMQ for analysis', async () => {
      const testMessage = {
        jobId: 'test-job-456',
        prompt: 'sentiment test',
        timestamp: new Date(),
      };

      const mockRawData: RawDataMessage = {
        jobId: 'test-job-456',
        textContent: 'This product is amazing!',
        source: 'bluesky',
        sourceUrl: 'https://bsky.app/post/123',
        authorName: 'testuser',
        publishedAt: new Date(),
        collectedAt: new Date(),
      };

      // Mock findById to return a job so processing continues
      mockJobsRepo.findById.mockReturnValue({
        id: 'test-job-456',
        prompt: 'sentiment test',
        status: JobStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      });

      // Simulate Jetstream emitting data and then completing
      mockJetstream.registerJob.mockImplementation(
        async (config: JetstreamJobConfig) => {
          await config.onData(mockRawData);
          config.onComplete(1);
        },
      );

      await service.processJob(testMessage, 'test-correlation-id');

      // Verify raw data was emitted to RabbitMQ for analysis service
      expect(mockRmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_RAW_DATA,
        mockRawData,
      );
    });

    it('should emit multiple raw data messages for batch processing', async () => {
      const testMessage = {
        jobId: 'test-job-789',
        prompt: 'batch test',
        timestamp: new Date(),
      };

      const mockDataBatch: RawDataMessage[] = [
        {
          jobId: 'test-job-789',
          textContent: 'First post - positive sentiment',
          source: 'bluesky',
          publishedAt: new Date(),
          collectedAt: new Date(),
        },
        {
          jobId: 'test-job-789',
          textContent: 'Second post - negative sentiment',
          source: 'bluesky',
          publishedAt: new Date(),
          collectedAt: new Date(),
        },
        {
          jobId: 'test-job-789',
          textContent: 'Third post - neutral sentiment',
          source: 'bluesky',
          publishedAt: new Date(),
          collectedAt: new Date(),
        },
      ];

      // Mock findById to return a job so processing continues
      mockJobsRepo.findById.mockReturnValue({
        id: 'test-job-789',
        prompt: 'batch test',
        status: JobStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      });

      // Simulate Jetstream emitting multiple data items
      mockJetstream.registerJob.mockImplementation(
        async (config: JetstreamJobConfig) => {
          for (const data of mockDataBatch) {
            await config.onData(data);
          }
          config.onComplete(mockDataBatch.length);
        },
      );

      await service.processJob(testMessage, 'test-correlation-id');

      // Verify all raw data was emitted to RabbitMQ
      // 1 JOB_INITIAL_BATCH_COMPLETE + 3 raw data + 1 ingestion complete = 5
      expect(mockRmqService.emit).toHaveBeenCalledTimes(5);

      // Check raw data emissions
      mockDataBatch.forEach((data) => {
        expect(mockRmqService.emit).toHaveBeenCalledWith(
          MESSAGE_PATTERNS.JOB_RAW_DATA,
          data,
        );
      });

      // Verify JOB_INGESTION_COMPLETE was emitted
      expect(mockRmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_INGESTION_COMPLETE,
        expect.objectContaining({
          jobId: 'test-job-789',
          totalItems: 3,
        }),
      );
    });

    it('should use custom job options when provided', async () => {
      const testMessage = {
        jobId: 'test-job-custom',
        prompt: 'custom job test',
        timestamp: new Date(),
        options: {
          job: {
            maxDurationMs: 300000,
          },
        },
      };

      // Mock findById to return a job so processing continues
      mockJobsRepo.findById.mockReturnValue({
        id: 'test-job-custom',
        prompt: 'custom job test',
        status: JobStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      });

      mockJetstream.registerJob.mockImplementation(
        (config: JetstreamJobConfig) => {
          config.onComplete(0);
          return Promise.resolve();
        },
      );

      await service.processJob(testMessage, 'test-correlation-id');

      expect(mockJetstream.registerJob).toHaveBeenCalledWith(
        expect.objectContaining({
          maxDurationMs: 300000,
        }),
      );
    });
  });

  describe('isJobActive', () => {
    it('should return true when job is registered with Jetstream', () => {
      mockJetstream.isJobRegistered.mockReturnValue(true);

      expect(service.isJobActive('test-job-123')).toBe(true);
      expect(mockJetstream.isJobRegistered).toHaveBeenCalledWith(
        'test-job-123',
      );
    });

    it('should return false when job is not registered with Jetstream', () => {
      mockJetstream.isJobRegistered.mockReturnValue(false);

      expect(service.isJobActive('test-job-123')).toBe(false);
      expect(mockJetstream.isJobRegistered).toHaveBeenCalledWith(
        'test-job-123',
      );
    });
  });

  describe('getActiveJobCount', () => {
    it('should return the count of active jobs from Jetstream', () => {
      mockJetstream.getStatus.mockReturnValue({
        enabled: true,
        isListening: true,
        connectionStatus: 'connected',
        activeJobCount: 3,
        metrics: {},
      });

      expect(service.getActiveJobCount()).toBe(3);
      expect(mockJetstream.getStatus).toHaveBeenCalled();
    });
  });
});
