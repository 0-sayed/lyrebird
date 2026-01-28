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

// Mock ConfigService for local ONNX tests
const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'ML_MODEL_CACHE_DIR') return './.models-cache-test';
    if (key === 'ML_QUANTIZATION') return 'q8';
    return undefined;
  }),
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
        expect(res.body.checks.bert).toHaveProperty('provider', 'local-onnx');
      });
  });
});

describe('BertSentimentService E2E (mocked)', () => {
  let service: BertSentimentService;
  let moduleFixture: TestingModule;

  beforeEach(async () => {
    // Use mock service from @app/testing for E2E tests
    // Real ONNX model tests are in bert-sentiment-integration.spec.ts
    moduleFixture = await Test.createTestingModule({
      providers: [
        {
          provide: BertSentimentService,
          useValue: createMockBertSentimentService(),
        },
      ],
    }).compile();

    service = moduleFixture.get<BertSentimentService>(BertSentimentService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  describe('mock service behavior', () => {
    it('should be ready immediately', () => {
      expect(service.isReady()).toBe(true);
    });

    it('should report local-onnx provider in status', () => {
      const status = service.getStatus();
      expect(status.provider).toBe('local-onnx');
      expect(status.modelLoaded).toBe(true);
    });

    it('should analyze text using mock', async () => {
      const result = await service.analyze('Test text');

      expect(result.source).toBe('local-onnx');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('confidence');
    });
  });
});
