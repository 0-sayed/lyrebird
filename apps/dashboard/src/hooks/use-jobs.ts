import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, APIError } from '@/lib/api-client';
import { queryKeys } from '@/lib/constants';
import type {
  JobResponse,
  JobResultsResponse,
  JobsListResponse,
} from '@/types/api';

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Options for useJobs hook
 */
interface UseJobsOptions {
  page?: number;
  limit?: number;
  enabled?: boolean;
}

/**
 * Fetch paginated list of jobs
 */
export function useJobs(options: UseJobsOptions = {}) {
  const { page = 1, limit = 10, enabled = true } = options;

  return useQuery<JobsListResponse, APIError>({
    queryKey: queryKeys.jobs.list({ page, limit }),
    queryFn: () => api.listJobs({ page, limit }),
    enabled,
  });
}

/**
 * Fetch a single job by ID
 */
export function useJob(
  jobId: string | undefined,
  options?: Omit<
    UseQueryOptions<JobResponse, APIError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<JobResponse, APIError>({
    queryKey: queryKeys.jobs.detail(jobId ?? ''),
    queryFn: () => api.getJob(jobId!),
    enabled: Boolean(jobId) && (options?.enabled ?? true),
    ...options,
  });
}

/**
 * Fetch job results with sentiment data
 */
export function useJobResults(
  jobId: string | undefined,
  options?: Omit<
    UseQueryOptions<JobResultsResponse, APIError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<JobResultsResponse, APIError>({
    queryKey: queryKeys.jobs.results(jobId ?? ''),
    queryFn: () => api.getJobResults(jobId!),
    enabled: Boolean(jobId) && (options?.enabled ?? true),
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Options for the create job mutation
 */
interface CreateJobOptions {
  prompt: string;
}

/**
 * Create a new sentiment analysis job
 */
export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation<JobResponse, APIError, CreateJobOptions>({
    mutationFn: ({ prompt }) => api.createJob(prompt),
    onSuccess: (newJob) => {
      // Invalidate jobs list to refetch
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.lists() });

      // Optimistically add the new job to cache
      queryClient.setQueryData(queryKeys.jobs.detail(newJob.jobId), newJob);

      toast.success('Analysis started', {
        description: `Analyzing: "${newJob.prompt.slice(0, 50)}${newJob.prompt.length > 50 ? '...' : ''}"`,
      });
    },
    onError: (error) => {
      toast.error('Failed to start analysis', {
        description: error.message,
      });
    },
  });
}

/**
 * Delete a job
 */
export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, APIError, string>({
    mutationFn: (jobId) => api.deleteJob(jobId),
    onSuccess: (_, jobId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.jobs.detail(jobId) });
      queryClient.removeQueries({ queryKey: queryKeys.jobs.results(jobId) });
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.lists() });

      toast.success('Job deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete job', {
        description: error.message,
      });
    },
  });
}
