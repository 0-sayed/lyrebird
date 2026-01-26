/**
 * MSW API handlers for testing
 *
 * These handlers mock the Lyrebird gateway API endpoints.
 */
import { http, HttpResponse, delay } from 'msw';

import { JobStatus, SentimentLabel } from '@/types/api';

// =============================================================================
// Mock Data Factories
// =============================================================================

/**
 * Creates a mock job response
 */
export function createMockJob(
  overrides: Partial<MockJobData> = {},
): MockJobData {
  const id = overrides.jobId ?? crypto.randomUUID();
  return {
    jobId: id,
    status: JobStatus.PENDING,
    prompt: 'test prompt',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock sentiment data item
 */
export function createMockSentimentItem(
  overrides: Partial<MockSentimentItem> = {},
): MockSentimentItem {
  return {
    id: crypto.randomUUID(),
    textContent: 'Test post content',
    source: 'bluesky',
    sourceUrl: 'https://bsky.app/profile/test/post/123',
    authorName: 'testuser.bsky.social',
    sentimentScore: 0.5,
    sentimentLabel: SentimentLabel.POSITIVE,
    analyzedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates mock job results response (backend format before transformation)
 */
export function createMockJobResults(
  jobId: string,
  itemCount = 5,
  overrides: Partial<{
    averageSentiment: number | null;
    distribution: { label: string; count: number }[];
    data: MockSentimentItem[];
  }> = {},
): MockJobResultsResponse {
  const data =
    overrides.data ??
    Array.from({ length: itemCount }, (_, i) =>
      createMockSentimentItem({
        id: `item-${i}`,
        sentimentScore: (i % 3) - 1, // -1, 0, 1 pattern
        sentimentLabel:
          i % 3 === 0
            ? SentimentLabel.NEGATIVE
            : i % 3 === 1
              ? SentimentLabel.NEUTRAL
              : SentimentLabel.POSITIVE,
      }),
    );

  return {
    job: createMockJob({ jobId, status: JobStatus.COMPLETED }),
    results: {
      averageSentiment: overrides.averageSentiment ?? 0.5,
      totalDataPoints: data.length,
      distribution: overrides.distribution ?? [
        { label: 'positive', count: 2 },
        { label: 'neutral', count: 2 },
        { label: 'negative', count: 1 },
      ],
      data,
    },
  };
}

// =============================================================================
// Types
// =============================================================================

export interface MockJobData {
  jobId: string;
  status: JobStatus;
  prompt: string;
  createdAt: string;
  averageSentiment?: number;
  dataPointsCount?: number;
  completedAt?: string;
}

export interface MockSentimentItem {
  id: string;
  textContent: string;
  source: string;
  sourceUrl?: string;
  authorName?: string;
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  analyzedAt?: string;
  publishedAt?: string;
}

export interface MockJobResultsResponse {
  job: MockJobData;
  results: {
    averageSentiment: number | null;
    totalDataPoints: number;
    distribution: { label: string; count: number }[];
    data: MockSentimentItem[];
  };
}

// =============================================================================
// In-memory mock data store
// =============================================================================

const mockJobs = new Map<string, MockJobData>();
const mockResults = new Map<string, MockJobResultsResponse>();

/**
 * Reset mock data store between tests
 */
export function resetMockData() {
  mockJobs.clear();
  mockResults.clear();
}

/**
 * Seed mock data for a specific job
 */
export function seedMockJob(
  job: MockJobData,
  results?: MockJobResultsResponse,
) {
  mockJobs.set(job.jobId, job);
  if (results) {
    mockResults.set(job.jobId, results);
  }
}

// =============================================================================
// API Handlers
// =============================================================================

export const handlers = [
  // POST /api/jobs - Create a new job
  http.post('/api/jobs', async ({ request }) => {
    const body = (await request.json()) as { prompt: string };
    const job = createMockJob({
      prompt: body.prompt,
      status: JobStatus.PENDING,
    });
    mockJobs.set(job.jobId, job);
    return HttpResponse.json(job);
  }),

  // GET /api/jobs - List all jobs
  http.get('/api/jobs', async () => {
    await delay(10); // Simulate network latency
    const jobs = Array.from(mockJobs.values());
    return HttpResponse.json(jobs);
  }),

  // GET /api/jobs/:id - Get job by ID
  http.get('/api/jobs/:id', async ({ params }) => {
    await delay(10);
    const job = mockJobs.get(params.id as string);
    if (!job) {
      return HttpResponse.json(
        { message: 'Job not found', code: 'JOB_NOT_FOUND' },
        { status: 404 },
      );
    }
    return HttpResponse.json(job);
  }),

  // GET /api/jobs/:id/results - Get job results
  http.get('/api/jobs/:id/results', async ({ params }) => {
    await delay(10);
    const results = mockResults.get(params.id as string);
    if (!results) {
      // Return empty results if no seeded data
      const job = mockJobs.get(params.id as string);
      if (!job) {
        return HttpResponse.json(
          { message: 'Job not found', code: 'JOB_NOT_FOUND' },
          { status: 404 },
        );
      }
      return HttpResponse.json(createMockJobResults(params.id as string, 0));
    }
    return HttpResponse.json(results);
  }),

  // POST /api/jobs/:id/cancel - Cancel a job
  http.post('/api/jobs/:id/cancel', ({ params }) => {
    const job = mockJobs.get(params.id as string);
    if (!job) {
      return HttpResponse.json(
        { message: 'Job not found', code: 'JOB_NOT_FOUND' },
        { status: 404 },
      );
    }
    job.status = JobStatus.FAILED;
    return HttpResponse.json({ success: true });
  }),

  // DELETE /api/jobs/:id - Delete a job
  http.delete('/api/jobs/:id', ({ params }) => {
    const deleted = mockJobs.delete(params.id as string);
    mockResults.delete(params.id as string);
    if (!deleted) {
      return HttpResponse.json(
        { message: 'Job not found', code: 'JOB_NOT_FOUND' },
        { status: 404 },
      );
    }
    return HttpResponse.json({ success: true });
  }),
];
