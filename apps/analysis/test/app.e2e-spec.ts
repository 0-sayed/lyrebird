import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  DatabaseService,
  JobsRepository,
  SentimentDataRepository,
} from '@app/database';
import { RabbitmqService } from '@app/rabbitmq';
import {
  createMockDatabaseService,
  createMockRabbitmqService,
  createMockJobsRepository,
  createMockSentimentDataRepository,
  createMockBertSentimentService,
} from '@app/testing';
import { AnalysisController } from '@app/analysis/analysis.controller';
import { AnalysisService } from '@app/analysis/analysis.service';
import { HealthController } from '@app/analysis/health/health.controller';
import { BertSentimentService } from '@app/analysis/services/bert-sentiment.service';

// Create mocks using shared utilities
const mockJobsRepository = createMockJobsRepository();
const mockSentimentDataRepository = createMockSentimentDataRepository();
const mockRabbitmqService = createMockRabbitmqService();
const mockDatabaseService = createMockDatabaseService();
const mockBertSentimentService = createMockBertSentimentService();

// Mock ConfigService - returns undefined for HUGGINGFACE_API_KEY to force AFINN mode in tests
// This avoids external API calls during E2E testing
const mockConfigService = {
  get: jest.fn().mockReturnValue(undefined),
};

describe('AnalysisController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [AnalysisController, HealthController],
      providers: [
        AnalysisService,
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
          provide: BertSentimentService,
          useValue: mockBertSentimentService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
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
        expect(res.body).toHaveProperty('service', 'analysis');
      });
  });

  it('/health/live (GET)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'alive');
        expect(res.body).toHaveProperty('service', 'analysis');
      });
  });

  it('/health/ready (GET) - should return ready when dependencies are healthy', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ready');

        expect(res.body).toHaveProperty('checks');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(res.body.checks).toHaveProperty('rabbitmq', 'connected');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(res.body.checks).toHaveProperty('database', 'connected');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(res.body.checks).toHaveProperty('bert');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(res.body.checks.bert).toHaveProperty('ready', true);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(res.body.checks.bert).toHaveProperty('provider', 'afinn');
      });
  });
});

describe('BertSentimentService E2E', () => {
  let service: BertSentimentService;
  let moduleFixture: TestingModule;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(undefined), // No API key = AFINN mode
    };

    moduleFixture = await Test.createTestingModule({
      providers: [
        BertSentimentService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = moduleFixture.get<BertSentimentService>(BertSentimentService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  describe('AFINN mode (no API key)', () => {
    it('should be ready immediately', () => {
      expect(service.isReady()).toBe(true);
    });

    it('should report AFINN provider in status', () => {
      const status = service.getStatus();
      expect(status.provider).toBe('afinn');
      expect(status.huggingfaceConfigured).toBe(false);
    });

    it('should analyze positive text correctly', async () => {
      const result = await service.analyze('I love this amazing product!');

      expect(result.source).toBe('afinn');
      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should analyze negative text correctly', async () => {
      const result = await service.analyze('This is terrible and awful!');

      expect(result.source).toBe('afinn');
      expect(result.label).toBe('negative');
      expect(result.score).toBeLessThan(0.5);
    });

    it('should handle empty text gracefully', async () => {
      const result = await service.analyze('');

      expect(result.source).toBe('afinn');
      expect(result.score).toBeCloseTo(0.5, 1);
    });
  });
});
