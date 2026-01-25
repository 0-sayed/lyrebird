// Query hooks for jobs
export {
  useJobs,
  useJob,
  useJobResults,
  useCreateJob,
  useDeleteJob,
} from './use-jobs';

// SSE hook for real-time updates
export { useJobSSE, type ConnectionStatus } from './use-job-sse';

// Theme hook - re-export from provider
export { useTheme } from '@/providers/theme-provider';

// Utility hooks
export { useIsMobile } from './use-mobile';

// Persistence hooks
export {
  useLocalStorage,
  getStoredValue,
  getSidebarCookieState,
} from './use-local-storage';

// Analysis hooks
export {
  useAnalysisPhase,
  type UseAnalysisPhaseOptions,
  type UseAnalysisPhaseReturn,
} from './use-analysis-phase';

export {
  useLiveChartData,
  type UseLiveChartDataReturn,
} from './use-live-chart-data';

export {
  useAnalysisStats,
  type UseAnalysisStatsOptions,
  type UseAnalysisStatsReturn,
  type JobResultsData,
} from './use-analysis-stats';

export {
  useJobDataFlow,
  type UseJobDataFlowOptions,
  type UseJobDataFlowReturn,
} from './use-job-data-flow';
