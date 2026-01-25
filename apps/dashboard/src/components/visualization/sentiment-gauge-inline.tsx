import { cn } from '@/lib/utils';
import { getNSSDescription, getNSSColorClass } from '@/lib/sentiment-utils';

// =============================================================================
// Types
// =============================================================================

export interface SentimentGaugeInlineProps {
  /** Net Sentiment Score (-100 to +100) */
  nss: number;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Compact inline version of the sentiment gauge
 *
 * Features:
 * - Minimal footprint for inline display
 * - Color coded NSS value
 * - Description text
 * - Accessible with ARIA labels
 */
export function SentimentGaugeInline({
  nss,
  className,
}: SentimentGaugeInlineProps) {
  const description = getNSSDescription(nss);

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="img"
      aria-label={`Net Sentiment Score: ${nss}. ${description}`}
    >
      <span className={cn('text-lg font-bold', getNSSColorClass(nss))}>
        {nss > 0 ? '+' : ''}
        {nss}
      </span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </div>
  );
}
