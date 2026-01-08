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
  createMockPollingScraperService,
} from '@app/testing';
import { IngestionController } from '@app/ingestion/ingestion.controller';
import { IngestionService } from '@app/ingestion/ingestion.service';
import { HealthController } from '@app/ingestion/health/health.controller';
import { PollingScraperService } from '@app/ingestion/scrapers/polling-scraper.service';
import { MESSAGE_PATTERNS, RawDataMessage } from '@app/shared-types';

// Create mocks using shared utilities
const mockJobsRepository = createMockJobsRepository();
const mockSentimentDataRepository = createMockSentimentDataRepository();
const mockRabbitmqService = createMockRabbitmqService();
const mockDatabaseService = createMockDatabaseService();
const mockBlueskyClientService = createMockBlueskyClientService();
const mockPollingScraperService = createMockPollingScraperService();

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
          provide: PollingScraperService,
          useValue: mockPollingScraperService,
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
  let mockPollingScraper: ReturnType<typeof createMockPollingScraperService>;

  beforeEach(async () => {
    mockRmqService = createMockRabbitmqService();
    mockPollingScraper = createMockPollingScraperService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        IngestionService,
        { provide: RabbitmqService, useValue: mockRmqService },
        { provide: PollingScraperService, useValue: mockPollingScraper },
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
    it('should start polling scraper with correct configuration', async () => {
      const testMessage = {
        jobId: 'test-job-123',
        prompt: 'test search query',
        timestamp: new Date(),
      };

      // Mock the startPollingJob to immediately complete
      mockPollingScraper.startPollingJob.mockImplementation(
        (config: { jobId: string; prompt: string; onComplete: () => void }) => {
          config.onComplete();
          return Promise.resolve();
        },
      );

      await service.processJob(testMessage, 'test-correlation-id');

      expect(mockPollingScraper.startPollingJob).toHaveBeenCalledWith(
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

      // Simulate scraper emitting data and then completing
      mockPollingScraper.startPollingJob.mockImplementation(
        async (config: {
          onData: (data: RawDataMessage) => Promise<void>;
          onComplete: () => void;
        }) => {
          await config.onData(mockRawData);
          config.onComplete();
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

      // Simulate scraper emitting multiple data items
      mockPollingScraper.startPollingJob.mockImplementation(
        async (config: {
          onData: (data: RawDataMessage) => Promise<void>;
          onComplete: () => void;
        }) => {
          for (const data of mockDataBatch) {
            await config.onData(data);
          }
          config.onComplete();
        },
      );

      await service.processJob(testMessage, 'test-correlation-id');

      // Verify all raw data was emitted to RabbitMQ (3 raw data + 1 ingestion complete)
      expect(mockRmqService.emit).toHaveBeenCalledTimes(4);
      mockDataBatch.forEach((data, index) => {
        expect(mockRmqService.emit).toHaveBeenNthCalledWith(
          index + 1,
          MESSAGE_PATTERNS.JOB_RAW_DATA,
          data,
        );
      });

      // Verify JOB_INGESTION_COMPLETE was emitted
      expect(mockRmqService.emit).toHaveBeenNthCalledWith(
        4,
        MESSAGE_PATTERNS.JOB_INGESTION_COMPLETE,
        expect.objectContaining({
          jobId: 'test-job-789',
          totalItems: 3,
        }),
      );
    });

    it('should use custom polling options when provided', async () => {
      const testMessage = {
        jobId: 'test-job-custom',
        prompt: 'custom polling test',
        timestamp: new Date(),
        options: {
          polling: {
            pollIntervalMs: 10000,
            maxDurationMs: 300000,
          },
        },
      };

      mockPollingScraper.startPollingJob.mockImplementation(
        (config: { onComplete: () => void }) => {
          config.onComplete();
          return Promise.resolve();
        },
      );

      await service.processJob(testMessage, 'test-correlation-id');

      expect(mockPollingScraper.startPollingJob).toHaveBeenCalledWith(
        expect.objectContaining({
          pollIntervalMs: 10000,
          maxDurationMs: 300000,
        }),
      );
    });
  });

  describe('stopJob', () => {
    it('should stop an active polling job', async () => {
      await service.stopJob('test-job-to-stop');

      expect(mockPollingScraper.stopPollingJob).toHaveBeenCalledWith(
        'test-job-to-stop',
      );
    });
  });
});
