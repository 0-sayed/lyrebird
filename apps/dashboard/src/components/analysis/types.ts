/**
 * Analysis Component Types
 *
 * Type definitions for the analysis-centered UI components.
 */

import type { SentimentDataItem } from '@/types/api';

// =============================================================================
// State Machine Types
// =============================================================================

/**
 * Analysis view follows a clear state machine:
 *
 * INITIAL -> ANALYZING -> COMPLETED
 *                     -> FAILED
 *
 * LOADING state is used when restoring a saved job from localStorage
 * before the job data has been fetched.
 *
 * User can start a new analysis from COMPLETED or FAILED states.
 */
export type AnalysisPhase =
  | { type: 'initial' }
  | { type: 'loading'; jobId: string }
  | { type: 'analyzing'; jobId: string; query: string }
  | { type: 'completed'; jobId: string; query: string }
  | { type: 'failed'; jobId: string; query: string; error: string };

// =============================================================================
// Chart Types
// =============================================================================

/**
 * Time bucket interval in milliseconds for chart aggregation.
 * Each point on the chart represents the average sentiment for posts
 * within this time window.
 *
 * Set to 1000ms (1 second) for smooth real-time updates that show
 * continuous chart movement during analysis.
 */
export const CHART_TIME_BUCKET_MS = 1000; // 1 second

/**
 * Internal data point with analysis timestamp for live chart
 * Stored as SSE events arrive, then converted to chart format
 */
export interface LiveDataPoint {
  /** The sentiment data item from the API */
  item: SentimentDataItem;
  /** Unix timestamp in milliseconds when this data point was received via SSE */
  receivedAt: number;
}

// =============================================================================
// Component Props
// =============================================================================

/**
 * Props for the welcome prompt component
 */
export interface WelcomePromptProps {
  /** Called when user submits a prompt */
  onSubmit: (query: string) => void;
  /** Whether submission is in progress */
  isLoading?: boolean;
  /** Whether the component is animating out */
  isExiting?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Props for the analysis header component
 */
export interface AnalysisHeaderProps {
  /** The search query */
  query: string;
  /** Current phase of analysis */
  phase: AnalysisPhase;
  /** Number of posts processed */
  postsProcessed?: number;
  /** Total posts to process */
  totalPosts?: number;
  /** Error message if failed */
  errorMessage?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Props for the stats summary component
 */
export interface StatsSummaryProps {
  /** Average sentiment score (-1 to +1) */
  averageSentiment: number | null;
  /** Net Sentiment Score (-100 to +100) */
  nss: number | null;
  /** Whether still processing */
  isLive?: boolean;
  /** Sentiment breakdown (positive/neutral/negative counts and percentages) */
  breakdown?: {
    positive: number;
    neutral: number;
    negative: number;
    positivePercent: number;
    neutralPercent: number;
    negativePercent: number;
  };
  /** Sentiment velocity (trend direction: positive = improving, negative = declining) */
  velocity?: number | null;
  /** Posts per minute rate (null when insufficient data for calculation) */
  postsPerMinute?: number | null;
  /** Volume trend percentage (positive = increasing, negative = decreasing) */
  volumeTrend?: number | null;
  /** Additional class names */
  className?: string;
}

/**
 * Props for the posts sidebar component
 */
export interface PostsSidebarProps {
  /** List of analyzed posts */
  posts: SentimentDataItem[];
  /** Whether sidebar is open */
  isOpen: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Selected post callback */
  onSelectPost?: (post: SentimentDataItem) => void;
  /** Currently selected post ID */
  selectedPostId?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Props for the individual post card component
 */
export interface AnalysisPostCardProps {
  /** The post data */
  post: SentimentDataItem;
  /** Whether this post is selected */
  isSelected?: boolean;
  /** Called when post is clicked */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Props for the main analysis view component
 */
export interface AnalysisViewProps {
  /** Initial job ID to load (from history) */
  initialJobId?: string;
  /** Called when a new analysis starts */
  onNewAnalysis?: (jobId: string) => void;
  /** Called when analysis completes */
  onComplete?: (jobId: string) => void;
  /** Additional class names */
  className?: string;
}
