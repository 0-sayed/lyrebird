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
