import * as React from 'react';

import { useJob, useJobResults } from './use-jobs';
import type { AnalysisPhase, LiveDataPoint } from '@/components/analysis/types';
import type { LiveChartDataPoint } from '@/components/analysis/sentiment-live-chart';
import {
  convertResultsToChartData,
  convertToLiveChartData,
} from '@/lib/chart-utils';
import { JobStatus } from '@/types/api';

// =============================================================================
// Types
// =============================================================================

export interface UseJobDataFlowOptions {
  /** Current job ID */
  jobId?: string | null;
  /** Current phase */
  phase: AnalysisPhase;
  /** Set phase callback */
  setPhase: React.Dispatch<React.SetStateAction<AnalysisPhase>>;
  /** Reference to track if initialized from history */
  hasInitializedFromHistoryRef: React.MutableRefObject<boolean>;
  /** Set chart data callback */
  setChartData: React.Dispatch<React.SetStateAction<LiveChartDataPoint[]>>;
  /** Set live post count callback */
  setLivePostCount: React.Dispatch<React.SetStateAction<number>>;
  /** Set live data points callback */
  setLiveDataPoints: React.Dispatch<React.SetStateAction<LiveDataPoint[]>>;
}

export interface UseJobDataFlowReturn {
  /** Active job data */
  activeJob: ReturnType<typeof useJob>['data'];
  /** Job results data */
  jobResults: ReturnType<typeof useJobResults>['data'];
  /** Whether data is loading */
  isLoading: boolean;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Manages job data fetching and historical data initialization
 *
 * Features:
 * - Job and results queries with proper caching
 * - Automatic phase updates based on job status
 * - Historical data initialization for in-progress jobs
 * - Polling for pending/in-progress jobs
 */
export function useJobDataFlow({
  jobId,
  phase,
  setPhase,
  hasInitializedFromHistoryRef,
  setChartData,
  setLivePostCount,
  setLiveDataPoints,
}: UseJobDataFlowOptions): UseJobDataFlowReturn {
  // Convert null to undefined for query hooks
  const normalizedJobId = jobId ?? undefined;

  // Query for job data
  const { data: activeJob, isLoading: isJobLoading } = useJob(normalizedJobId, {
    enabled: Boolean(normalizedJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === JobStatus.PENDING || status === JobStatus.IN_PROGRESS) {
        return 2000;
      }
      return false;
    },
  });

  // Query for results
  const { data: jobResults, isLoading: isResultsLoading } = useJobResults(
    normalizedJobId,
    {
      enabled: Boolean(normalizedJobId),
    },
  );

  // Load initial job if provided
  React.useEffect(() => {
    if (
      jobId &&
      activeJob &&
      (phase.type === 'initial' || phase.type === 'loading')
    ) {
      if (activeJob.status === JobStatus.COMPLETED) {
        setPhase({
          type: 'completed',
          jobId,
          query: activeJob.prompt,
        });
      } else if (activeJob.status === JobStatus.FAILED) {
        setPhase({
          type: 'failed',
          jobId,
          query: activeJob.prompt,
          error: activeJob.errorMessage ?? 'Job failed',
        });
      } else {
        setPhase({
          type: 'analyzing',
          jobId,
          query: activeJob.prompt,
        });
      }
    }
  }, [jobId, activeJob, phase.type, setPhase]);

  // Update chart data when results are loaded
  React.useEffect(() => {
    if (!jobResults?.data) return;

    // For completed jobs, always update from jobResults
    if (activeJob?.status === JobStatus.COMPLETED) {
      setChartData(convertResultsToChartData(jobResults.data));
      setLivePostCount(jobResults.data.length);
      return;
    }

    // For in-progress jobs, only initialize ONCE from historical data
    if (
      activeJob?.status === JobStatus.IN_PROGRESS &&
      !hasInitializedFromHistoryRef.current &&
      jobResults.data.length > 0
    ) {
      hasInitializedFromHistoryRef.current = true;

      // Convert historical data to LiveDataPoint format
      const historicalLiveDataPoints: LiveDataPoint[] = jobResults.data.map(
        (item) => ({
          item,
          receivedAt: new Date(item.analyzedAt ?? Date.now()).getTime(),
        }),
      );

      setLiveDataPoints(historicalLiveDataPoints);
      setChartData(convertToLiveChartData(historicalLiveDataPoints));
      setLivePostCount(jobResults.data.length);
    }
  }, [
    jobResults,
    activeJob?.status,
    hasInitializedFromHistoryRef,
    setChartData,
    setLivePostCount,
    setLiveDataPoints,
  ]);

  return {
    activeJob,
    jobResults,
    isLoading: isJobLoading || isResultsLoading,
  };
}
