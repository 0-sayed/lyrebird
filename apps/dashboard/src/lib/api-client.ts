import { z } from 'zod';

import { API_BASE_URL } from './constants';
import { JobStatus, SentimentLabel } from '@/types/api';

// =============================================================================
// Response Schemas for Runtime Validation
// =============================================================================

const JobResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.nativeEnum(JobStatus),
  prompt: z.string(),
  createdAt: z.string(),
  averageSentiment: z.number().min(-1).max(1).optional(),
  dataPointsCount: z.number().int().nonnegative().optional(),
  completedAt: z.string().optional(),
});

const SentimentDataItemSchema = z.object({
  id: z.string(),
  textContent: z.string(),
  source: z.string(),
  sourceUrl: z.string().optional(),
  authorName: z.string().optional(),
  sentimentScore: z.number().min(-1).max(1),
  sentimentLabel: z.nativeEnum(SentimentLabel),
  // Backend returns 'analyzedAt' instead of 'publishedAt'
  analyzedAt: z.string().optional(),
  publishedAt: z.string().optional(),
});

// Backend returns distribution as array of {label, count}, we transform to {positive, neutral, negative}
const BackendDistributionItemSchema = z.object({
  label: z.string(),
  count: z.number().int().nonnegative(),
});

const SentimentDistributionSchema = z.object({
  positive: z.number().int().nonnegative(),
  neutral: z.number().int().nonnegative(),
  negative: z.number().int().nonnegative(),
});

// Backend returns nested structure, we transform to flat structure expected by frontend
const JobResultsResponseSchema = z
  .object({
    job: JobResponseSchema,
    results: z.object({
      averageSentiment: z.number().min(-1).max(1).nullable(),
      totalDataPoints: z.number().int().nonnegative(),
      distribution: z.array(BackendDistributionItemSchema),
      data: z.array(SentimentDataItemSchema),
    }),
  })
  .transform((response) => {
    // Transform distribution array to object
    const distributionObj = { positive: 0, neutral: 0, negative: 0 };
    for (const item of response.results.distribution) {
      if (item.label === 'positive') distributionObj.positive = item.count;
      else if (item.label === 'neutral') distributionObj.neutral = item.count;
      else if (item.label === 'negative') distributionObj.negative = item.count;
    }

    // Transform data items - use actual publishedAt (original post time)
    // Fall back to analyzedAt only if publishedAt is missing
    const transformedData = response.results.data.map((item) => ({
      ...item,
      publishedAt:
        item.publishedAt || item.analyzedAt || new Date().toISOString(),
    }));

    return {
      job: response.job,
      sentimentDistribution: distributionObj,
      data: transformedData,
      totalItems: response.results.totalDataPoints,
      averageSentiment: response.results.averageSentiment,
    };
  });

// The backend returns an array directly, but we transform it to a paginated response
// for consistency with the frontend's expected types
const JobsListResponseSchema = z.array(JobResponseSchema).transform((jobs) => ({
  jobs,
  total: jobs.length,
  page: 1,
  limit: jobs.length,
}));

// =============================================================================
// Custom Error Classes
// =============================================================================

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// =============================================================================
// Fetch Wrapper with Error Handling
// =============================================================================

interface FetchOptions extends RequestInit {
  schema?: z.ZodType;
}

/**
 * Internal fetch wrapper with error handling and optional validation
 */
async function fetchAPI<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { schema, ...fetchOptions } = options;

  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorCode: string | undefined;

    try {
      const errorBody = (await response.json()) as {
        message?: string;
        code?: string;
      };
      if (errorBody.message) {
        errorMessage = errorBody.message;
      }
      errorCode = errorBody.code;
    } catch {
      // Ignore JSON parsing errors for error response
    }

    throw new APIError(errorMessage, response.status, errorCode);
  }

  const data = (await response.json()) as T;

  // Validate and transform response if schema provided
  if (schema) {
    const result = schema.safeParse(data);
    if (!result.success) {
      if (import.meta.env.DEV) {
        console.error('API response validation failed:', {
          endpoint,
          error: result.error.format(),
        });
        throw new APIError(
          `Validation failed: ${result.error.message}`,
          500,
          'VALIDATION_ERROR',
        );
      }

      return data as T;
    }
    // Return the parsed/transformed data
    return result.data as T;
  }

  return data;
}

// =============================================================================
// API Client
// =============================================================================

/**
 * Type-safe API client for the Lyrebird gateway
 */
export const api = {
  /**
   * Create a new sentiment analysis job
   * @param prompt - The search prompt for sentiment analysis
   */
  createJob: (prompt: string) => {
    return fetchAPI<z.infer<typeof JobResponseSchema>>('/jobs', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
      schema: JobResponseSchema,
    });
  },

  /**
   * Get a job by ID
   */
  getJob: (id: string) =>
    fetchAPI<z.infer<typeof JobResponseSchema>>(`/jobs/${id}`, {
      schema: JobResponseSchema,
    }),

  /**
   * Get job results with sentiment data
   */
  getJobResults: (id: string) =>
    fetchAPI<z.infer<typeof JobResultsResponseSchema>>(`/jobs/${id}/results`, {
      schema: JobResultsResponseSchema,
    }),

  /**
   * List all jobs with pagination
   */
  listJobs: (params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    const endpoint = query ? `/jobs?${query}` : '/jobs';

    return fetchAPI<z.infer<typeof JobsListResponseSchema>>(endpoint, {
      schema: JobsListResponseSchema,
    });
  },

  /**
   * Cancel a running job
   */
  cancelJob: (id: string) =>
    fetchAPI<{ success: boolean }>(`/jobs/${id}/cancel`, {
      method: 'POST',
    }),

  /**
   * Delete a job
   */
  deleteJob: (id: string) =>
    fetchAPI<{ success: boolean }>(`/jobs/${id}`, {
      method: 'DELETE',
    }),
};

// Export schemas for use in tests
export const schemas = {
  JobResponseSchema,
  SentimentDataItemSchema,
  SentimentDistributionSchema,
  JobResultsResponseSchema,
  JobsListResponseSchema,
};
