import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import {
  useJobs,
  useJob,
  useJobResults,
  useCreateJob,
  useDeleteJob,
} from '../use-jobs';
import { api } from '@/lib/api-client';
import { JobStatus, SentimentLabel } from '@/types/api';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  api: {
    listJobs: vi.fn(),
    getJob: vi.fn(),
    getJobResults: vi.fn(),
    createJob: vi.fn(),
    deleteJob: vi.fn(),
  },
  APIError: class APIError extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public code?: string,
    ) {
      super(message);
      this.name = 'APIError';
    }
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Test fixtures
const mockJob = {
  jobId: 'test-job-1',
  status: JobStatus.COMPLETED,
  prompt: 'test prompt',
  createdAt: '2026-01-10T10:00:00Z',
  averageSentiment: 0.75,
  dataPointsCount: 10,
};

const mockJobResults = {
  job: mockJob,
  sentimentDistribution: { positive: 7, neutral: 2, negative: 1 },
  data: [
    {
      id: '1',
      textContent: 'Test post',
      source: 'bluesky',
      sentimentScore: 0.8,
      sentimentLabel: SentimentLabel.POSITIVE,
      publishedAt: '2026-01-10T09:00:00Z',
    },
  ],
  totalItems: 10,
  averageSentiment: 0.75,
};

const mockJobsList = {
  jobs: [mockJob],
  total: 1,
  page: 1,
  limit: 10,
};

// Helper to create test wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useJobs hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches jobs list successfully', async () => {
    vi.mocked(api.listJobs).mockResolvedValueOnce(mockJobsList);

    const { result } = renderHook(() => useJobs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockJobsList);
    expect(api.listJobs).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('passes pagination params correctly', async () => {
    vi.mocked(api.listJobs).mockResolvedValueOnce(mockJobsList);

    const { result } = renderHook(() => useJobs({ page: 2, limit: 20 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.listJobs).toHaveBeenCalledWith({ page: 2, limit: 20 });
  });

  it('can be disabled', () => {
    const { result } = renderHook(() => useJobs({ enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(api.listJobs).not.toHaveBeenCalled();
  });
});

describe('useJob hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches single job successfully', async () => {
    vi.mocked(api.getJob).mockResolvedValueOnce(mockJob);

    const { result } = renderHook(() => useJob('test-job-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockJob);
    expect(api.getJob).toHaveBeenCalledWith('test-job-1');
  });

  it('is disabled when jobId is undefined', () => {
    const { result } = renderHook(() => useJob(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(api.getJob).not.toHaveBeenCalled();
  });
});

describe('useJobResults hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches job results successfully', async () => {
    vi.mocked(api.getJobResults).mockResolvedValueOnce(mockJobResults);

    const { result } = renderHook(() => useJobResults('test-job-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockJobResults);
    expect(api.getJobResults).toHaveBeenCalledWith('test-job-1');
  });

  it('is disabled when jobId is undefined', () => {
    const { result } = renderHook(() => useJobResults(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(api.getJobResults).not.toHaveBeenCalled();
  });
});

describe('useCreateJob hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates job successfully', async () => {
    vi.mocked(api.createJob).mockResolvedValueOnce(mockJob);

    const { result } = renderHook(() => useCreateJob(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ prompt: 'test prompt' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.createJob).toHaveBeenCalledWith('test prompt');
  });
});

describe('useDeleteJob hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes job successfully', async () => {
    vi.mocked(api.deleteJob).mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useDeleteJob(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('test-job-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.deleteJob).toHaveBeenCalledWith('test-job-1');
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('useCreateJob error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error toast when createJob fails with APIError', async () => {
    const { APIError } = await import('@/lib/api-client');
    const mockError = new APIError('Rate limit exceeded', 429);
    vi.mocked(api.createJob).mockRejectedValueOnce(mockError);

    const { toast } = await import('sonner');

    const { result } = renderHook(() => useCreateJob(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ prompt: 'test' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Failed to start analysis', {
      description: 'Rate limit exceeded',
    });
  });

  it('shows generic message for unknown errors', async () => {
    vi.mocked(api.createJob).mockRejectedValueOnce(new Error('Unknown error'));

    const { toast } = await import('sonner');

    const { result } = renderHook(() => useCreateJob(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ prompt: 'test' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Failed to start analysis', {
      description: 'Unknown error',
    });
  });
});

describe('useDeleteJob error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error toast when deleteJob fails', async () => {
    const { APIError } = await import('@/lib/api-client');
    const mockError = new APIError('Not found', 404);
    vi.mocked(api.deleteJob).mockRejectedValueOnce(mockError);

    const { toast } = await import('sonner');

    const { result } = renderHook(() => useDeleteJob(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('job-123');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith('Failed to delete job', {
      description: 'Not found',
    });
  });
});
