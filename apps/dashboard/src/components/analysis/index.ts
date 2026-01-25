/**
 * Analysis Components
 *
 * Analysis-centered UI components for the refactored dashboard.
 * These replace the chat-like conversational interface with a
 * clean, analysis-focused experience.
 */

// Main orchestrator
export { AnalysisView } from './analysis-view';

// Individual components
export { WelcomePrompt } from './welcome-prompt';
export { AnalysisHeader } from './analysis-header';
export {
  SentimentLiveChart,
  SentimentLiveChartSkeleton,
  type LiveChartDataPoint,
} from './sentiment-live-chart';
export { StatsSummary, StatsSummarySkeleton } from './stats-summary';
export { PostsSidebar, PostsSidebarSkeleton } from './posts-sidebar';
export { AnalysisPostCard } from './analysis-post-card';
export { AnalysisLoadingState } from './analysis-loading-state';
export {
  SSEConnectionBar,
  type SSEConnectionBarProps,
} from './sse-connection-bar';

// Types
export type {
  AnalysisPhase,
  LiveDataPoint,
  WelcomePromptProps,
  AnalysisHeaderProps,
  StatsSummaryProps,
  PostsSidebarProps,
  AnalysisPostCardProps,
  AnalysisViewProps,
} from './types';

// Constants
export { CHART_TIME_BUCKET_MS } from './types';
