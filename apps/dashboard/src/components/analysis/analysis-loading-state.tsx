import { SentimentLiveChartSkeleton } from './sentiment-live-chart';
import { StatsSummarySkeleton } from './stats-summary';

// =============================================================================
// Component
// =============================================================================

/**
 * Loading state skeleton for the analysis view
 *
 * Shows:
 * - Header skeleton with status indicator and title
 * - Chart skeleton
 * - Stats summary skeleton
 */
export function AnalysisLoadingState() {
  return (
    <div className="flex-1 px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header skeleton */}
        <div className="animate-pulse space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
          <div className="h-6 w-64 rounded bg-muted" />
        </div>
        {/* Chart skeleton */}
        <SentimentLiveChartSkeleton height={350} />
        {/* Stats skeleton */}
        <StatsSummarySkeleton />
      </div>
    </div>
  );
}
