import * as React from 'react';

import type { LiveDataPoint } from '@/components/analysis/types';
import type { SentimentBreakdown } from '@/lib/sentiment-utils';
import type { SentimentDataItem } from '@/types/api';
import {
  calculateNSS,
  calculateSentimentBreakdown,
  calculateSentimentVelocity,
  calculatePostsPerMinute,
  calculateVolumeTrend,
} from '@/lib/sentiment-utils';

// =============================================================================
// Constants
// =============================================================================

/** Velocity calculation window in milliseconds (30 seconds) */
const VELOCITY_WINDOW_MS = 30000;

// =============================================================================
// Types
// =============================================================================

export interface JobResultsData {
  averageSentiment?: number | null;
  sentimentDistribution?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  totalItems?: number;
}

export interface UseAnalysisStatsOptions {
  /** Whether the job is completed */
  isJobCompleted: boolean;
  /** Job results data (for completed jobs) */
  jobResults?: JobResultsData | null;
  /** Raw sentiment data items (for completed job metrics) */
  sentimentData?: SentimentDataItem[];
  /** Live data points array (for in-progress jobs) */
  liveDataPoints: LiveDataPoint[];
  /** Live post count */
  livePostCount: number;
}

export interface UseAnalysisStatsReturn {
  /** Average sentiment score */
  averageSentiment: number | null;
  /** Net Sentiment Score */
  nss: number | null;
  /** Total posts analyzed */
  totalPosts: number;
  /** Sentiment breakdown with percentages */
  sentimentBreakdown: SentimentBreakdown | undefined;
  /** Sentiment velocity (trend direction) */
  sentimentVelocity: number | null;
  /** Volume metrics */
  volumeMetrics: {
    postsPerMinute: number | null;
    volumeTrend: number | null;
  };
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Computes analysis statistics from chart data or job results
 *
 * Features:
 * - Automatic switching between live and completed job data
 * - Memoized computations for performance
 * - Velocity and volume trend calculations
 */
export function useAnalysisStats({
  isJobCompleted,
  jobResults,
  sentimentData,
  liveDataPoints,
  livePostCount,
}: UseAnalysisStatsOptions): UseAnalysisStatsReturn {
  // Average sentiment
  const averageSentiment = React.useMemo(() => {
    if (isJobCompleted && jobResults?.averageSentiment != null) {
      return jobResults.averageSentiment;
    }
    if (liveDataPoints.length === 0) return null;
    const sum = liveDataPoints.reduce(
      (acc, p) => acc + p.item.sentimentScore,
      0,
    );
    return sum / liveDataPoints.length;
  }, [isJobCompleted, jobResults?.averageSentiment, liveDataPoints]);

  // Net Sentiment Score
  const nss = React.useMemo(() => {
    if (isJobCompleted && jobResults?.sentimentDistribution) {
      return calculateNSS(jobResults.sentimentDistribution);
    }
    if (liveDataPoints.length === 0) return null;
    const distribution = {
      positive: liveDataPoints.filter((p) => p.item.sentimentScore > 0.2)
        .length,
      neutral: liveDataPoints.filter(
        (p) => p.item.sentimentScore >= -0.2 && p.item.sentimentScore <= 0.2,
      ).length,
      negative: liveDataPoints.filter((p) => p.item.sentimentScore < -0.2)
        .length,
    };
    return calculateNSS(distribution);
  }, [isJobCompleted, jobResults?.sentimentDistribution, liveDataPoints]);

  // Total posts
  const totalPosts = isJobCompleted
    ? (jobResults?.totalItems ?? livePostCount)
    : livePostCount;

  // Sentiment breakdown
  const sentimentBreakdown = React.useMemo(() => {
    if (isJobCompleted && jobResults?.sentimentDistribution) {
      const dist = jobResults.sentimentDistribution;
      const total = dist.positive + dist.neutral + dist.negative;
      return {
        positive: dist.positive,
        neutral: dist.neutral,
        negative: dist.negative,
        positivePercent:
          total > 0 ? Math.round((dist.positive / total) * 100) : 0,
        neutralPercent:
          total > 0 ? Math.round((dist.neutral / total) * 100) : 0,
        negativePercent:
          total > 0 ? Math.round((dist.negative / total) * 100) : 0,
        total,
      };
    }
    if (liveDataPoints.length === 0) return undefined;
    const scores = liveDataPoints.map((p) => p.item.sentimentScore);
    return calculateSentimentBreakdown(scores);
  }, [isJobCompleted, jobResults?.sentimentDistribution, liveDataPoints]);

  // Sentiment velocity
  const sentimentVelocity = React.useMemo(() => {
    // For completed jobs, use the actual data timestamps
    if (isJobCompleted && sentimentData && sentimentData.length >= 5) {
      // Sort by analyzedAt or publishedAt
      const sortedData = [...sentimentData].sort((a, b) => {
        const timeA = new Date(a.analyzedAt ?? a.publishedAt).getTime();
        const timeB = new Date(b.analyzedAt ?? b.publishedAt).getTime();
        return timeA - timeB;
      });

      // Use the last timestamp as reference instead of Date.now()
      const lastItem = sortedData[sortedData.length - 1];
      if (!lastItem) return null;
      const lastTimestamp = new Date(
        lastItem.analyzedAt ?? lastItem.publishedAt,
      ).getTime();

      const recentWindow = sortedData.filter((item) => {
        const itemTime = new Date(
          item.analyzedAt ?? item.publishedAt,
        ).getTime();
        return lastTimestamp - itemTime <= VELOCITY_WINDOW_MS;
      });

      const previousWindow = sortedData.filter((item) => {
        const itemTime = new Date(
          item.analyzedAt ?? item.publishedAt,
        ).getTime();
        const diff = lastTimestamp - itemTime;
        return diff > VELOCITY_WINDOW_MS && diff <= VELOCITY_WINDOW_MS * 2;
      });

      if (recentWindow.length === 0 || previousWindow.length === 0) return null;

      return calculateSentimentVelocity(
        recentWindow.map((item) => item.sentimentScore),
        previousWindow.map((item) => item.sentimentScore),
      );
    }

    // For live jobs, use the real-time approach
    if (liveDataPoints.length < 5) return null;

    const now = Date.now();
    const recentWindow = liveDataPoints.filter(
      (p) => now - p.receivedAt <= VELOCITY_WINDOW_MS,
    );
    const previousWindow = liveDataPoints.filter(
      (p) =>
        now - p.receivedAt > VELOCITY_WINDOW_MS &&
        now - p.receivedAt <= VELOCITY_WINDOW_MS * 2,
    );

    if (recentWindow.length === 0 || previousWindow.length === 0) return null;

    return calculateSentimentVelocity(
      recentWindow.map((p) => p.item.sentimentScore),
      previousWindow.map((p) => p.item.sentimentScore),
    );
  }, [isJobCompleted, sentimentData, liveDataPoints]);

  // Volume metrics
  const volumeMetrics = React.useMemo(() => {
    // For completed jobs, use the actual data timestamps
    if (isJobCompleted && sentimentData && sentimentData.length > 0) {
      // Sort by analyzedAt or publishedAt
      const sortedData = [...sentimentData].sort((a, b) => {
        const timeA = new Date(a.analyzedAt ?? a.publishedAt).getTime();
        const timeB = new Date(b.analyzedAt ?? b.publishedAt).getTime();
        return timeA - timeB;
      });

      const firstItem = sortedData[0];
      const lastItem = sortedData[sortedData.length - 1];
      if (!firstItem || !lastItem) {
        return { postsPerMinute: null, volumeTrend: null };
      }

      const firstTimestamp = new Date(
        firstItem.analyzedAt ?? firstItem.publishedAt,
      ).getTime();
      const lastTimestamp = new Date(
        lastItem.analyzedAt ?? lastItem.publishedAt,
      ).getTime();

      const durationMs = lastTimestamp - firstTimestamp;
      const postsPerMinute = calculatePostsPerMinute(
        sentimentData.length,
        durationMs,
      );

      // Calculate volume trend using last timestamp as reference
      const recentCount = sortedData.filter((item) => {
        const itemTime = new Date(
          item.analyzedAt ?? item.publishedAt,
        ).getTime();
        return lastTimestamp - itemTime <= VELOCITY_WINDOW_MS;
      }).length;

      const previousCount = sortedData.filter((item) => {
        const itemTime = new Date(
          item.analyzedAt ?? item.publishedAt,
        ).getTime();
        const diff = lastTimestamp - itemTime;
        return diff > VELOCITY_WINDOW_MS && diff <= VELOCITY_WINDOW_MS * 2;
      }).length;

      const volumeTrend = calculateVolumeTrend(recentCount, previousCount);

      return { postsPerMinute, volumeTrend };
    }

    // For live jobs, use the real-time approach
    if (liveDataPoints.length === 0)
      return { postsPerMinute: null, volumeTrend: null };

    const now = Date.now();
    const firstReceivedAt = liveDataPoints[0]?.receivedAt ?? now;
    const durationMs = now - firstReceivedAt;

    const postsPerMinute = calculatePostsPerMinute(
      liveDataPoints.length,
      durationMs,
    );

    const recentCount = liveDataPoints.filter(
      (p) => now - p.receivedAt <= VELOCITY_WINDOW_MS,
    ).length;
    const previousCount = liveDataPoints.filter(
      (p) =>
        now - p.receivedAt > VELOCITY_WINDOW_MS &&
        now - p.receivedAt <= VELOCITY_WINDOW_MS * 2,
    ).length;

    const volumeTrend = calculateVolumeTrend(recentCount, previousCount);

    return { postsPerMinute, volumeTrend };
  }, [isJobCompleted, sentimentData, liveDataPoints]);

  return {
    averageSentiment,
    nss,
    totalPosts,
    sentimentBreakdown,
    sentimentVelocity,
    volumeMetrics,
  };
}
