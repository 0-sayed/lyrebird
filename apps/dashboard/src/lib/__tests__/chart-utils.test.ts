import { describe, expect, it } from 'vitest';

import {
  convertToLiveChartData,
  convertResultsToChartData,
  type LiveChartDataPoint,
} from '../chart-utils';
import type { LiveDataPoint } from '@/components/analysis/types';
import type { SentimentDataItem } from '@/types/api';
import { SentimentLabel } from '@/types/api';

// =============================================================================
// Test Helpers
// =============================================================================

function createSentimentDataItem(
  overrides: Partial<SentimentDataItem> = {},
): SentimentDataItem {
  return {
    id: 'test-1',
    textContent: 'test content',
    source: 'bluesky',
    sentimentScore: 0.5,
    sentimentLabel: SentimentLabel.POSITIVE,
    publishedAt: '2026-01-25T12:00:00Z',
    ...overrides,
  };
}

function createLiveDataPoint(
  item: Partial<SentimentDataItem> = {},
  receivedAt: number = Date.now(),
): LiveDataPoint {
  return {
    item: createSentimentDataItem(item),
    receivedAt,
  };
}

// =============================================================================
// convertToLiveChartData Tests
// =============================================================================

describe('convertToLiveChartData', () => {
  it('returns empty array for empty input', () => {
    expect(convertToLiveChartData([])).toEqual([]);
  });

  it('converts single data point correctly', () => {
    const dataPoints: LiveDataPoint[] = [
      createLiveDataPoint({ sentimentScore: 0.5 }, 1737806400000),
    ];

    const result = convertToLiveChartData(dataPoints);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      value: 0.5,
      postCount: 1,
      totalPosts: 1,
      cumulativeAverage: 0.5,
    });
    // Time should be in seconds (Unix timestamp)
    const firstResult = result[0]!;
    expect(typeof firstResult.time).toBe('number');
    expect(firstResult.time).toBe(Math.floor(1737806400000 / 1000));
  });

  it('aggregates multiple data points in same time bucket', () => {
    // Two points 500ms apart should be in the same 1-second bucket
    const baseTime = 1737806400000;
    const dataPoints: LiveDataPoint[] = [
      createLiveDataPoint({ id: '1', sentimentScore: 0.4 }, baseTime),
      createLiveDataPoint({ id: '2', sentimentScore: 0.6 }, baseTime + 500),
    ];

    const result = convertToLiveChartData(dataPoints);

    expect(result).toHaveLength(1);
    const firstResult = result[0]!;
    expect(firstResult.value).toBe(0.5); // Average of 0.4 and 0.6
    expect(firstResult.postCount).toBe(2);
    expect(firstResult.totalPosts).toBe(2);
  });

  it('creates separate buckets for data points in different time windows', () => {
    // Two points 2 seconds apart should be in different buckets
    const baseTime = 1737806400000;
    const dataPoints: LiveDataPoint[] = [
      createLiveDataPoint({ id: '1', sentimentScore: 0.2 }, baseTime),
      createLiveDataPoint({ id: '2', sentimentScore: 0.8 }, baseTime + 2000),
    ];

    const result = convertToLiveChartData(dataPoints);

    expect(result).toHaveLength(2);
    const [first, second] = result as [LiveChartDataPoint, LiveChartDataPoint];
    expect(first.value).toBe(0.2);
    expect(first.postCount).toBe(1);
    expect(second.value).toBe(0.8);
    expect(second.postCount).toBe(1);
    expect(second.totalPosts).toBe(2);
  });

  it('calculates cumulative average correctly across buckets', () => {
    const baseTime = 1737806400000;
    const dataPoints: LiveDataPoint[] = [
      createLiveDataPoint({ id: '1', sentimentScore: 0.0 }, baseTime),
      createLiveDataPoint({ id: '2', sentimentScore: 1.0 }, baseTime + 2000),
    ];

    const result = convertToLiveChartData(dataPoints);

    const [first, second] = result as [LiveChartDataPoint, LiveChartDataPoint];
    expect(first.cumulativeAverage).toBe(0.0);
    expect(second.cumulativeAverage).toBe(0.5); // (0.0 + 1.0) / 2
  });

  it('sorts data points by receivedAt timestamp', () => {
    const baseTime = 1737806400000;
    // Input is out of order
    const dataPoints: LiveDataPoint[] = [
      createLiveDataPoint({ id: '2', sentimentScore: 0.8 }, baseTime + 2000),
      createLiveDataPoint({ id: '1', sentimentScore: 0.2 }, baseTime),
    ];

    const result = convertToLiveChartData(dataPoints);

    expect(result).toHaveLength(2);
    // First bucket should have the earlier timestamp
    const [first, second] = result as [LiveChartDataPoint, LiveChartDataPoint];
    expect(first.value).toBe(0.2);
    expect(second.value).toBe(0.8);
  });

  it('clamps sentiment scores above 1 to 1', () => {
    const dataPoints: LiveDataPoint[] = [
      createLiveDataPoint({ sentimentScore: 1.5 }, 1737806400000),
    ];

    const result = convertToLiveChartData(dataPoints);

    expect(result[0]!.value).toBe(1);
  });

  it('clamps sentiment scores below -1 to -1', () => {
    const dataPoints: LiveDataPoint[] = [
      createLiveDataPoint({ sentimentScore: -1.5 }, 1737806400000),
    ];

    const result = convertToLiveChartData(dataPoints);

    expect(result[0]!.value).toBe(-1);
  });

  it('handles mix of clamped and normal scores in average calculation', () => {
    const baseTime = 1737806400000;
    const dataPoints: LiveDataPoint[] = [
      createLiveDataPoint({ id: '1', sentimentScore: 1.5 }, baseTime), // clamped to 1
      createLiveDataPoint({ id: '2', sentimentScore: 0.5 }, baseTime + 100),
    ];

    const result = convertToLiveChartData(dataPoints);

    expect(result[0]!.value).toBe(0.75); // (1 + 0.5) / 2
  });
});

