import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize';
import { formatRelativeTime, formatFullDateTime } from '@/lib/date-utils';
import { truncateText } from '@/lib/string-utils';
import { openInNewWindow } from '@/lib/url-utils';
import { getSentimentStyles, getSentimentEmoji } from '@/lib/sentiment-utils';
import type { AnalysisPostCardProps } from './types';

// =============================================================================
// Component
// =============================================================================

/**
 * Individual post card for the sidebar
 *
 * Features:
 * - Sentiment-aware styling (border, hover, focus ring)
 * - Truncated content with ellipsis
 * - Relative timestamp
 * - Click to open source URL
 */
export function AnalysisPostCard({
  post,
  onClick,
  className,
}: AnalysisPostCardProps) {
  const styles = getSentimentStyles(post.sentimentLabel);
  const sanitizedSourceUrl = post.sourceUrl
    ? sanitizeUrl(post.sourceUrl)
    : null;
  const sanitizedText = sanitizeText(post.textContent);
  const truncatedText = truncateText(sanitizedText, 120);

  const handleOpenSource = () => {
    if (sanitizedSourceUrl) {
      openInNewWindow(sanitizedSourceUrl);
      return;
    }
    onClick?.();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpenSource}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenSource();
        }
      }}
      className={cn(
        'cursor-pointer rounded-lg border p-3 transition-all',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
        styles.focusRing,
        styles.hoverBg,
        styles.hoverBorder,
        className,
      )}
      aria-label={
        sanitizedSourceUrl
          ? `View original post on ${post.source}`
          : 'View post'
      }
    >
      {/* Author and time */}
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">@{post.authorName || 'anonymous'}</span>
        <time
          dateTime={post.publishedAt}
          title={formatFullDateTime(post.publishedAt)}
          className="cursor-help"
        >
          {formatRelativeTime(post.publishedAt)}
        </time>
      </div>

      {/* Content */}
      <p className="mb-3 text-sm leading-relaxed">{truncatedText}</p>

      {/* Sentiment badge */}
      <div className="flex items-center justify-between">
        <Badge
          variant="secondary"
          className={cn('text-xs', styles.bg, styles.text)}
        >
          {post.sentimentScore >= 0 ? '+' : ''}
          {post.sentimentScore.toFixed(2)}{' '}
          {getSentimentEmoji(post.sentimentScore)}
        </Badge>
      </div>
    </div>
  );
}
