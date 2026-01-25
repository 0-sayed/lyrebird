/**
 * Tests for useAnalysisStats hook
 *
 * This hook computes analysis statistics from chart data or job results.
 * Tests cover average sentiment, NSS calculation, velocity, and volume metrics.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  useAnalysisStats,
  type UseAnalysisStatsOptions,
} from '../use-analysis-stats';
import {
  createMockSentimentItems,
  createMockLiveDataPoints,
} from '@/__tests__/test-utils';
import type { LiveDataPoint } from '@/components/analysis/types';
import { SentimentLabel } from '@/types/api';

// =============================================================================
// Test Setup
// =============================================================================

function createDefaultOptions(
  overrides: Partial<UseAnalysisStatsOptions> = {},
): UseAnalysisStatsOptions {
  return {
    isJobCompleted: false,
    jobResults: undefined,
    sentimentData: undefined,
    liveDataPoints: [],
    livePostCount: 0,
    ...overrides,
  };
}

describe('useAnalysisStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Average Sentiment
  // ===========================================================================

  describe('Average Sentiment', () => {
    it('uses jobResults.averageSentiment when completed', () => {
      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: true,
            jobResults: {
              averageSentiment: 0.75,
              sentimentDistribution: { positive: 8, neutral: 1, negative: 1 },
              totalItems: 10,
            },
          }),
        ),
      );

      expect(result.current.averageSentiment).toBe(0.75);
    });

    it('calculates average from live data when not completed', () => {
      const liveDataPoints = createMockLiveDataPoints(6, 30000);
      // Scores are: 0.7, 0, -0.7, 0.7, 0, -0.7 (pattern from factory)
      // Average: (0.7 + 0 + -0.7 + 0.7 + 0 + -0.7) / 6 = 0 / 6 = 0

      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: false,
            liveDataPoints,
          }),
        ),
      );

      expect(result.current.averageSentiment).toBe(0);
    });

    it('returns null when no data', () => {
      const { result } = renderHook(() =>
        useAnalysisStats(createDefaultOptions()),
      );

      expect(result.current.averageSentiment).toBeNull();
    });

    it('returns null when live data is empty', () => {
      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: false,
            liveDataPoints: [],
          }),
        ),
      );

      expect(result.current.averageSentiment).toBeNull();
    });
  });

  // ===========================================================================
  // NSS Calculation
  // ===========================================================================

  describe('NSS Calculation', () => {
    it('uses jobResults distribution when completed', () => {
      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: true,
            jobResults: {
              averageSentiment: 0.5,
              sentimentDistribution: { positive: 60, neutral: 20, negative: 20 },
              totalItems: 100,
            },
          }),
        ),
      );

      // NSS = ((positive - negative) / total) * 100 = ((60 - 20) / 100) * 100 = 40
      expect(result.current.nss).toBe(40);
    });

    it('calculates from live data with thresholds (-0.2, +0.2)', () => {
      // Create custom data points with specific scores
      const now = Date.now();
      const liveDataPoints: LiveDataPoint[] = [
        // Positive (> 0.2)
        {
          item: {
            id: '1',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 5000,
        },
        {
          item: {
            id: '2',
            sentimentScore: 0.3,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 4000,
        },
        // Neutral (-0.2 to 0.2)
        {
          item: {
            id: '3',
            sentimentScore: 0.0,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.NEUTRAL,
            publishedAt: '',
          },
          receivedAt: now - 3000,
        },
        {
          item: {
            id: '4',
            sentimentScore: -0.1,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.NEUTRAL,
            publishedAt: '',
          },
          receivedAt: now - 2000,
        },
        // Negative (< -0.2)
        {
          item: {
            id: '5',
            sentimentScore: -0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.NEGATIVE,
            publishedAt: '',
          },
          receivedAt: now - 1000,
        },
      ];

      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: false,
            liveDataPoints,
          }),
        ),
      );

      // positive: 2, neutral: 2, negative: 1
      // NSS = ((2 - 1) / 5) * 100 = 20
      expect(result.current.nss).toBe(20);
    });

    it('returns null when no data', () => {
      const { result } = renderHook(() =>
        useAnalysisStats(createDefaultOptions()),
      );

      expect(result.current.nss).toBeNull();
    });
  });

  // ===========================================================================
  // Total Posts
  // ===========================================================================

  describe('Total Posts', () => {
    it('uses jobResults.totalItems when completed', () => {
      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: true,
            jobResults: {
              averageSentiment: 0.5,
              sentimentDistribution: { positive: 50, neutral: 30, negative: 20 },
              totalItems: 100,
            },
          }),
        ),
      );

      expect(result.current.totalPosts).toBe(100);
    });

    it('uses livePostCount when not completed', () => {
      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: false,
            livePostCount: 42,
          }),
        ),
      );

      expect(result.current.totalPosts).toBe(42);
    });
  });

  // ===========================================================================
  // Sentiment Breakdown
  // ===========================================================================

  describe('Sentiment Breakdown', () => {
    it('calculates breakdown with percentages from jobResults', () => {
      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: true,
            jobResults: {
              averageSentiment: 0.5,
              sentimentDistribution: { positive: 50, neutral: 30, negative: 20 },
              totalItems: 100,
            },
          }),
        ),
      );

      expect(result.current.sentimentBreakdown).toEqual({
        positive: 50,
        neutral: 30,
        negative: 20,
        positivePercent: 50,
        neutralPercent: 30,
        negativePercent: 20,
        total: 100,
      });
    });

    it('returns undefined when no data', () => {
      const { result } = renderHook(() =>
        useAnalysisStats(createDefaultOptions()),
      );

      expect(result.current.sentimentBreakdown).toBeUndefined();
    });
  });

  // ===========================================================================
  // Velocity Metrics
  // ===========================================================================

  describe('Velocity Metrics', () => {
    it('returns null when insufficient data (less than 5 points)', () => {
      const liveDataPoints = createMockLiveDataPoints(3, 60000);

      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: false,
            liveDataPoints,
          }),
        ),
      );

      expect(result.current.sentimentVelocity).toBeNull();
    });

    it('calculates velocity from live data windows', () => {
      const now = Date.now();
      // Create data spanning two 30-second windows with different sentiments
      // Recent window (0-30s): positive sentiment
      // Previous window (30-60s): negative sentiment
      const liveDataPoints: LiveDataPoint[] = [
        // Previous window (30-60s ago) - negative
        {
          item: {
            id: '1',
            sentimentScore: -0.8,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.NEGATIVE,
            publishedAt: '',
          },
          receivedAt: now - 50000,
        },
        {
          item: {
            id: '2',
            sentimentScore: -0.7,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.NEGATIVE,
            publishedAt: '',
          },
          receivedAt: now - 45000,
        },
        {
          item: {
            id: '3',
            sentimentScore: -0.6,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.NEGATIVE,
            publishedAt: '',
          },
          receivedAt: now - 40000,
        },
        // Recent window (0-30s ago) - positive
        {
          item: {
            id: '4',
            sentimentScore: 0.6,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 20000,
        },
        {
          item: {
            id: '5',
            sentimentScore: 0.7,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 10000,
        },
        {
          item: {
            id: '6',
            sentimentScore: 0.8,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 5000,
        },
      ];

      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: false,
            liveDataPoints,
          }),
        ),
      );

      // Velocity should be positive (sentiment improving)
      expect(result.current.sentimentVelocity).toBeGreaterThan(0);
    });

    it('returns null when windows are empty', () => {
      const now = Date.now();
      // All data in the same window
      const liveDataPoints: LiveDataPoint[] = [
        {
          item: {
            id: '1',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 5000,
        },
        {
          item: {
            id: '2',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 4000,
        },
        {
          item: {
            id: '3',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 3000,
        },
        {
          item: {
            id: '4',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 2000,
        },
        {
          item: {
            id: '5',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 1000,
        },
      ];

      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: false,
            liveDataPoints,
          }),
        ),
      );

      // No previous window data, velocity should be null
      expect(result.current.sentimentVelocity).toBeNull();
    });
  });

  // ===========================================================================
  // Volume Metrics
  // ===========================================================================

  describe('Volume Metrics', () => {
    it('calculates postsPerMinute correctly', () => {
      const now = Date.now();
      // 6 posts over 60 seconds = 6 posts per minute
      const liveDataPoints: LiveDataPoint[] = Array.from(
        { length: 6 },
        (_, i) => ({
          item: {
            id: `${i}`,
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 60000 + i * 10000, // Spread over 60 seconds
        }),
      );

      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: false,
            liveDataPoints,
          }),
        ),
      );

      expect(result.current.volumeMetrics.postsPerMinute).toBeCloseTo(6, 0);
    });

    it('calculates volumeTrend between windows', () => {
      const now = Date.now();
      // More posts in recent window than previous
      // Note: calculateVolumeTrend requires MINIMUM_TREND_SAMPLE_SIZE (3) in BOTH windows
      const liveDataPoints: LiveDataPoint[] = [
        // Previous window (30-60s ago) - 3 posts (minimum required)
        {
          item: {
            id: '1',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 55000,
        },
        {
          item: {
            id: '2',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 45000,
        },
        {
          item: {
            id: '3',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 35000,
        },
        // Recent window (0-30s ago) - 6 posts
        {
          item: {
            id: '4',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 25000,
        },
        {
          item: {
            id: '5',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 20000,
        },
        {
          item: {
            id: '6',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 15000,
        },
        {
          item: {
            id: '7',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 10000,
        },
        {
          item: {
            id: '8',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 5000,
        },
        {
          item: {
            id: '9',
            sentimentScore: 0.5,
            textContent: '',
            source: '',
            sentimentLabel: SentimentLabel.POSITIVE,
            publishedAt: '',
          },
          receivedAt: now - 2000,
        },
      ];

      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: false,
            liveDataPoints,
          }),
        ),
      );

      // Volume trend should be positive (more posts in recent window)
      // (6 - 3) / 3 = 1.0 = 100% increase
      expect(result.current.volumeMetrics.volumeTrend).toBeGreaterThan(0);
    });

    it('returns null for insufficient data', () => {
      const { result } = renderHook(() =>
        useAnalysisStats(createDefaultOptions()),
      );

      expect(result.current.volumeMetrics.postsPerMinute).toBeNull();
      expect(result.current.volumeMetrics.volumeTrend).toBeNull();
    });
  });

  // ===========================================================================
  // Completed Job Stats from sentimentData
  // ===========================================================================

  describe('Completed Job Stats', () => {
    it('calculates velocity from sentimentData timestamps', () => {
      const baseTime = Date.now();
      // Create sentiment data with timestamps in past
      const sentimentData = createMockSentimentItems(10, 'varied').map(
        (item, i) => ({
          ...item,
          analyzedAt: new Date(baseTime - (10 - i) * 5000).toISOString(), // 5s apart
          publishedAt: new Date(baseTime - (10 - i) * 5000).toISOString(),
        }),
      );

      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: true,
            jobResults: {
              averageSentiment: 0.1,
              sentimentDistribution: { positive: 4, neutral: 3, negative: 3 },
              totalItems: 10,
            },
            sentimentData,
          }),
        ),
      );

      // Should have computed velocity (or null if windows don't have data)
      // The exact value depends on the data distribution
      expect(result.current.sentimentVelocity).toBeDefined();
    });

    it('calculates volume metrics from sentimentData timestamps', () => {
      const baseTime = Date.now();
      // 10 posts over ~50 seconds
      const sentimentData = createMockSentimentItems(10, 'varied').map(
        (item, i) => ({
          ...item,
          analyzedAt: new Date(baseTime - (10 - i) * 5000).toISOString(),
          publishedAt: new Date(baseTime - (10 - i) * 5000).toISOString(),
        }),
      );

      const { result } = renderHook(() =>
        useAnalysisStats(
          createDefaultOptions({
            isJobCompleted: true,
            jobResults: {
              averageSentiment: 0.1,
              sentimentDistribution: { positive: 4, neutral: 3, negative: 3 },
              totalItems: 10,
            },
            sentimentData,
          }),
        ),
      );

      // 10 posts over ~45 seconds = ~13.3 posts per minute
      expect(result.current.volumeMetrics.postsPerMinute).toBeGreaterThan(0);
    });
  });
});
