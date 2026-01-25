import { CheckCircle2, Loader2, XCircle, AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AnalysisHeaderProps } from './types';

// =============================================================================
// Component
// =============================================================================

/**
 * Header showing the analysis query, status, and post count
 *
 * Displays:
 * - Query text
 * - Status indicator (spinner, check, error icon)
 * - Post count
 */
export function AnalysisHeader({
  query,
  phase,
  postsProcessed = 0,
  totalPosts,
  errorMessage,
  className,
}: AnalysisHeaderProps) {
  const isAnalyzing = phase.type === 'analyzing';
  const isCompleted = phase.type === 'completed';
  const isFailed = phase.type === 'failed';

  return (
    <div
      className={cn(
        'animate-chart-fade-in border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className,
      )}
    >
      <div className="mx-auto max-w-5xl">
        {/* Query and status */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <StatusIcon phase={phase} />
              <span className="text-sm font-medium text-muted-foreground">
                {isAnalyzing && 'Analyzing'}
                {isCompleted && 'Analysis complete'}
                {isFailed && 'Analysis failed'}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-semibold truncate">
              &ldquo;{query}&rdquo;
            </h2>
          </div>

          {/* Post count badge */}
          <div className="flex-shrink-0 rounded-lg border bg-card px-4 py-2 text-center">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Posts
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {postsProcessed}
              {totalPosts && (
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}
                  / {totalPosts}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {isFailed && errorMessage && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Status icon based on phase
 */
function StatusIcon({ phase }: { phase: AnalysisHeaderProps['phase'] }) {
  switch (phase.type) {
    case 'analyzing':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return null;
  }
}
