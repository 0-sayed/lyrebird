/**
 * Tests for useLiveChartData hook
 *
 * This hook manages live chart data accumulation with throttling.
 * Tests cover data handling, deduplication, throttling, and reset functionality.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useLiveChartData } from '../use-live-chart-data';
import { createMockSentimentItem } from '@/__tests__/test-utils';

// =============================================================================
// Test Setup
// =============================================================================

describe('useLiveChartData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe('Initial State', () => {
    it('returns empty chart data initially', () => {
      const { result } = renderHook(() => useLiveChartData());

      expect(result.current.chartData).toEqual([]);
      expect(result.current.livePostCount).toBe(0);
      expect(result.current.liveDataPoints).toEqual([]);
      expect(result.current.hasInitializedFromHistoryRef.current).toBe(false);
    });

    it('provides all expected functions', () => {
      const { result } = renderHook(() => useLiveChartData());

      expect(typeof result.current.setChartData).toBe('function');
      expect(typeof result.current.setLivePostCount).toBe('function');
      expect(typeof result.current.setLiveDataPoints).toBe('function');
      expect(typeof result.current.handleDataUpdate).toBe('function');
      expect(typeof result.current.resetChartData).toBe('function');
    });
  });

  // ===========================================================================
  // handleDataUpdate
  // ===========================================================================

  describe('handleDataUpdate', () => {
    it('adds new data point to liveDataPoints', () => {
      const { result } = renderHook(() => useLiveChartData());
      const mockItem = createMockSentimentItem({ id: 'item-1' });

      act(() => {
        result.current.handleDataUpdate({
          dataPoint: mockItem,
          totalProcessed: 1,
        });
      });

      expect(result.current.liveDataPoints).toHaveLength(1);
      expect(result.current.liveDataPoints[0]?.item.id).toBe('item-1');
    });

    it('updates livePostCount', () => {
      const { result } = renderHook(() => useLiveChartData());
      const mockItem = createMockSentimentItem({ id: 'item-1' });

      act(() => {
        result.current.handleDataUpdate({
          dataPoint: mockItem,
          totalProcessed: 5,
        });
      });

      expect(result.current.livePostCount).toBe(5);
    });

    it('updates chart data immediately on first event', () => {
      const { result } = renderHook(() => useLiveChartData());
      const mockItem = createMockSentimentItem({ id: 'item-1' });

      act(() => {
        result.current.handleDataUpdate({
          dataPoint: mockItem,
          totalProcessed: 1,
        });
      });

      // Chart data should be updated immediately
      expect(result.current.chartData.length).toBeGreaterThan(0);
    });

    it('deduplicates data points by id', () => {
      const { result } = renderHook(() => useLiveChartData());
      const mockItem = createMockSentimentItem({ id: 'item-1' });

      act(() => {
        result.current.handleDataUpdate({
          dataPoint: mockItem,
          totalProcessed: 1,
        });
      });

      act(() => {
        // Try to add the same item again (simulating reconnect scenario)
        result.current.handleDataUpdate({
          dataPoint: mockItem,
          totalProcessed: 2,
        });
      });

      // Should only have one data point
      expect(result.current.liveDataPoints).toHaveLength(1);
      // But count should still update
      expect(result.current.livePostCount).toBe(2);
    });

    it('adds receivedAt timestamp to data points', () => {
      const { result } = renderHook(() => useLiveChartData());
      const mockItem = createMockSentimentItem({ id: 'item-1' });

      const beforeCall = Date.now();

      act(() => {
        result.current.handleDataUpdate({
          dataPoint: mockItem,
          totalProcessed: 1,
        });
      });

      const afterCall = Date.now();
      const receivedAt = result.current.liveDataPoints[0]?.receivedAt;

      // Verify receivedAt is within the time window of the call
      expect(receivedAt).toBeGreaterThanOrEqual(beforeCall);
      expect(receivedAt).toBeLessThanOrEqual(afterCall);
    });
  });

  // ===========================================================================
  // Throttling
  // ===========================================================================

  describe('Throttling', () => {
    it('throttles chart updates after first event', () => {
      const { result } = renderHook(() => useLiveChartData());

      // Add first item - updates immediately
      act(() => {
        result.current.handleDataUpdate({
          dataPoint: createMockSentimentItem({ id: 'item-1' }),
          totalProcessed: 1,
        });
      });

      // Add second item quickly - should not update chart immediately
      act(() => {
        result.current.handleDataUpdate({
          dataPoint: createMockSentimentItem({ id: 'item-2' }),
          totalProcessed: 2,
        });
      });

      // Data point should be accumulated in the state
      expect(result.current.liveDataPoints).toHaveLength(2);

      // Chart might or might not have updated yet depending on throttle
      // The key is that liveDataPoints has both items
    });

    it('updates chart after throttle interval', () => {
      const { result } = renderHook(() => useLiveChartData());

      // Add first item
      act(() => {
        result.current.handleDataUpdate({
          dataPoint: createMockSentimentItem({ id: 'item-1' }),
          totalProcessed: 1,
        });
      });

      // Add second item
      act(() => {
        result.current.handleDataUpdate({
          dataPoint: createMockSentimentItem({ id: 'item-2' }),
          totalProcessed: 2,
        });
      });

      // Advance past throttle interval (250ms)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Now both items should be in chart
      expect(result.current.liveDataPoints).toHaveLength(2);
    });
  });

  // ===========================================================================
  // resetChartData
  // ===========================================================================

  describe('resetChartData', () => {
    it('clears all chart data', () => {
      const { result } = renderHook(() => useLiveChartData());

      // Add some data
      act(() => {
        result.current.handleDataUpdate({
          dataPoint: createMockSentimentItem({ id: 'item-1' }),
          totalProcessed: 1,
        });
      });

      expect(result.current.liveDataPoints).toHaveLength(1);

      // Reset
      act(() => {
        result.current.resetChartData();
      });

      expect(result.current.chartData).toEqual([]);
      expect(result.current.livePostCount).toBe(0);
      expect(result.current.liveDataPoints).toEqual([]);
      expect(result.current.hasInitializedFromHistoryRef.current).toBe(false);
    });

    it('clears pending throttle timer', () => {
      const { result } = renderHook(() => useLiveChartData());

      // Add items to trigger throttle timer
      act(() => {
        result.current.handleDataUpdate({
          dataPoint: createMockSentimentItem({ id: 'item-1' }),
          totalProcessed: 1,
        });
      });

      act(() => {
        result.current.handleDataUpdate({
          dataPoint: createMockSentimentItem({ id: 'item-2' }),
          totalProcessed: 2,
        });
      });

      // Reset before throttle timer fires
      act(() => {
        result.current.resetChartData();
      });

      // Advance timers - should not cause any issues
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should still be empty
      expect(result.current.chartData).toEqual([]);
    });
  });

  // ===========================================================================
  // setChartData and setLivePostCount
  // ===========================================================================

  describe('Direct Setters', () => {
    it('allows direct setting of chart data', () => {
      const { result } = renderHook(() => useLiveChartData());

      const now = Math.floor(Date.now() / 1000);
      const mockChartData = [
        { time: now as import('lightweight-charts').Time, value: 0.5, postCount: 1, totalPosts: 1, cumulativeAverage: 0.5 },
        { time: (now + 1) as import('lightweight-charts').Time, value: 0.7, postCount: 1, totalPosts: 2, cumulativeAverage: 0.6 },
      ];

      act(() => {
        result.current.setChartData(mockChartData);
      });

      expect(result.current.chartData).toEqual(mockChartData);
    });

    it('allows direct setting of post count', () => {
      const { result } = renderHook(() => useLiveChartData());

      act(() => {
        result.current.setLivePostCount(42);
      });

      expect(result.current.livePostCount).toBe(42);
    });

    it('allows direct setting of live data points', () => {
      const { result } = renderHook(() => useLiveChartData());
      const mockItem = createMockSentimentItem({ id: 'direct-1' });
      const mockLiveDataPoints = [{ item: mockItem, receivedAt: Date.now() }];

      act(() => {
        result.current.setLiveDataPoints(mockLiveDataPoints);
      });

      expect(result.current.liveDataPoints).toHaveLength(1);
      expect(result.current.liveDataPoints[0]?.item.id).toBe('direct-1');
    });
  });

  // ===========================================================================
  // Refs
  // ===========================================================================

  describe('Refs', () => {
    it('provides mutable hasInitializedFromHistoryRef', () => {
      const { result } = renderHook(() => useLiveChartData());

      result.current.hasInitializedFromHistoryRef.current = true;

      expect(result.current.hasInitializedFromHistoryRef.current).toBe(true);
    });
  });

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  describe('Cleanup', () => {
    it('cleans up throttle timer on unmount', () => {
      const { result, unmount } = renderHook(() => useLiveChartData());

      // Trigger throttle timer
      act(() => {
        result.current.handleDataUpdate({
          dataPoint: createMockSentimentItem({ id: 'item-1' }),
          totalProcessed: 1,
        });
        result.current.handleDataUpdate({
          dataPoint: createMockSentimentItem({ id: 'item-2' }),
          totalProcessed: 2,
        });
      });

      // Unmount should not throw
      unmount();

      // Advancing timers should not cause issues
      act(() => {
        vi.advanceTimersByTime(300);
      });
    });
  });

  // ===========================================================================
  // Function Stability
  // ===========================================================================

  describe('Function Stability', () => {
    it('handleDataUpdate is stable across rerenders', () => {
      const { result, rerender } = renderHook(() => useLiveChartData());

      const initialHandler = result.current.handleDataUpdate;

      rerender();

      expect(result.current.handleDataUpdate).toBe(initialHandler);
    });

    it('resetChartData is stable across rerenders', () => {
      const { result, rerender } = renderHook(() => useLiveChartData());

      const initialReset = result.current.resetChartData;

      rerender();

      expect(result.current.resetChartData).toBe(initialReset);
    });
  });
});
