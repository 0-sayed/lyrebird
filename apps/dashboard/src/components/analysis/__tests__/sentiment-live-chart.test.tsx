import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Time } from 'lightweight-charts';

import { render, screen } from '@/__tests__/test-utils';
import {
  SentimentLiveChart,
  type LiveChartDataPoint,
} from '../sentiment-live-chart';

// =============================================================================
// Mock lightweight-charts
// =============================================================================

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockScrollToRealTime = vi.fn();
const mockRemove = vi.fn();
const mockCreatePriceLine = vi.fn(() => ({
  applyOptions: vi.fn(),
  options: vi.fn(),
}));

const mockSeries = {
  setData: mockSetData,
  applyOptions: mockApplyOptions,
  createPriceLine: mockCreatePriceLine,
};

const mockTimeScale = {
  scrollToRealTime: mockScrollToRealTime,
};

const mockChart = {
  addSeries: vi.fn(() => mockSeries),
  applyOptions: mockApplyOptions,
  timeScale: vi.fn(() => mockTimeScale),
  remove: mockRemove,
};

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => mockChart),
  BaselineSeries: Symbol('BaselineSeries'),
  LineSeries: Symbol('LineSeries'),
  LineStyle: { Solid: 0, Dashed: 2 },
  LineType: { Curved: 2 },
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
}));

// =============================================================================
// Test Data Factory
// =============================================================================

function createMockDataPoint(
  overrides: Partial<LiveChartDataPoint> = {},
): LiveChartDataPoint {
  return {
    time: 1700000000 as Time,
    value: 0.5,
    postCount: 1,
    totalPosts: 10,
    cumulativeAverage: 0.3,
    ...overrides,
  };
}

function createMockDataPoints(count: number): LiveChartDataPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    time: (1700000000 + i * 60) as Time,
    value: (i % 2 === 0 ? 0.5 : -0.3) as number,
    postCount: 1,
    totalPosts: i + 1,
    cumulativeAverage: 0.1,
  }));
}

// =============================================================================
// Test Setup
// =============================================================================

describe('SentimentLiveChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clientWidth for chart container
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Empty State Tests
  // ===========================================================================

  describe('empty state', () => {
    it('renders empty state when data array is empty', () => {
      render(<SentimentLiveChart data={[]} />);

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('shows "Waiting for data..." message when isLive is true', () => {
      render(<SentimentLiveChart data={[]} isLive={true} />);

      expect(screen.getByText('Waiting for data...')).toBeInTheDocument();
    });

    it('shows additional hint when isLive is true', () => {
      render(<SentimentLiveChart data={[]} isLive={true} />);

      expect(
        screen.getByText('Analysis will appear as posts are processed'),
      ).toBeInTheDocument();
    });

    it('does not show additional hint when isLive is false', () => {
      render(<SentimentLiveChart data={[]} isLive={false} />);

      expect(
        screen.queryByText('Analysis will appear as posts are processed'),
      ).not.toBeInTheDocument();
    });

  });

  // ===========================================================================
  // Chart Rendering Tests
  // ===========================================================================

  describe('chart rendering', () => {
    it('renders chart container with data-testid when data exists', () => {
      render(<SentimentLiveChart data={createMockDataPoints(3)} />);

      expect(screen.getByTestId('sentiment-live-chart')).toBeInTheDocument();
    });

    it('displays post count from last data point', () => {
      const data = createMockDataPoints(5);
      render(<SentimentLiveChart data={data} />);

      expect(screen.getByText(/5 posts/)).toBeInTheDocument();
    });

    it('displays controls hint text', () => {
      render(<SentimentLiveChart data={createMockDataPoints(3)} />);

      // The text is "Scroll to zoom • Drag to pan" in one span
      expect(
        screen.getByText(/Scroll to zoom.*Drag to pan/),
      ).toBeInTheDocument();
    });

    it('displays sentiment over time label', () => {
      render(<SentimentLiveChart data={createMockDataPoints(3)} />);

      expect(screen.getByText(/Sentiment over time/)).toBeInTheDocument();
    });

    it('renders the chart legend component', () => {
      render(<SentimentLiveChart data={createMockDataPoints(3)} />);

      // Chart legend contains text about sentiment score and running average
      expect(screen.getByText('Sentiment Score')).toBeInTheDocument();
      expect(screen.getByText('Running Average')).toBeInTheDocument();
    });

    it('handles data with single point', () => {
      render(<SentimentLiveChart data={[createMockDataPoint()]} />);

      expect(screen.getByTestId('sentiment-live-chart')).toBeInTheDocument();
      expect(screen.getByText(/10 posts/)).toBeInTheDocument();
    });

    it('handles totalPosts of 0 gracefully', () => {
      const data = [createMockDataPoint({ totalPosts: 0 })];
      render(<SentimentLiveChart data={data} />);

      expect(screen.getByText(/0 posts/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Data Point Edge Cases
  // ===========================================================================

  describe('data point edge cases', () => {
    it('handles data point without cumulativeAverage', () => {
      const data = [
        {
          time: 1700000000 as Time,
          value: 0.5,
          postCount: 1,
          totalPosts: 5,
        },
      ];
      render(<SentimentLiveChart data={data} />);

      expect(screen.getByTestId('sentiment-live-chart')).toBeInTheDocument();
    });

    it('handles negative sentiment values', () => {
      const data = [createMockDataPoint({ value: -0.8 })];
      render(<SentimentLiveChart data={data} />);

      expect(screen.getByTestId('sentiment-live-chart')).toBeInTheDocument();
    });

    it('handles zero sentiment value', () => {
      const data = [createMockDataPoint({ value: 0 })];
      render(<SentimentLiveChart data={data} />);

      expect(screen.getByTestId('sentiment-live-chart')).toBeInTheDocument();
    });

    it('handles boundary sentiment values (+1)', () => {
      const data = [createMockDataPoint({ value: 1 })];
      render(<SentimentLiveChart data={data} />);

      expect(screen.getByTestId('sentiment-live-chart')).toBeInTheDocument();
    });

    it('handles boundary sentiment values (-1)', () => {
      const data = [createMockDataPoint({ value: -1 })];
      render(<SentimentLiveChart data={data} />);

      expect(screen.getByTestId('sentiment-live-chart')).toBeInTheDocument();
    });

    it('handles multiple data points with varied cumulativeAverage values', () => {
      const data = [
        createMockDataPoint({ cumulativeAverage: 0.5 }),
        createMockDataPoint({
          time: 1700000060 as Time,
          cumulativeAverage: 0.3,
        }),
        createMockDataPoint({
          time: 1700000120 as Time,
          cumulativeAverage: undefined,
        }),
      ];
      render(<SentimentLiveChart data={data} />);

      expect(screen.getByTestId('sentiment-live-chart')).toBeInTheDocument();
    });
  });
});