// =============================================================================
// convertResultsToChartData Tests
// =============================================================================

describe('convertResultsToChartData', () => {
  it('returns empty array for empty input', () => {
    expect(convertResultsToChartData([])).toEqual([]);
  });

  it('converts single item correctly', () => {
    const items: SentimentDataItem[] = [
      createSentimentDataItem({
        sentimentScore: -0.3,
        publishedAt: '2026-01-25T12:00:00Z',
      }),
    ];

    const result = convertResultsToChartData(items);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      value: -0.3,
      postCount: 1,
      totalPosts: 1,
      cumulativeAverage: -0.3,
    });
  });

  it('uses publishedAt for time bucketing', () => {
    const items: SentimentDataItem[] = [
      createSentimentDataItem({
        id: '1',
        sentimentScore: 0.5,
        publishedAt: '2026-01-25T12:00:00.000Z',
      }),
      createSentimentDataItem({
        id: '2',
        sentimentScore: 0.5,
        publishedAt: '2026-01-25T12:00:02.000Z', // 2 seconds later
      }),
    ];

    const result = convertResultsToChartData(items);

    expect(result).toHaveLength(2);
  });

  it('aggregates items in same time bucket', () => {
    const items: SentimentDataItem[] = [
      createSentimentDataItem({
        id: '1',
        sentimentScore: 0.0,
        publishedAt: '2026-01-25T12:00:00.100Z',
      }),
      createSentimentDataItem({
        id: '2',
        sentimentScore: 1.0,
        publishedAt: '2026-01-25T12:00:00.500Z', // Same second
      }),
    ];

    const result = convertResultsToChartData(items);

    expect(result).toHaveLength(1);
    const firstResult = result[0]!;
    expect(firstResult.value).toBe(0.5);
    expect(firstResult.postCount).toBe(2);
  });

  it('handles items with out-of-range sentiment scores', () => {
    const items: SentimentDataItem[] = [
      createSentimentDataItem({
        sentimentScore: 2.0, // Will be clamped to 1
        publishedAt: '2026-01-25T12:00:00Z',
      }),
    ];

    const result = convertResultsToChartData(items);

    expect(result[0]!.value).toBe(1);
  });

  it('sorts items by publishedAt before aggregating', () => {
    // Input is out of order
    const items: SentimentDataItem[] = [
      createSentimentDataItem({
        id: '2',
        sentimentScore: 0.9,
        publishedAt: '2026-01-25T12:00:05.000Z',
      }),
      createSentimentDataItem({
        id: '1',
        sentimentScore: 0.1,
        publishedAt: '2026-01-25T12:00:00.000Z',
      }),
    ];

    const result = convertResultsToChartData(items);

    expect(result).toHaveLength(2);
    const [first, second] = result as [LiveChartDataPoint, LiveChartDataPoint];
    expect(first.value).toBe(0.1);
    expect(second.value).toBe(0.9);
    expect(second.cumulativeAverage).toBe(0.5);
  });

  it('handles many data points across multiple buckets', () => {
    const items: SentimentDataItem[] = [];
    const baseDate = new Date('2026-01-25T12:00:00Z');

    // Create 10 items, 1 second apart each
    for (let i = 0; i < 10; i++) {
      const date = new Date(baseDate.getTime() + i * 1000);
      items.push(
        createSentimentDataItem({
          id: `item-${i}`,
          sentimentScore: i * 0.1, // 0.0, 0.1, 0.2, ..., 0.9
          publishedAt: date.toISOString(),
        }),
      );
    }

    const result = convertResultsToChartData(items);

    expect(result).toHaveLength(10);
    expect(result[0]!.totalPosts).toBe(1);
    expect(result[9]!.totalPosts).toBe(10);
    // Cumulative average of 0+0.1+0.2+...+0.9 = 4.5 / 10 = 0.45
    expect(result[9]!.cumulativeAverage).toBeCloseTo(0.45);
  });
});

// =============================================================================
// LiveChartDataPoint Type Tests
// =============================================================================

describe('LiveChartDataPoint structure', () => {
  it('contains all required properties', () => {
    const dataPoints: LiveDataPoint[] = [
      createLiveDataPoint({ sentimentScore: 0.5 }, 1737806400000),
    ];

    const result = convertToLiveChartData(dataPoints);

    expect(result).toHaveLength(1);
    const point = result[0]!;

    expect(point).toHaveProperty('time');
    expect(point).toHaveProperty('value');
    expect(point).toHaveProperty('postCount');
    expect(point).toHaveProperty('totalPosts');
    expect(point).toHaveProperty('cumulativeAverage');
  });
});
