import {
  TrendingUp,
  Target,
  ArrowUp,
  ArrowDown,
  Activity,
  Gauge,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/common/stat-card';
import { SentimentDistributionCard } from '@/components/visualization/sentiment-distribution';
import { cn } from '@/lib/utils';
import {
  getSentimentLabel,
  getSentimentColorClass,
  getNSSLabel,
  getNSSColorClass,
  getVelocityLabel,
  getVelocityColorClass,
} from '@/lib/sentiment-utils';
import type { StatsSummaryProps } from './types';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get display label for sentiment (capitalized for UI)
 */
function getSentimentDisplayLabel(score: number): string {
  const label = getSentimentLabel(score);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// =============================================================================
// Component
// =============================================================================

/**
 * Summary stats cards displayed below the chart
 *
 * Shows:
 * - Average sentiment score
 * - Net Sentiment Score (NSS)
 * - Sentiment Distribution (positive/neutral/negative breakdown)
 * - Sentiment Velocity (trend direction)
 * - Volume Rate (posts per minute)
 */
export function StatsSummary({
  averageSentiment,
  nss,
  isLive = false,
  breakdown,
  velocity,
  postsPerMinute,
  volumeTrend,
  className,
}: StatsSummaryProps) {
  // Determine if we have enough data for rate display
  const hasValidRate = postsPerMinute !== null && postsPerMinute !== undefined;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Primary metrics row - 2 cards centered */}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {/* Average sentiment */}
        <StatCard
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
          label="Average"
          labelId="stat-average"
          value={
            averageSentiment !== null
              ? `${averageSentiment >= 0 ? '+' : ''}${averageSentiment.toFixed(2)}`
              : '\u2014'
          }
          valueColorClass={
            averageSentiment !== null
              ? getSentimentColorClass(getSentimentLabel(averageSentiment))
              : undefined
          }
          subValue={
            averageSentiment !== null
              ? getSentimentDisplayLabel(averageSentiment)
              : null
          }
          emptyLabel="No data available"
        />

        {/* Net Sentiment Score */}
        <StatCard
          icon={<Target className="h-4 w-4" aria-hidden="true" />}
          label={<abbr title="Net Sentiment Score">NSS</abbr>}
          labelId="stat-nss"
          value={nss !== null ? `${nss >= 0 ? '+' : ''}${nss}` : '\u2014'}
          valueColorClass={nss !== null ? getNSSColorClass(nss) : undefined}
          subValue={nss !== null ? getNSSLabel(nss) : null}
          emptyLabel="No data available"
        />
      </div>

      {/* Secondary metrics row - 3 cards centered */}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {/* Sentiment Distribution */}
        <SentimentDistributionCard breakdown={breakdown} />

        {/* Sentiment Velocity */}
        <StatCard
          icon={<Activity className="h-4 w-4" aria-hidden="true" />}
          label="Momentum"
          labelId="stat-momentum"
          value={
            velocity !== null && velocity !== undefined
              ? `${velocity >= 0 ? '+' : ''}${velocity.toFixed(2)}`
              : '\u2014'
          }
          valueColorClass={
            velocity !== null && velocity !== undefined
              ? getVelocityColorClass(velocity)
              : undefined
          }
          subValue={
            velocity !== null && velocity !== undefined
              ? getVelocityLabel(velocity)
              : 'Not enough data'
          }
          emptyLabel="No data available"
        />

        {/* Volume Rate */}
        <StatCard
          icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
          label="Rate"
          labelId="stat-rate"
          value={hasValidRate ? `${postsPerMinute.toFixed(1)}/min` : '\u2014'}
          subValue={
            hasValidRate ? (
              volumeTrend !== null && volumeTrend !== undefined ? (
                <span
                  className={cn(
                    'flex items-center gap-1',
                    volumeTrend >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                  aria-label={
                    volumeTrend >= 0 ? 'Volume increasing' : 'Volume decreasing'
                  }
                >
                  {volumeTrend >= 0 ? (
                    <ArrowUp className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ArrowDown className="h-3 w-3" aria-hidden="true" />
                  )}
                  {Math.abs(volumeTrend)}% vs prev
                </span>
              ) : (
                'Posts per minute'
              )
            ) : (
              'Collecting data...'
            )
          }
          isLive={isLive}
          emptyLabel="No data available"
        />
      </div>
    </div>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

export function StatsSummarySkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('space-y-4', className)}
      role="status"
      aria-label="Loading statistics"
    >
      <span className="sr-only">Loading statistics...</span>
      {/* Primary row - 2 cards centered */}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {[1, 2].map((i) => (
          <Card
            key={i}
            className="w-full min-w-[180px] flex-1 sm:max-w-[280px]"
          >
            <CardContent className="pt-4">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-8 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-3 w-12 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Secondary row - 3 cards centered */}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {[3, 4, 5].map((i) => (
          <Card
            key={i}
            className="w-full min-w-[180px] flex-1 sm:max-w-[280px]"
          >
            <CardContent className="pt-4">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-8 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-3 w-12 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
