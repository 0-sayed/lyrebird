import * as React from 'react';
import { toast } from 'sonner';

import {
  useCreateJob,
  useJobSSE,
  useLocalStorage,
  useAnalysisPhase,
  useLiveChartData,
  useAnalysisStats,
  useJobDataFlow,
} from '@/hooks';
import { JobStatus, type SentimentDataItem } from '@/types/api';
import { cn } from '@/lib/utils';
import { STORAGE_KEYS } from '@/lib/constants';

import { WelcomePrompt } from './welcome-prompt';
import { AnalysisHeader } from './analysis-header';
import { AnalysisLoadingState } from './analysis-loading-state';
import { SSEConnectionBar } from './sse-connection-bar';
import {
  SentimentLiveChart,
  SentimentLiveChartSkeleton,
} from './sentiment-live-chart';
import { StatsSummary, StatsSummarySkeleton } from './stats-summary';
import { PostsSidebar } from './posts-sidebar';
import { type AnalysisViewProps } from './types';

// =============================================================================
// Component
// =============================================================================

/**
 * Main analysis view component - orchestrates the analysis-centered UI
 *
 * State Machine:
 * - INITIAL: Shows centered welcome prompt
 * - ANALYZING: Shows header + real-time chart + stats
 * - COMPLETED: Shows header + chart + stats + posts sidebar
 * - FAILED: Shows header with error message
 */
