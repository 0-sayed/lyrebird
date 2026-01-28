import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { App } from 'supertest/types';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { JobStatus, SentimentLabel } from '@app/shared-types';
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
import { JOB_EVENTS } from '@app/gateway/events/job.events';
import { waitFor } from '../../../test/fixtures/sentiment-fixtures';

// Shared job store for stateful tests
const jobStore = new MockJobStore();

// Create mocks using shared utilities
const mockJobsRepository = createMockJobsRepository(jobStore);
const mockSentimentDataRepository = createMockSentimentDataRepository();
const mockRabbitmqService = createMockRabbitmqService();
const mockDatabaseService = createMockDatabaseService();

/**
 * Helper to create a job and return its ID
 */
async function createJob(
  server: App,
  prompt: string,
): Promise<{ jobId: string; status: JobStatus }> {
  const response = await request(server)
    .post('/api/jobs')
    .send({ prompt })
    .expect(201);

  return response.body as { jobId: string; status: JobStatus };
}

/**
 * Helper to update job status in the mock store
 */
function updateJobStatus(jobId: string, status: JobStatus): void {
  const job = jobStore.get(jobId);
  if (job) {
    job.status = status;
  }
}

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

  describe('DELETE /api/jobs/:id', () => {
    it('should delete an existing job', async () => {
      const server = app.getHttpServer() as App;

      // Create a job
      const { jobId } = await createJob(server, 'Job to delete');

      // Delete it (API returns 200 with success response)
      const deleteResponse = await request(server)
        .delete(`/api/jobs/${jobId}`)
        .expect(200);

      expect(deleteResponse.body).toMatchObject({ success: true });

      // Verify it no longer exists
      await request(server).get(`/api/jobs/${jobId}`).expect(404);
    });

    it('should return 404 when deleting non-existent job', async () => {
      await request(app.getHttpServer() as App)
        .delete('/api/jobs/00000000-0000-0000-0000-000000000999')
        .expect(404);
    });
  });

  describe('Job Lifecycle Workflow', () => {
    it('should support create -> poll -> complete workflow', async () => {
      const server = app.getHttpServer() as App;

      // Step 1: Create job
      const createResponse = await request(server)
        .post('/api/jobs')
        .send({ prompt: 'Analyze sentiment for TypeScript' })
        .expect(201);

      const { jobId } = createResponse.body as { jobId: string };
      expect(createResponse.body).toMatchObject({
        status: JobStatus.PENDING,
        prompt: 'Analyze sentiment for TypeScript',
      });

      // Step 2: Poll - job should still be pending
      const pollResponse1 = await request(server)
        .get(`/api/jobs/${jobId}`)
        .expect(200);
      expect(pollResponse1.body).toHaveProperty('status', JobStatus.PENDING);

      // Step 3: Simulate job transitioning to in_progress
      updateJobStatus(jobId, JobStatus.IN_PROGRESS);

      const pollResponse2 = await request(server)
        .get(`/api/jobs/${jobId}`)
        .expect(200);
      expect(pollResponse2.body).toHaveProperty(
        'status',
        JobStatus.IN_PROGRESS,
      );

      // Step 4: Simulate job completion
      updateJobStatus(jobId, JobStatus.COMPLETED);

      const pollResponse3 = await request(server)
        .get(`/api/jobs/${jobId}`)
        .expect(200);
      expect(pollResponse3.body).toHaveProperty('status', JobStatus.COMPLETED);

      // Step 5: Verify results are available
      const resultsResponse = await request(server)
        .get(`/api/jobs/${jobId}/results`)
        .expect(200);
      expect(resultsResponse.body).toHaveProperty('job');
      expect(resultsResponse.body).toHaveProperty('results');
    });

    it('should handle job failure workflow', async () => {
      const server = app.getHttpServer() as App;

      // Create job
      const { jobId } = await createJob(server, 'Job that will fail');

      // Simulate failure
      updateJobStatus(jobId, JobStatus.FAILED);

      // Poll should show failed status
      const pollResponse = await request(server)
        .get(`/api/jobs/${jobId}`)
        .expect(200);

      expect(pollResponse.body).toHaveProperty('status', JobStatus.FAILED);
    });
  });

  describe('Concurrent Job Creation', () => {
    it('should create multiple jobs sequentially with unique IDs', async () => {
      const server = app.getHttpServer() as App;
      const prompts = [
        'Analyze TypeScript trends',
        'Analyze JavaScript trends',
        'Analyze Rust trends',
      ];

      // Create jobs sequentially to avoid connection issues
      const jobIds: string[] = [];
      for (const prompt of prompts) {
        const response = await request(server)
          .post('/api/jobs')
          .send({ prompt })
          .expect(201);
        jobIds.push((response.body as { jobId: string }).jobId);
      }

      // Verify all IDs are unique
      const uniqueIds = new Set(jobIds);
      expect(uniqueIds.size).toBe(prompts.length);

      // Verify all jobs are retrievable with correct prompts
      for (let i = 0; i < jobIds.length; i++) {
        const response = await request(server)
          .get(`/api/jobs/${jobIds[i]}`)
          .expect(200);
        expect(response.body).toHaveProperty('prompt', prompts[i]);
      }

      // Verify list returns all jobs
      const listResponse = await request(server).get('/api/jobs').expect(200);
      const listedIds = (listResponse.body as Array<{ jobId: string }>).map(
        (j) => j.jobId,
      );
      jobIds.forEach((id) => {
        expect(listedIds).toContain(id);
      });
    });
  });

  describe('EventEmitter Integration', () => {
    let eventEmitter: EventEmitter2;

    beforeEach(() => {
      eventEmitter = app.get(EventEmitter2);
    });

    it('should emit events that can be received by listeners', async () => {
      const server = app.getHttpServer() as App;

      // Create a job
      const { jobId } = await createJob(server, 'Event emission test');
      updateJobStatus(jobId, JobStatus.IN_PROGRESS);

      // Verify the event emitter is wired up by emitting a test event
      let eventReceived = false;
      const listener = () => {
        eventReceived = true;
      };
      eventEmitter.on(`${JOB_EVENTS.DATA_UPDATE}.${jobId}`, listener);

      // Emit a data update event
      eventEmitter.emit(`${JOB_EVENTS.DATA_UPDATE}.${jobId}`, {
        jobId,
        timestamp: new Date(),
        dataPoint: {
          id: 'test-data-point',
          textContent: 'Test content',
          source: 'bluesky',
          sentimentScore: 0.75,
          sentimentLabel: SentimentLabel.POSITIVE,
          publishedAt: new Date(),
        },
        totalProcessed: 1,
      });

      // Wait briefly for event propagation
      await waitFor(() => eventReceived, 1000, 50);
      expect(eventReceived).toBe(true);

      // Cleanup
      eventEmitter.off(`${JOB_EVENTS.DATA_UPDATE}.${jobId}`, listener);
    });

    it('should support wildcard event listeners', async () => {
      const server = app.getHttpServer() as App;

      // Create a job
      const { jobId } = await createJob(server, 'Wildcard event test');
      updateJobStatus(jobId, JobStatus.IN_PROGRESS);

      // Listen for any data update event
      const receivedEvents: string[] = [];
      const wildcardListener = (event: { jobId: string }) => {
        receivedEvents.push(event.jobId);
      };
      eventEmitter.on(`${JOB_EVENTS.DATA_UPDATE}.*`, wildcardListener);

      // Emit event for our job
      eventEmitter.emit(`${JOB_EVENTS.DATA_UPDATE}.${jobId}`, {
        jobId,
        timestamp: new Date(),
        dataPoint: {
          id: 'test-point',
          textContent: 'Wildcard test',
          source: 'bluesky',
          sentimentScore: 0.5,
          sentimentLabel: SentimentLabel.NEUTRAL,
          publishedAt: new Date(),
        },
        totalProcessed: 1,
      });

      await waitFor(() => receivedEvents.length > 0, 1000, 50);
      expect(receivedEvents).toContain(jobId);

      // Cleanup
      eventEmitter.off(`${JOB_EVENTS.DATA_UPDATE}.*`, wildcardListener);
    });
  });

  describe('Input Validation', () => {
    it.each([
      ['array', ['prompt']],
      ['object', { text: 'prompt' }],
      ['null', null],
      ['boolean', true],
    ])(
      'should reject %s type as prompt',
      async (_description, invalidPrompt) => {
        await request(app.getHttpServer() as App)
          .post('/api/jobs')
          .send({ prompt: invalidPrompt })
          .expect(400);
      },
    );

    it('should reject unknown fields in request body', async () => {
      await request(app.getHttpServer() as App)
        .post('/api/jobs')
        .send({ prompt: 'Valid prompt', unknownField: 'value' })
        .expect(400);
    });
  });
});
