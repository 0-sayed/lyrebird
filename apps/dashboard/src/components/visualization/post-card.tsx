import * as React from 'react';
import { ExternalLink, User, Calendar } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize';
import { formatRelativeTime, formatFullDateTime } from '@/lib/date-utils';
import { truncateText } from '@/lib/string-utils';
import {
  formatSentimentScore,
  getSentimentStyles,
} from '@/lib/sentiment-utils';
import { SentimentScoreBar } from './sentiment-score-bar';
import type { SentimentDataItem } from '@/types/api';

// =============================================================================
// Types
// =============================================================================

export interface PostCardProps {
  /** The sentiment data for the post */
  post: SentimentDataItem;
  /** Whether to show the full content or truncated */
  expanded?: boolean;
  /** Callback when expand/collapse is toggled */
  onToggleExpand?: () => void;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Individual post card displaying analyzed content with sentiment
 *
 * Features:
 * - Sentiment badge with color coding
 * - Score percentage display
 * - Sanitized content display (XSS protection)
 * - External link to original post
 * - Author information
 * - Relative timestamp
 * - Expandable/collapsible content
 */
export function PostCard({
  post,
  expanded = false,
  onToggleExpand,
  className,
}: PostCardProps) {
  const sanitizedContent = React.useMemo(
    () => sanitizeText(post.textContent),
    [post.textContent],
  );

  const sanitizedUrl = React.useMemo(
    () => (post.sourceUrl ? sanitizeUrl(post.sourceUrl) : null),
    [post.sourceUrl],
  );

  const displayContent =
    expanded || sanitizedContent.length <= 200
      ? sanitizedContent
      : truncateText(sanitizedContent, 200);

  const needsExpansion = sanitizedContent.length > 200;

  const handleOpenSource = React.useCallback(() => {
    if (!sanitizedUrl) return;
    window.open(sanitizedUrl, '_blank', 'noopener,noreferrer');
  }, [sanitizedUrl]);

  const handleCardClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (!sanitizedUrl) return;
      const target = e.target as HTMLElement | null;
      // Avoid double navigation when clicking nested interactive elements.
      if (target?.closest('button, a')) return;
      handleOpenSource();
    },
    [handleOpenSource, sanitizedUrl],
  );

  const styles = getSentimentStyles(post.sentimentLabel);

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        styles.focusVisibleRing,
        styles.hoverBg,
        styles.hoverBorder,
        sanitizedUrl && 'cursor-pointer',
        className,
      )}
      role={sanitizedUrl ? 'link' : undefined}
      tabIndex={sanitizedUrl ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (!sanitizedUrl) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenSource();
        }
      }}
      aria-label={sanitizedUrl ? `Open post on ${post.source}` : undefined}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          {/* Author info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" aria-hidden="true" />
            <span>{post.authorName ?? 'Anonymous'}</span>
          </div>

          {/* Sentiment badge */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={
                    post.sentimentLabel as 'positive' | 'neutral' | 'negative'
                  }
                  className="shrink-0"
                >
                  {post.sentimentLabel.charAt(0).toUpperCase() +
                    post.sentimentLabel.slice(1)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Sentiment Score: {formatSentimentScore(post.sentimentScore)}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        {/* Post content */}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {displayContent}
        </p>

        {/* Expand/collapse button */}
        {needsExpansion && onToggleExpand && (
          <Button
            variant="link"
            size="sm"
            className="mt-1 h-auto p-0 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        )}

        {/* Sentiment score bar */}
        <SentimentScoreBar
          score={post.sentimentScore}
          label={post.sentimentLabel}
          className="mt-3"
        />
      </CardContent>

      <CardFooter className="justify-between pt-2">
        {/* Timestamp */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                <time dateTime={post.publishedAt}>
                  {formatRelativeTime(post.publishedAt, {
                    suffix: true,
                    showYear: true,
                  })}
                </time>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{formatFullDateTime(post.publishedAt)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Source link */}
        {sanitizedUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto gap-1 p-1 text-xs"
            asChild
          >
            <a
              href={sanitizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View original post on ${post.source}`}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {post.source}
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// Re-export PostsList from common
// =============================================================================

// Re-export for backwards compatibility
export { PostsList, type PostsListProps } from '@/components/common/posts-list';

/**
 * Compact post preview for inline display
 */
export function PostPreview({
  post,
  className,
}: {
  post: SentimentDataItem;
  className?: string;
}) {
  const sanitizedContent = sanitizeText(post.textContent);
  const truncated = truncateText(sanitizedContent, 100);

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border p-2 text-xs',
        className,
      )}
    >
      <Badge
        variant={post.sentimentLabel as 'positive' | 'neutral' | 'negative'}
        className="shrink-0 text-[10px]"
      >
        {formatSentimentScore(post.sentimentScore)}
      </Badge>
      <p className="line-clamp-2 text-muted-foreground">{truncated}</p>
    </div>
  );
}
