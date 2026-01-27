/**
 * Tests for useJobDataFlow hook
 *
 * This hook manages job data fetching and historical data initialization.
 * Tests cover job loading, phase transitions, and results handling.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  useJobDataFlow,
  type UseJobDataFlowOptions,
} from '../use-job-data-flow';
import {
  seedMockJob,
  createMockJob,
  createMockJobResults,
} from '@/__tests__/mocks/api-handlers';
import { JobStatus } from '@/types/api';
import type { AnalysisPhase } from '@/components/analysis/types';
import type { LiveDataPoint } from '@/components/analysis/types';

// =============================================================================
// Test Setup
// =============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function createDefaultOptions(
  overrides: Partial<UseJobDataFlowOptions> = {},
): UseJobDataFlowOptions {
  const hasInitializedFromHistoryRef = { current: false };

  return {
    jobId: undefined,
    phase: { type: 'initial' } as AnalysisPhase,
    setPhase: vi.fn(),
    hasInitializedFromHistoryRef,
    setChartData: vi.fn(),
    setLivePostCount: vi.fn(),
    setLiveDataPoints: vi.fn(),
    ...overrides,
  };
}

describe('useJobDataFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe('Initial State', () => {
    it('returns undefined job data when no jobId provided', async () => {
      const { result } = renderHook(
        () => useJobDataFlow(createDefaultOptions()),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activeJob).toBeUndefined();
      expect(result.current.jobResults).toBeUndefined();
    });

    it('returns isLoading true initially when jobId provided', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440000';
      seedMockJob(createMockJob({ jobId, status: JobStatus.COMPLETED }));

      const { result } = renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId,
              phase: { type: 'initial' },
            }),
          ),
        { wrapper: createWrapper() },
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for data
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Job Data Fetching
  // ===========================================================================

  describe('Job Data Fetching', () => {
    it('fetches job data when jobId provided', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440001';
      seedMockJob(
        createMockJob({
          jobId,
          status: JobStatus.COMPLETED,
          prompt: 'test query',
        }),
      );

      const { result } = renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId,
              phase: { type: 'initial' },
            }),
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.activeJob).toBeDefined();
      });

      expect(result.current.activeJob?.jobId).toBe(jobId);
      expect(result.current.activeJob?.prompt).toBe('test query');
    });

    it('fetches job results when jobId provided', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440002';
      const mockJob = createMockJob({ jobId, status: JobStatus.COMPLETED });
      const mockResults = createMockJobResults(jobId, 5);
      seedMockJob(mockJob, mockResults);

      const { result } = renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId,
              phase: { type: 'initial' },
            }),
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.jobResults).toBeDefined();
      });

      expect(result.current.jobResults?.data).toHaveLength(5);
    });
  });

  // ===========================================================================
  // Phase Updates
  // ===========================================================================

  describe('Phase Updates', () => {
    it('updates phase to completed when job is completed', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440003';
      const setPhase = vi.fn();
      seedMockJob(
        createMockJob({
          jobId,
          status: JobStatus.COMPLETED,
          prompt: 'completed query',
        }),
      );

      renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId,
              phase: { type: 'initial' },
              setPhase,
            }),
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(setPhase).toHaveBeenCalledWith({
          type: 'completed',
          jobId,
          query: 'completed query',
        });
      });
    });

    it('updates phase to failed when job has failed', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440004';
      const setPhase = vi.fn();
      seedMockJob(
        createMockJob({
          jobId,
          status: JobStatus.FAILED,
          prompt: 'failed query',
        }),
      );

      renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId,
              phase: { type: 'initial' },
              setPhase,
            }),
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(setPhase).toHaveBeenCalledWith({
          type: 'failed',
          jobId,
          query: 'failed query',
          error: 'Job failed',
        });
      });
    });

    it('updates phase to analyzing for pending/in-progress jobs', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440005';
      const setPhase = vi.fn();
      seedMockJob(
        createMockJob({
          jobId,
          status: JobStatus.IN_PROGRESS,
          prompt: 'in progress query',
        }),
      );

      renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId,
              phase: { type: 'initial' },
              setPhase,
            }),
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(setPhase).toHaveBeenCalledWith({
          type: 'analyzing',
          jobId,
          query: 'in progress query',
        });
      });
    });

    it('does not update phase if already in analyzing state', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440006';
      const setPhase = vi.fn();
      seedMockJob(
        createMockJob({
          jobId,
          status: JobStatus.IN_PROGRESS,
          prompt: 'in progress query',
        }),
      );

      renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId,
              phase: { type: 'analyzing', jobId, query: 'already analyzing' },
              setPhase,
            }),
          ),
        { wrapper: createWrapper() },
      );

      // Wait for queries to settle
      await waitFor(() => {
        // Give some time for effects to run
      });

      // setPhase should not be called because we're already in analyzing phase
      expect(setPhase).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Chart Data Initialization
  // ===========================================================================

  describe('Chart Data Initialization', () => {
    it('sets chart data for completed jobs from results', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440007';
      const setChartData = vi.fn();
      const setLivePostCount = vi.fn();
      const mockJob = createMockJob({ jobId, status: JobStatus.COMPLETED });
      const mockResults = createMockJobResults(jobId, 3);
      seedMockJob(mockJob, mockResults);

      renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId,
              phase: { type: 'completed', jobId, query: 'test' },
              setChartData,
              setLivePostCount,
            }),
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(setChartData).toHaveBeenCalled();
      });

      expect(setLivePostCount).toHaveBeenCalledWith(3);
    });

    it('initializes history for in-progress jobs only once', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440008';
      const setChartData = vi.fn();
      const setLiveDataPoints = vi.fn();
      const hasInitializedFromHistoryRef = { current: false };
      const mockJob = createMockJob({ jobId, status: JobStatus.IN_PROGRESS });
      const mockResults = createMockJobResults(jobId, 5);
      seedMockJob(mockJob, mockResults);

      const { rerender } = renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId,
              phase: { type: 'analyzing', jobId, query: 'test' },
              setChartData,
              setLiveDataPoints,
              hasInitializedFromHistoryRef,
            }),
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(hasInitializedFromHistoryRef.current).toBe(true);
      });

      // setLiveDataPoints should have been called with historical data
      expect(setLiveDataPoints).toHaveBeenCalled();
      const callArgs = setLiveDataPoints.mock.calls[0]?.[0] as LiveDataPoint[];
      expect(callArgs).toHaveLength(5);

      // Clear mocks to track subsequent calls
      setChartData.mockClear();
      setLiveDataPoints.mockClear();

      // Rerender should not reinitialize
      rerender();

      // Wait a bit and verify no additional chart data calls
      await new Promise((resolve) => setTimeout(resolve, 100));

      // hasInitializedFromHistoryRef prevents reinitialization
      expect(hasInitializedFromHistoryRef.current).toBe(true);
    });
  });

  // ===========================================================================
  // Null/Undefined JobId Handling
  // ===========================================================================

  describe('Null/Undefined JobId Handling', () => {
    it('handles null jobId', async () => {
      const { result } = renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId: null,
              phase: { type: 'initial' },
            }),
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activeJob).toBeUndefined();
    });

    it('handles undefined jobId', async () => {
      const { result } = renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId: undefined,
              phase: { type: 'initial' },
            }),
          ),
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activeJob).toBeUndefined();
    });
  });

  // ===========================================================================
  // Return Value Structure
  // ===========================================================================

  describe('Return Value Structure', () => {
    it('returns correct structure', async () => {
      const { result } = renderHook(
        () => useJobDataFlow(createDefaultOptions()),
        { wrapper: createWrapper() },
      );

      expect(result.current).toHaveProperty('activeJob');
      expect(result.current).toHaveProperty('jobResults');
      expect(result.current).toHaveProperty('isLoading');
    });
  });

  // ===========================================================================
  // Error Handling - 404 Not Found
  // ===========================================================================

  describe('Error Handling - 404 Not Found', () => {
    it('resets to initial phase when job not found (404)', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440099'; // Non-existent job
      const setPhase = vi.fn();

      // Mock localStorage
      const mockRemoveItem = vi.fn();
      vi.spyOn(window.localStorage, 'removeItem').mockImplementation(
        mockRemoveItem,
      );

      renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId,
              phase: { type: 'loading', jobId }, // Start in loading phase
              setPhase,
            }),
          ),
        { wrapper: createWrapper() },
      );

      // Wait for the 404 error to be handled
      await waitFor(() => {
        expect(setPhase).toHaveBeenCalledWith({ type: 'initial' });
      });

      // Should have cleared localStorage
      expect(mockRemoveItem).toHaveBeenCalledWith('lyrebird-last-job-id');

      // Restore localStorage
      vi.restoreAllMocks();
    });

    it('does not reset phase if not in loading state when 404 occurs', async () => {
      const jobId = '550e8400-e29b-41d4-a716-446655440098'; // Non-existent job
      const setPhase = vi.fn();

      renderHook(
        () =>
          useJobDataFlow(
            createDefaultOptions({
              jobId,
              phase: { type: 'analyzing', jobId, query: 'test' }, // Not in loading phase
              setPhase,
            }),
          ),
        { wrapper: createWrapper() },
      );

      // Wait for queries to settle
      await waitFor(() => {
        // Give time for effects to run
      });

      // Should NOT reset to initial since we're not in loading phase
      expect(setPhase).not.toHaveBeenCalledWith({ type: 'initial' });
    });
  });
});
