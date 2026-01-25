import { PieChart } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

// =============================================================================
// Types
// =============================================================================

export interface SentimentDistributionCardProps {
  breakdown?: {
    positive: number;
    neutral: number;
    negative: number;
    positivePercent: number;
    neutralPercent: number;
    negativePercent: number;
  };
}

// =============================================================================
// Component
// =============================================================================

/**
 * Sentiment distribution card showing a stacked bar visualization with legend
 *
 * Features:
 * - Visual bar showing positive/neutral/negative distribution
 * - Percentage legend with color indicators
 * - Accessible with ARIA labels
 */
export function SentimentDistributionCard({
  breakdown,
}: SentimentDistributionCardProps) {
  return (
    <Card
      className="w-full min-w-[180px] flex-1 sm:max-w-[280px]"
      role="region"
      aria-labelledby="stat-distribution"
    >
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <PieChart className="h-4 w-4" aria-hidden="true" />
          <span id="stat-distribution" className="text-sm font-medium">
            Distribution
          </span>
        </div>

        {breakdown ? (
          <>
            {/* Visual bar with accessibility description */}
            <div
              className="mt-5 flex h-4 w-full overflow-hidden rounded-full sm:h-3"
              role="img"
              aria-label={`Sentiment distribution: ${breakdown.positivePercent}% positive, ${breakdown.neutralPercent}% neutral, ${breakdown.negativePercent}% negative`}
            >
              <div
                className="bg-green-500 transition-all duration-300"
                style={{
                  width: `${breakdown.positivePercent}%`,
                  minWidth: breakdown.positivePercent > 0 ? '4px' : '0',
                }}
              />
              <div
                className="bg-gray-400 transition-all duration-300"
                style={{
                  width: `${breakdown.neutralPercent}%`,
                  minWidth: breakdown.neutralPercent > 0 ? '4px' : '0',
                }}
              />
              <div
                className="bg-red-500 transition-all duration-300"
                style={{
                  width: `${breakdown.negativePercent}%`,
                  minWidth: breakdown.negativePercent > 0 ? '4px' : '0',
                }}
              />
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center gap-2 text-xs sm:justify-between sm:gap-0">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <span
                  className="h-2 w-2 rounded-full bg-green-500"
                  aria-hidden="true"
                />
                <span className="sr-only">Positive: </span>
                {breakdown.positivePercent}%
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full bg-gray-400"
                  aria-hidden="true"
                />
                <span className="sr-only">Neutral: </span>
                {breakdown.neutralPercent}%
              </span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <span
                  className="h-2 w-2 rounded-full bg-red-500"
                  aria-hidden="true"
                />
                <span className="sr-only">Negative: </span>
                {breakdown.negativePercent}%
              </span>
            </div>
          </>
        ) : (
          <div className="mt-2 text-2xl font-bold tabular-nums">
            <span aria-label="No data available">{'\u2014'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
