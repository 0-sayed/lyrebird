import { cn } from '@/lib/utils';
import {
  formatSentimentScore,
  getSentimentColorClass,
} from '@/lib/sentiment-utils';
import type { SentimentLabel } from '@/types/api';

// =============================================================================
// Types
// =============================================================================

export interface SentimentScoreBarProps {
  /** Sentiment score from -1 to +1 */
  score: number;
  /** Sentiment label for color coding */
  label: SentimentLabel;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Inline sentiment score bar with percentage fill
 *
 * Features:
 * - Visual bar showing score position from -1 to +1
 * - Color coded by sentiment label
 * - Formatted score display
 */
export function SentimentScoreBar({
  score,
  label,
  className,
}: SentimentScoreBarProps) {
  // Convert -1 to +1 scale to 0% to 100%
  const percentage = ((score + 1) / 2) * 100;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all duration-300',
            label === 'positive' && 'bg-green-500',
            label === 'neutral' && 'bg-gray-400',
            label === 'negative' && 'bg-red-500',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span
        className={cn('text-xs font-medium', getSentimentColorClass(label))}
      >
        {formatSentimentScore(score)}
      </span>
    </div>
  );
}
