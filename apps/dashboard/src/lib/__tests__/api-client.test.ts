/**
 * Tests for api-client
 *
 * Tests cover the fetchAPI wrapper, Zod schema validation/transformation,
 * and individual API methods.
 */
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { api, APIError, schemas } from '../api-client';
import { server } from '@/__tests__/mocks/server';
import {
  seedMockJob,
  createMockJob,
  createMockJobResults,
} from '@/__tests__/mocks/api-handlers';
import { JobStatus, SentimentLabel } from '@/types/api';

// =============================================================================
// fetchAPI Core Tests
// =============================================================================

// Helper to generate valid test UUIDs
const testUuid1 = '550e8400-e29b-41d4-a716-446655440001';
const testUuid2 = '550e8400-e29b-41d4-a716-446655440002';
const testUuid3 = '550e8400-e29b-41d4-a716-446655440003';
const testUuid4 = '550e8400-e29b-41d4-a716-446655440004';
const testUuid5 = '550e8400-e29b-41d4-a716-446655440005';
const testUuid6 = '550e8400-e29b-41d4-a716-446655440006';

describe('fetchAPI', () => {
  describe('successful requests', () => {
    it('returns data on successful request', async () => {
      const mockJob = createMockJob({ jobId: testUuid1, prompt: 'test query' });
      seedMockJob(mockJob);

      const result = await api.getJob(testUuid1);

      expect(result.jobId).toBe(testUuid1);
      expect(result.prompt).toBe('test query');
    });

    it('includes Content-Type header', async () => {
      let capturedHeaders: Headers | undefined;

      server.use(
        http.post('/api/jobs', async ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json(createMockJob());
        }),
      );

      await api.createJob('test prompt');

      expect(capturedHeaders?.get('Content-Type')).toBe('application/json');
    });
  });

  describe('error handling', () => {
    it('throws APIError on non-ok response', async () => {
      server.use(
        http.get('/api/jobs/:id', () => {
          return HttpResponse.json(
            { message: 'Job not found', code: 'NOT_FOUND' },
            { status: 404 },
          );
        }),
      );

      await expect(api.getJob('nonexistent')).rejects.toThrow(APIError);

      try {
        await api.getJob('nonexistent');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect((error as APIError).statusCode).toBe(404);
        expect((error as APIError).code).toBe('NOT_FOUND');
        expect((error as APIError).message).toBe('Job not found');
      }
    });

    it('handles error response without JSON body', async () => {
      server.use(
        http.get('/api/jobs/:id', () => {
          return new HttpResponse('Internal Server Error', { status: 500 });
        }),
      );

      try {
        await api.getJob('test');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect((error as APIError).statusCode).toBe(500);
        expect((error as APIError).message).toContain('500');
      }
    });
  });

  describe('validation behavior', () => {
    it('throws APIError with VALIDATION_ERROR code in development mode', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Return data that doesn't match the schema (missing required fields)
      server.use(
        http.get('/api/jobs/:id', () => {
          return HttpResponse.json({
            jobId: 'test-123',
            // Missing: status, prompt, createdAt
          });
        }),
      );

      await expect(api.getJob('test-123')).rejects.toThrow(APIError);

      try {
        await api.getJob('test-123');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect((error as APIError).statusCode).toBe(500);
        expect((error as APIError).code).toBe('VALIDATION_ERROR');
        expect((error as APIError).message).toContain('Validation failed');
      }

      // Should have logged structured error with endpoint
      expect(consoleSpy).toHaveBeenCalledWith(
        'API response validation failed:',
        expect.objectContaining({
          endpoint: expect.stringContaining('/jobs/'),
          error: expect.anything(),
        }),
      );

      consoleSpy.mockRestore();
    });
  });
});

// =============================================================================
// Zod Schema Tests
// =============================================================================