export function AnalysisView({
  initialJobId,
  onNewAnalysis,
  onComplete,
  className,
}: AnalysisViewProps) {
  // Phase state machine
  const { phase, setPhase, isExiting, setIsExiting, currentJobId } =
    useAnalysisPhase({ initialJobId });

  // Persist posts sidebar state to localStorage
  const [postsSidebarOpen, setPostsSidebarOpen] = useLocalStorage(
    STORAGE_KEYS.POSTS_SIDEBAR_OPEN,
    false,
  );
  const [selectedPostId, setSelectedPostId] = React.useState<string>();

  // Live chart data management
  const {
    chartData,
    setChartData,
    livePostCount,
    setLivePostCount,
    liveDataPoints,
    setLiveDataPoints,
    hasInitializedFromHistoryRef,
    handleDataUpdate,
    resetChartData,
  } = useLiveChartData();

  // Job data and historical initialization
  const { activeJob, jobResults } = useJobDataFlow({
    jobId: currentJobId,
    phase,
    setPhase,
    hasInitializedFromHistoryRef,
    setChartData,
    setLivePostCount,
    setLiveDataPoints,
  });

  // Mutations
  const createJob = useCreateJob();

  // SSE connection (convert null to undefined for hook)
  const sseJobId = currentJobId ?? undefined;
  const {
    connectionStatus,
    lastHeartbeat,
    reconnectAttempts,
    jobStatus: sseJobStatus,
  } = useJobSSE(sseJobId, {
    enabled:
      Boolean(currentJobId) &&
      activeJob?.status !== JobStatus.COMPLETED &&
      activeJob?.status !== JobStatus.FAILED,
    onComplete: () => {
      if (currentJobId) {
        setPhase({
          type: 'completed',
          jobId: currentJobId,
          query: activeJob?.prompt ?? '',
        });
        toast.success('Analysis complete', {
          description: `Finished analyzing "${activeJob?.prompt ?? 'your query'}"`,
        });
        onComplete?.(currentJobId);
      }
    },
    onFailed: (data) => {
      if (currentJobId) {
        setPhase({
          type: 'failed',
          jobId: currentJobId,
          query: activeJob?.prompt ?? '',
          error: data.errorMessage,
        });
      }
    },
    onDataUpdate: handleDataUpdate,
  });

  // Update phase based on SSE status
  React.useEffect(() => {
    if (sseJobStatus && currentJobId && phase.type === 'analyzing') {
      if (sseJobStatus === JobStatus.COMPLETED) {
        setPhase({
          type: 'completed',
          jobId: currentJobId,
          query: phase.query,
        });
        onComplete?.(currentJobId);
      } else if (sseJobStatus === JobStatus.FAILED) {
        setPhase({
          type: 'failed',
          jobId: currentJobId,
          query: phase.query,
          error: 'Analysis failed',
        });
      }
    }
  }, [sseJobStatus, currentJobId, phase, onComplete, setPhase]);

  // Computed stats
  const isJobCompleted = activeJob?.status === JobStatus.COMPLETED;

  const {
    averageSentiment,
    nss,
    totalPosts,
    sentimentBreakdown,
    sentimentVelocity,
    volumeMetrics,
  } = useAnalysisStats({
    isJobCompleted,
    jobResults: jobResults
      ? {
          averageSentiment: jobResults.averageSentiment,
          sentimentDistribution: jobResults.sentimentDistribution,
          totalItems: jobResults.totalItems,
        }
      : null,
    sentimentData: jobResults?.data,
    liveDataPoints,
    livePostCount,
  });

  // Handle prompt submission
  const handleSubmit = React.useCallback(
    async (query: string) => {
      // Start exit animation
      setIsExiting(true);

      // Wait for animation
      await new Promise((resolve) => setTimeout(resolve, 300));

      try {
        const job = await createJob.mutateAsync({ prompt: query });

        setPhase({
          type: 'analyzing',
          jobId: job.jobId,
          query,
        });
        setIsExiting(false);
        resetChartData();
        onNewAnalysis?.(job.jobId);
      } catch {
        setIsExiting(false);
        setPhase({ type: 'initial' });
      }
    },
    [createJob, onNewAnalysis, setIsExiting, setPhase, resetChartData],
  );

  // Handle post selection
  const handleSelectPost = React.useCallback((post: SentimentDataItem) => {
    setSelectedPostId(post.id);
  }, []);

  const isAnalyzing = phase.type === 'analyzing';
  const isCompleted = phase.type === 'completed';
  const showConnectionStatus =
    isAnalyzing &&
    activeJob?.status !== JobStatus.COMPLETED &&
    activeJob?.status !== JobStatus.FAILED;

  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      {/* Initial State: Welcome Prompt */}
      {phase.type === 'initial' && (
        <WelcomePrompt
          onSubmit={handleSubmit}
          isLoading={createJob.isPending}
          isExiting={isExiting}
        />
      )}

      {/* Loading State: Show skeletons while fetching saved job */}
      {phase.type === 'loading' && <AnalysisLoadingState />}

      {/* Analyzing/Completed/Failed State */}
      {(phase.type === 'analyzing' ||
        phase.type === 'completed' ||
        phase.type === 'failed') && (
        <>
          {/* Connection status */}
          {showConnectionStatus && (
            <SSEConnectionBar
              status={connectionStatus}
              lastHeartbeat={lastHeartbeat?.getTime() ?? null}
              reconnectAttempts={reconnectAttempts}
            />
          )}

          {/* Analysis header */}
          <AnalysisHeader
            query={phase.query}
            phase={phase}
            postsProcessed={totalPosts}
            errorMessage={phase.type === 'failed' ? phase.error : undefined}
            className={cn(isCompleted && postsSidebarOpen && 'mr-96')}
          />

          {/* Main content */}
          <div
            className={cn(
              'flex-1 px-6 py-6',
              isCompleted && postsSidebarOpen && 'mr-96',
            )}
          >
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Chart */}
              {chartData.length > 0 ? (
                <SentimentLiveChart
                  data={chartData}
                  isLive={isAnalyzing}
                  height={350}
                  className="animate-chart-fade-in"
                />
              ) : isAnalyzing ? (
                <SentimentLiveChartSkeleton height={350} />
              ) : null}

              {/* Stats */}
              {totalPosts > 0 ? (
                <StatsSummary
                  averageSentiment={averageSentiment}
                  nss={nss}
                  isLive={isAnalyzing}
                  breakdown={sentimentBreakdown}
                  velocity={sentimentVelocity}
                  postsPerMinute={volumeMetrics.postsPerMinute}
                  volumeTrend={volumeMetrics.volumeTrend}
                  className="animate-chart-fade-in"
                />
              ) : isAnalyzing ? (
                <StatsSummarySkeleton />
              ) : null}
            </div>
          </div>

          {/* Posts sidebar (only when completed) */}
          {isCompleted && jobResults?.data && (
            <PostsSidebar
              posts={jobResults.data}
              isOpen={postsSidebarOpen}
              onToggle={() => setPostsSidebarOpen(!postsSidebarOpen)}
              onSelectPost={handleSelectPost}
              selectedPostId={selectedPostId}
            />
          )}
        </>
      )}
    </div>
  );
}
