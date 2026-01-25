/* eslint-disable react-refresh/only-export-components */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

import { ThemeProvider } from '@/providers/theme-provider';
import { JobStatus, SentimentLabel, type SentimentDataItem } from '@/types/api';
import type { LiveDataPoint } from '@/components/analysis/types';

// =============================================================================
// Query Client Factory
// =============================================================================

/**
 * Creates a fresh QueryClient for each test to prevent state leakage
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// =============================================================================
// Provider Wrapper
// =============================================================================

interface WrapperProps {
  children: ReactNode;
}

/**
 * All providers wrapper for testing
 */
function AllProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="test-theme">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Custom render function that wraps components with all necessary providers
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// =============================================================================
// Mock Data Factories
// =============================================================================

let mockIdCounter = 0;

/**
 * Generates a unique mock ID
 */
export function generateMockId(prefix = 'mock'): string {
  mockIdCounter += 1;
  return `${prefix}-${mockIdCounter}`;
}

/**
 * Resets the mock ID counter (call in beforeEach for deterministic IDs)
 */
export function resetMockIdCounter(): void {
  mockIdCounter = 0;
}

/**
 * Creates a mock sentiment data item with sensible defaults
 */
export function createMockSentimentItem(
  overrides: Partial<SentimentDataItem> = {},
): SentimentDataItem {
  const id = overrides.id ?? generateMockId('item');
  const score = overrides.sentimentScore ?? 0.5;
  const label =
    overrides.sentimentLabel ??
    (score > 0.1
      ? SentimentLabel.POSITIVE
      : score < -0.1
        ? SentimentLabel.NEGATIVE
        : SentimentLabel.NEUTRAL);

  return {
    id,
    textContent: `Mock post content ${id}`,
    source: 'bluesky',
    sourceUrl: `https://bsky.app/profile/test/post/${id}`,
    authorName: 'testuser.bsky.social',
    sentimentScore: score,
    sentimentLabel: label,
    publishedAt: new Date().toISOString(),
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock live data point with receivedAt timestamp
 */
export function createMockLiveDataPoint(
  overrides: Partial<SentimentDataItem> = {},
  receivedAt: number = Date.now(),
): LiveDataPoint {
  return {
    item: createMockSentimentItem(overrides),
    receivedAt,
  };
}

/**
 * Creates an array of mock sentiment items with varied scores
 */
export function createMockSentimentItems(
  count: number,
  scoreDistribution?: 'varied' | 'positive' | 'negative' | 'neutral',
): SentimentDataItem[] {
  return Array.from({ length: count }, (_, i) => {
    let score: number;
    switch (scoreDistribution) {
      case 'positive':
        score = 0.3 + Math.random() * 0.7; // 0.3 to 1.0
        break;
      case 'negative':
        score = -0.3 - Math.random() * 0.7; // -0.3 to -1.0
        break;
      case 'neutral':
        score = -0.1 + Math.random() * 0.2; // -0.1 to 0.1
        break;
      default:
        // Varied: cycle through positive, neutral, negative
        score = i % 3 === 0 ? 0.7 : i % 3 === 1 ? 0 : -0.7;
    }
    return createMockSentimentItem({
      id: `item-${i}`,
      sentimentScore: score,
      publishedAt: new Date(Date.now() - (count - i) * 1000).toISOString(),
      analyzedAt: new Date(Date.now() - (count - i) * 1000).toISOString(),
    });
  });
}

/**
 * Creates an array of mock live data points with timestamps spread over a duration
 */
export function createMockLiveDataPoints(
  count: number,
  durationMs: number = 60000,
): LiveDataPoint[] {
  const now = Date.now();
  const interval = durationMs / count;

  return Array.from({ length: count }, (_, i) => {
    const receivedAt = now - durationMs + i * interval;
    const score = i % 3 === 0 ? 0.7 : i % 3 === 1 ? 0 : -0.7;
    return createMockLiveDataPoint(
      {
        id: `live-${i}`,
        sentimentScore: score,
        publishedAt: new Date(receivedAt).toISOString(),
        analyzedAt: new Date(receivedAt).toISOString(),
      },
      receivedAt,
    );
  });
}

/**
 * Creates a mock job object
 */
export function createMockJob(
  overrides: Partial<{
    jobId: string;
    status: JobStatus;
    prompt: string;
    createdAt: string;
    averageSentiment: number;
    dataPointsCount: number;
    completedAt: string;
  }> = {},
) {
  return {
    jobId: generateMockId('job'),
    status: JobStatus.PENDING,
    prompt: 'test analysis prompt',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock job results object
 */
export function createMockJobResults(
  overrides: Partial<{
    job: ReturnType<typeof createMockJob>;
    sentimentDistribution: {
      positive: number;
      neutral: number;
      negative: number;
    };
    data: SentimentDataItem[];
    totalItems: number;
    averageSentiment: number | null;
  }> = {},
) {
  const data = overrides.data ?? createMockSentimentItems(5, 'varied');
  return {
    job: overrides.job ?? createMockJob({ status: JobStatus.COMPLETED }),
    sentimentDistribution: overrides.sentimentDistribution ?? {
      positive: 2,
      neutral: 2,
      negative: 1,
    },
    data,
    totalItems: overrides.totalItems ?? data.length,
    averageSentiment: overrides.averageSentiment ?? 0.1,
  };
}

// =============================================================================
// Exports
// =============================================================================

// Re-export select items from testing-library (render is overridden below)
export {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
  act,
  renderHook,
} from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';

// Override render with custom render
export { customRender as render };