describe('Zod Schemas', () => {
  // Use valid UUIDs for schema tests
  const testJobId = '550e8400-e29b-41d4-a716-446655440000';
  const testJobId2 = '550e8400-e29b-41d4-a716-446655440001';

  describe('JobResultsResponseSchema', () => {
    it('transforms distribution array to object', () => {
      const backendResponse = {
        job: {
          jobId: testJobId,
          status: JobStatus.COMPLETED,
          prompt: 'test',
          createdAt: new Date().toISOString(),
        },
        results: {
          averageSentiment: 0.5,
          totalDataPoints: 10,
          distribution: [
            { label: 'positive', count: 5 },
            { label: 'neutral', count: 3 },
            { label: 'negative', count: 2 },
          ],
          data: [],
        },
      };

      const result = schemas.JobResultsResponseSchema.parse(backendResponse);

      expect(result.sentimentDistribution).toEqual({
        positive: 5,
        neutral: 3,
        negative: 2,
      });
    });

    it('handles missing distribution labels', () => {
      const backendResponse = {
        job: {
          jobId: testJobId,
          status: JobStatus.COMPLETED,
          prompt: 'test',
          createdAt: new Date().toISOString(),
        },
        results: {
          averageSentiment: 0.5,
          totalDataPoints: 3,
          distribution: [{ label: 'positive', count: 3 }],
          data: [],
        },
      };

      const result = schemas.JobResultsResponseSchema.parse(backendResponse);

      expect(result.sentimentDistribution).toEqual({
        positive: 3,
        neutral: 0,
        negative: 0,
      });
    });

    it('adds publishedAt fallback from analyzedAt when missing', () => {
      const analyzedAt = new Date().toISOString();
      const backendResponse = {
        job: {
          jobId: testJobId,
          status: JobStatus.COMPLETED,
          prompt: 'test',
          createdAt: new Date().toISOString(),
        },
        results: {
          averageSentiment: 0.5,
          totalDataPoints: 1,
          distribution: [],
          data: [
            {
              id: 'item-1',
              textContent: 'Test content',
              source: 'bluesky',
              sentimentScore: 0.5,
              sentimentLabel: SentimentLabel.POSITIVE,
              analyzedAt,
              // publishedAt is missing
            },
          ],
        },
      };

      const result = schemas.JobResultsResponseSchema.parse(backendResponse);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.publishedAt).toBe(analyzedAt);
    });

    it('preserves publishedAt when present', () => {
      const publishedAt = '2024-01-01T12:00:00Z';
      const analyzedAt = '2024-01-01T12:30:00Z';
      const backendResponse = {
        job: {
          jobId: testJobId,
          status: JobStatus.COMPLETED,
          prompt: 'test',
          createdAt: new Date().toISOString(),
        },
        results: {
          averageSentiment: 0.5,
          totalDataPoints: 1,
          distribution: [],
          data: [
            {
              id: 'item-1',
              textContent: 'Test content',
              source: 'bluesky',
              sentimentScore: 0.5,
              sentimentLabel: SentimentLabel.POSITIVE,
              analyzedAt,
              publishedAt,
            },
          ],
        },
      };

      const result = schemas.JobResultsResponseSchema.parse(backendResponse);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.publishedAt).toBe(publishedAt);
    });
  });

  describe('JobsListResponseSchema', () => {
    it('transforms array to paginated response', () => {
      const jobs = [
        {
          jobId: testJobId,
          status: JobStatus.PENDING,
          prompt: 'test 1',
          createdAt: new Date().toISOString(),
        },
        {
          jobId: testJobId2,
          status: JobStatus.COMPLETED,
          prompt: 'test 2',
          createdAt: new Date().toISOString(),
        },
      ];

      const result = schemas.JobsListResponseSchema.parse(jobs);

      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
    });
  });
});

// =============================================================================
// API Methods Tests
// =============================================================================

describe('API Methods', () => {
  describe('createJob', () => {
    it('sends POST with prompt', async () => {
      let capturedBody: { prompt?: string } = {};

      server.use(
        http.post('/api/jobs', async ({ request }) => {
          capturedBody = (await request.json()) as { prompt: string };
          return HttpResponse.json(createMockJob({ prompt: capturedBody.prompt }));
        }),
      );

      const result = await api.createJob('analyze crypto sentiment');

      expect(capturedBody.prompt).toBe('analyze crypto sentiment');
      expect(result.prompt).toBe('analyze crypto sentiment');
    });
  });

  describe('getJob', () => {
    it('fetches correct endpoint', async () => {
      const mockJob = createMockJob({ jobId: testUuid2 });
      seedMockJob(mockJob);

      const result = await api.getJob(testUuid2);

      expect(result.jobId).toBe(testUuid2);
    });
  });

  describe('getJobResults', () => {
    it('transforms results correctly', async () => {
      const mockJob = createMockJob({ jobId: testUuid3, status: JobStatus.COMPLETED });
      const mockResults = createMockJobResults(testUuid3, 5);
      seedMockJob(mockJob, mockResults);

      const result = await api.getJobResults(testUuid3);

      expect(result).toHaveProperty('sentimentDistribution');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('totalItems');
      expect(result.sentimentDistribution).toHaveProperty('positive');
      expect(result.sentimentDistribution).toHaveProperty('neutral');
      expect(result.sentimentDistribution).toHaveProperty('negative');
    });
  });

  describe('listJobs', () => {
    beforeEach(() => {
      // Seed some jobs
      seedMockJob(createMockJob({ jobId: testUuid4 }));
      seedMockJob(createMockJob({ jobId: testUuid5 }));
    });

    it('handles pagination params', async () => {
      let capturedUrl = '';

      server.use(
        http.get('/api/jobs', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json([]);
        }),
      );

      await api.listJobs({ page: 2, limit: 10 });

      expect(capturedUrl).toContain('page=2');
      expect(capturedUrl).toContain('limit=10');
    });

    it('works without pagination params', async () => {
      const result = await api.listJobs();

      expect(result.jobs).toBeInstanceOf(Array);
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
    });
  });

  describe('cancelJob', () => {
    it('sends POST to cancel endpoint', async () => {
      const mockJob = createMockJob({ jobId: testUuid6, status: JobStatus.IN_PROGRESS });
      seedMockJob(mockJob);

      const result = await api.cancelJob(testUuid6);

      expect(result.success).toBe(true);
    });
  });

  describe('deleteJob', () => {
    it('sends DELETE request', async () => {
      const deleteUuid = '550e8400-e29b-41d4-a716-446655440007';
      const mockJob = createMockJob({ jobId: deleteUuid });
      seedMockJob(mockJob);

      const result = await api.deleteJob(deleteUuid);

      expect(result.success).toBe(true);
    });
  });
});
