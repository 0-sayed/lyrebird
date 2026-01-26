/**
 * Application constants
 */

/**
 * API base URL - defaults to relative /api for same-origin requests
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/**
 * Query key factory for consistent cache key management
 */
export const queryKeys = {
  jobs: {
    all: ['jobs'] as const,
    lists: () => [...queryKeys.jobs.all, 'list'] as const,
    list: (params: { page?: number; limit?: number }) =>
      [...queryKeys.jobs.lists(), params] as const,
    details: () => [...queryKeys.jobs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.jobs.details(), id] as const,
    results: (id: string) => [...queryKeys.jobs.detail(id), 'results'] as const,
  },
} as const;

/**
 * Default query options
 */
export const DEFAULT_QUERY_OPTIONS = {
  staleTime: 60_000, // 1 minute
  gcTime: 300_000, // 5 minutes
  retry: 2,
  refetchOnWindowFocus: false,
} as const;

/**
 * SSE reconnection settings
 */
export const SSE_CONFIG = {
  /** Initial reconnection delay in ms */
  initialReconnectDelay: 1000,
  /** Maximum reconnection delay in ms */
  maxReconnectDelay: 30000,
  /** Multiplier for exponential backoff */
  reconnectMultiplier: 2,
  /** Maximum number of reconnection attempts */
  maxReconnectAttempts: 10,
} as const;

/**
 * Theme constants
 */
export const THEME_STORAGE_KEY = 'lyrebird-theme';
export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

/**
 * UI persistence storage keys
 * Used to remember user's UI preferences across sessions
 */
export const STORAGE_KEYS = {
  /** Last opened job ID */
  LAST_JOB_ID: 'lyrebird-last-job-id',
  /** Posts sidebar open/closed state */
  POSTS_SIDEBAR_OPEN: 'lyrebird-posts-sidebar-open',
} as const;

/**
 * Sentiment score thresholds for -1 to +1 scale
 * Industry standard: VADER, TextBlob, HuggingFace all use -1 to +1
 */
export const SENTIMENT_THRESHOLDS = {
  /** Score below this is negative (< -0.1) */
  negative: -0.1,
  /** Score above this is positive (> 0.1), between is neutral */
  positive: 0.1,
} as const;
