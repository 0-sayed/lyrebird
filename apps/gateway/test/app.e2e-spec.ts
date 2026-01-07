import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import request from 'supertest';
import { App } from 'supertest/types';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { JobStatus } from '@app/shared-types';
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
  MockJobStore,
} from '@app/testing';
import { GatewayController } from '@app/gateway/gateway.controller';
import { GatewayService } from '@app/gateway/gateway.service';
import { JobEventsController } from '@app/gateway/controllers/job-events.controller';
import { JobSseController } from '@app/gateway/controllers/job-sse.controller';
import { JobEventsService } from '@app/gateway/services/job-events.service';
import { HealthModule } from '@app/gateway/health/health.module';
import { HttpExceptionFilter } from '@app/gateway/filters/http-exception.filter';
import { CorrelationIdInterceptor } from '@app/gateway/interceptors/correlation-id.interceptor';

// Shared job store for stateful tests
const jobStore = new MockJobStore();

// Create mocks using shared utilities
const mockJobsRepository = createMockJobsRepository(jobStore);
const mockSentimentDataRepository = createMockSentimentDataRepository();
const mockRabbitmqService = createMockRabbitmqService();
const mockDatabaseService = createMockDatabaseService();

describe('Gateway API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Initialize mocks and job store once before the test suite
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: '.',
          ignoreErrors: false,
        }),
        HealthModule,
      ],
      controllers: [GatewayController, JobEventsController, JobSseController],
      providers: [
        GatewayService,
        JobEventsService,
        {
          provide: APP_FILTER,
          useClass: HttpExceptionFilter,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: CorrelationIdInterceptor,
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
          provide: RabbitmqService,
          useValue: mockRabbitmqService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same pipes as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  beforeEach(() => {
    // Reset job store between tests
    jobStore.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/jobs', () => {
    it('should create a new job', async () => {
      const response = await request(app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ prompt: 'Test sentiment analysis' })
        .expect(201);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status', JobStatus.PENDING);
      expect(response.body).toHaveProperty('prompt');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should reject empty prompt', async () => {
      await request(app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ prompt: '' })
        .expect(400);
    });

    it('should reject missing prompt field', async () => {
      await request(app.getHttpServer() as App)
        .post('/api/jobs')
        .send({})
        .expect(400);
    });

    it('should reject non-string prompt', async () => {
      await request(app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ prompt: 123 })
        .expect(400);
    });
  });

  describe('GET /api/jobs', () => {
    it('should return list of jobs', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/api/jobs')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should return job by id', async () => {
      // First create a job
      const createResponse = await request(app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ prompt: 'Test job for retrieval' })
        .expect(201);

      const jobId = (createResponse.body as { jobId: string }).jobId;

      // Then retrieve it
      const getResponse = await request(app.getHttpServer() as App)
        .get(`/api/jobs/${jobId}`)
        .expect(200);

      const job = getResponse.body as { jobId: string; prompt: string };
      expect(job.jobId).toBe(jobId);
      expect(job.prompt).toBe('Test job for retrieval');
    });

    it('should return 404 for non-existent job', async () => {
      await request(app.getHttpServer() as App)
        .get('/api/jobs/00000000-0000-0000-0000-000000000999')
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer() as App)
        .get('/api/jobs/invalid-uuid')
        .expect(400);
    });
  });

  describe('GET /api/jobs/:id/results', () => {
    it('should return job with results', async () => {
      // First create a job
      const createResponse = await request(app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ prompt: 'Test job for results' })
        .expect(201);

      const jobId = (createResponse.body as { jobId: string }).jobId;

      // Then get results
      const resultsResponse = await request(app.getHttpServer() as App)
        .get(`/api/jobs/${jobId}/results`)
        .expect(200);

      interface ResultsResponse {
        job: unknown;
        results: {
          averageSentiment: unknown;
          totalDataPoints: unknown;
          distribution: unknown;
          data: unknown;
        };
      }

      const results = resultsResponse.body as ResultsResponse;
      expect(results).toHaveProperty('job');
      expect(results).toHaveProperty('results');
      expect(results.results).toHaveProperty('averageSentiment');
      expect(results.results).toHaveProperty('totalDataPoints');
      expect(results.results).toHaveProperty('distribution');
      expect(results.results).toHaveProperty('data');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
});
