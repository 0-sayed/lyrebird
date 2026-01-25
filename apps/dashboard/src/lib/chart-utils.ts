/**
 * Chart Conversion Utilities
 *
 * Functions for converting sentiment data to chart-compatible formats.
 */

import type { Time } from 'lightweight-charts';

import type { SentimentDataItem } from '@/types/api';
import {
  CHART_TIME_BUCKET_MS,
  type LiveDataPoint,
} from '@/components/analysis/types';

/**
 * Clamp a sentiment score to the valid -1 to +1 range.
 * Handles edge cases where backend data might exceed expected bounds.
 */
function clampSentimentScore(score: number): number {
  return Math.max(-1, Math.min(1, score));
}

/**
 * Chart data point format for lightweight-charts
 */
export interface LiveChartDataPoint {
  time: Time;
  value: number;
  postCount: number;
  totalPosts: number;
  cumulativeAverage: number;
}

// =============================================================================
// Shared Aggregation Logic
// =============================================================================

interface DataPointInput<T> {
  items: T[];
  getTimestamp: (item: T) => number;
  getScore: (item: T) => number;
}

/**
 * Aggregate data points into time buckets and compute chart data.
 *
 * Shared logic for both live and completed job data:
 * 1. Sort by timestamp
 * 2. Group into time buckets
 * 3. Calculate bucket averages and cumulative stats
 * 4. Convert to LiveChartDataPoint format
 */
function aggregateToBuckets<T>({
  items,
  getTimestamp,
  getScore,
}: DataPointInput<T>): LiveChartDataPoint[] {
  if (items.length === 0) return [];

  // Sort by timestamp
  const sortedItems = [...items].sort(
    (a, b) => getTimestamp(a) - getTimestamp(b),
  );

  // Group into time buckets
  const buckets = new Map<number, number[]>();

  for (const item of sortedItems) {
    const bucketTime =
      Math.floor(getTimestamp(item) / CHART_TIME_BUCKET_MS) *
      CHART_TIME_BUCKET_MS;

    if (!buckets.has(bucketTime)) {
      buckets.set(bucketTime, []);
    }
    buckets.get(bucketTime)!.push(clampSentimentScore(getScore(item)));
  }

  // Convert buckets to chart data points
  const sortedBuckets = Array.from(buckets.entries()).sort(([a], [b]) => a - b);

  let cumulativeSum = 0;
  let cumulativeCount = 0;
  const chartData: LiveChartDataPoint[] = [];

  for (const [bucketTime, scores] of sortedBuckets) {
    const bucketSum = scores.reduce((sum, s) => sum + s, 0);
    const bucketAverage = bucketSum / scores.length;

    cumulativeSum += bucketSum;
    cumulativeCount += scores.length;

    // lightweight-charts requires time in seconds (Unix timestamp)
    chartData.push({
      time: Math.floor(bucketTime / 1000) as Time,
      value: bucketAverage,
      postCount: scores.length,
      totalPosts: cumulativeCount,
      cumulativeAverage: cumulativeSum / cumulativeCount,
    });
  }

  return chartData;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Convert live data points to chart format
 *
 * Uses the receivedAt timestamp (when SSE event arrived) for X-axis,
 * NOT the publishedAt (when post was published on Bluesky).
 *
 * Groups posts into time buckets based on when they were analyzed,
 * providing an accurate real-time view of the analysis progress.
 */
export function convertToLiveChartData(
  dataPoints: LiveDataPoint[],
): LiveChartDataPoint[] {
  return aggregateToBuckets({
    items: dataPoints,
    getTimestamp: (point) => point.receivedAt,
    getScore: (point) => point.item.sentimentScore,
  });
}

/**
 * Convert completed job results to chart format
 *
 * For completed jobs, we use publishedAt timestamps since
 * we don't have receivedAt data from the API response.
 * However, this is still fine for historical viewing.
 */
export function convertResultsToChartData(
  items: SentimentDataItem[],
): LiveChartDataPoint[] {
  return aggregateToBuckets({
    items,
    getTimestamp: (item) => new Date(item.publishedAt).getTime(),
    getScore: (item) => item.sentimentScore,
  });
}
