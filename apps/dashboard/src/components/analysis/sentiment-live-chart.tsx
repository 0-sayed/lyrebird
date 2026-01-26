import * as React from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SingleValueData,
  type Time,
} from 'lightweight-charts';

import { cn } from '@/lib/utils';
import { getChartOptions } from '@/lib/chart-theme';
import {
  createSentimentSeries,
  createAverageSeries,
  createPriceLines,
  updatePriceLineColors,
  updateAverageSeriesColor,
  type PriceLineRefs,
} from '@/lib/chart-series-builders';
import { SentimentLiveChartLegend } from '@/components/visualization/chart-legend';

// =============================================================================
// Types
// =============================================================================

/**
 * Data point for the live sentiment chart
 *
 * Uses the actual analysis time (when the data point was received via SSE)
 * rather than Bluesky's publishedAt for accurate real-time visualization.
 */
export interface LiveChartDataPoint {
  /** Unix timestamp in seconds (required by lightweight-charts) */
  time: Time;
  /** Sentiment score (-1 to +1) */
  value: number;
  /** Number of posts aggregated in this time bucket */
  postCount: number;
  /** Total posts analyzed up to this point */
  totalPosts: number;
  /** Cumulative running average */
  cumulativeAverage?: number;
}

export interface SentimentLiveChartProps {
  /** Data points for the chart */
  data: LiveChartDataPoint[];
  /** Whether chart is still receiving data */
  isLive?: boolean;
  /** Chart height in pixels */
  height?: number;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Real-time sentiment chart using TradingView Lightweight Charts
 *
 * Features:
 * - Pan and zoom like stock charts (scroll to zoom, drag to pan)
 * - Built-in crosshair with time/value display
 * - Optimized for real-time data updates
 * - Green for positive sentiment, red for negative
 * - Cumulative average overlay line
 * - Auto-scroll to latest data when live
 */
export function SentimentLiveChart({
  data,
  isLive = false,
  height = 400,
  className,
}: SentimentLiveChartProps) {
  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const sentimentSeriesRef = React.useRef<ISeriesApi<'Baseline'> | null>(null);
  const averageSeriesRef = React.useRef<ISeriesApi<'Line'> | null>(null);
  const priceLinesRef = React.useRef<PriceLineRefs | null>(null);

  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  // Watch for theme changes
  React.useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // Initialize chart
  React.useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      ...getChartOptions(isDarkMode),
      width: chartContainerRef.current.clientWidth,
      height,
    });

    chartRef.current = chart;

    // Create series using builders
    const sentimentSeries = createSentimentSeries(chart);
    sentimentSeriesRef.current = sentimentSeries;

    const averageSeries = createAverageSeries(chart, isDarkMode);
    averageSeriesRef.current = averageSeries;

    // Create price lines for sentiment thresholds
    priceLinesRef.current = createPriceLines(sentimentSeries, isDarkMode);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      sentimentSeriesRef.current = null;
      averageSeriesRef.current = null;
      priceLinesRef.current = null;
    };
    // Note: We intentionally omit isDarkMode from deps to avoid recreating the chart on theme change.
    // Theme changes are handled by a separate useEffect that calls applyOptions().
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isDarkMode intentionally omitted; theme handled by separate useEffect
  }, [height]); // Only recreate on height change

  // Update theme
  React.useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions(getChartOptions(isDarkMode));
    }
    if (averageSeriesRef.current) {
      updateAverageSeriesColor(averageSeriesRef.current, isDarkMode);
    }
    if (priceLinesRef.current) {
      updatePriceLineColors(priceLinesRef.current, isDarkMode);
    }
  }, [isDarkMode]);

  // Update data
  React.useEffect(() => {
    if (
      !sentimentSeriesRef.current ||
      !averageSeriesRef.current ||
      data.length === 0
    ) {
      return;
    }

    // Convert data for sentiment series (BaselineSeries uses SingleValueData format)
    const sentimentData: SingleValueData<Time>[] = data.map((point) => ({
      time: point.time,
      value: point.value,
    }));

    // Convert data for average series
    const averageData = data
      .filter((point) => point.cumulativeAverage !== undefined)
      .map((point) => ({
        time: point.time,
        value: point.cumulativeAverage ?? 0,
      }));

    sentimentSeriesRef.current.setData(sentimentData);
    averageSeriesRef.current.setData(averageData);

    // Auto-scroll to latest when live
    if (isLive && chartRef.current) {
      chartRef.current.timeScale().scrollToRealTime();
    }
  }, [data, isLive]);

  // Empty state
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed bg-muted/20',
          className,
        )}
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {isLive ? 'Waiting for data...' : 'No data available'}
          </p>
          {isLive && (
            <p className="mt-1 text-xs text-muted-foreground/70">
              Analysis will appear as posts are processed
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} data-testid="sentiment-live-chart">
      {/* Chart controls hint */}
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Sentiment over time • {data[data.length - 1]?.totalPosts ?? 0} posts
        </span>
        <span className="hidden sm:inline">Scroll to zoom • Drag to pan</span>
      </div>

      {/* Chart container */}
      <div
        ref={chartContainerRef}
        className="rounded-lg border bg-card"
        style={{ height }}
      />

      {/* Legend */}
      <SentimentLiveChartLegend className="mt-3" />
    </div>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

export function SentimentLiveChartSkeleton({
  height = 400,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('w-full', className)}
      role="status"
      aria-label="Loading chart"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="h-4 w-48 animate-pulse rounded bg-muted/40" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted/40" />
      </div>
      <div
        className="animate-pulse rounded-lg border bg-muted/20"
        style={{ height }}
      >
        <div className="flex h-full items-center justify-center">
          <div className="h-2/3 w-3/4 rounded bg-muted/40" />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-6">
        <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
      </div>
    </div>
  );
}
