import * as React from 'react';

import type { LiveChartDataPoint } from '@/components/analysis/sentiment-live-chart';
import type { LiveDataPoint } from '@/components/analysis/types';
import { convertToLiveChartData } from '@/lib/chart-utils';

// =============================================================================
// Constants
// =============================================================================

/**
 * Chart update throttle interval in milliseconds.
 *
 * Set to 250ms for smooth, continuous chart animation:
 * - Fast enough to appear fluid (4 updates per second)
 * - Slow enough to avoid excessive React re-renders
 * - Balances responsiveness with performance
 */
const CHART_UPDATE_THROTTLE_MS = 250;

// =============================================================================
// Types
// =============================================================================

export interface UseLiveChartDataReturn {
  /** Chart data in LiveChartDataPoint format */
  chartData: LiveChartDataPoint[];
  /** Set chart data directly */
  setChartData: React.Dispatch<React.SetStateAction<LiveChartDataPoint[]>>;
  /** Number of posts processed (from SSE) */
  livePostCount: number;
  /** Set live post count */
  setLivePostCount: React.Dispatch<React.SetStateAction<number>>;
  /** Accumulated live data points (state version for stats computation) */
  liveDataPoints: LiveDataPoint[];
  /** Set live data points directly (for historical data initialization) */
  setLiveDataPoints: React.Dispatch<React.SetStateAction<LiveDataPoint[]>>;
  /** Reference to track if initialized from history */
  hasInitializedFromHistoryRef: React.MutableRefObject<boolean>;
  /** Handle incoming SSE data point */
  handleDataUpdate: (data: {
    dataPoint: LiveDataPoint['item'];
    totalProcessed: number;
  }) => void;
  /** Reset all chart data for a new job */
  resetChartData: () => void;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Manages live chart data accumulation with throttling
 *
 * Features:
 * - SSE data accumulation
 * - Throttled chart updates (250ms)
 * - Deduplication of data points
 * - Reset functionality for new jobs
 */
export function useLiveChartData(): UseLiveChartDataReturn {
  // Chart data in the new LiveChartDataPoint format
  const [chartData, setChartData] = React.useState<LiveChartDataPoint[]>([]);
  const [livePostCount, setLivePostCount] = React.useState(0);

  // Accumulated live data points (state for stats, updated with chart data)
  const [liveDataPoints, setLiveDataPoints] = React.useState<LiveDataPoint[]>(
    [],
  );

  // Track if we've already initialized from historical data
  const hasInitializedFromHistoryRef = React.useRef(false);

  // Throttle timer ref for chart updates
  const chartUpdateTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const pendingUpdateRef = React.useRef<LiveDataPoint[] | null>(null);

  // Cleanup throttle timer on unmount
  React.useEffect(() => {
    return () => {
      if (chartUpdateTimerRef.current) {
        clearTimeout(chartUpdateTimerRef.current);
        chartUpdateTimerRef.current = null;
      }
    };
  }, []);

  // Handle incoming SSE data point
  const handleDataUpdate = React.useCallback(
    (data: { dataPoint: LiveDataPoint['item']; totalProcessed: number }) => {
      setLiveDataPoints((prev) => {
        // Skip if this data point already exists (deduplication for reconnects)
        if (prev.some((p) => p.item.id === data.dataPoint.id)) {
          setLivePostCount(data.totalProcessed);
          return prev;
        }

        // Accumulate new data points with the current timestamp (analysis time)
        const liveDataPoint: LiveDataPoint = {
          item: data.dataPoint,
          receivedAt: Date.now(),
        };
        const newPoints = [...prev, liveDataPoint];
        setLivePostCount(data.totalProcessed);

        // Throttle chart updates
        pendingUpdateRef.current = newPoints;

        if (!chartUpdateTimerRef.current) {
          // First event - update chart immediately for responsiveness
          setChartData(convertToLiveChartData(newPoints));
          pendingUpdateRef.current = null;

          // Set up throttle timer for subsequent chart updates
          chartUpdateTimerRef.current = setTimeout(() => {
            chartUpdateTimerRef.current = null;
            if (pendingUpdateRef.current) {
              setChartData(convertToLiveChartData(pendingUpdateRef.current));
              pendingUpdateRef.current = null;
            }
          }, CHART_UPDATE_THROTTLE_MS);
        }

        return newPoints;
      });
    },
    [],
  );

  // Reset all chart data for a new job
  const resetChartData = React.useCallback(() => {
    setChartData([]);
    setLivePostCount(0);
    setLiveDataPoints([]);
    hasInitializedFromHistoryRef.current = false;
    if (chartUpdateTimerRef.current) {
      clearTimeout(chartUpdateTimerRef.current);
      chartUpdateTimerRef.current = null;
    }
    pendingUpdateRef.current = null;
  }, []);

  return {
    chartData,
    setChartData,
    livePostCount,
    setLivePostCount,
    liveDataPoints,
    setLiveDataPoints,
    hasInitializedFromHistoryRef,
    handleDataUpdate,
    resetChartData,
  };
}
