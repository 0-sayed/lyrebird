import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PostCard } from '@/components/visualization/post-card';
import type { SentimentDataItem } from '@/types/api';

// =============================================================================
// Types
// =============================================================================

export interface PostsListProps {
  /** Array of posts to display */
  posts: SentimentDataItem[];
  /** Maximum number of posts to show initially */
  initialLimit?: number;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * List of post cards with show more/less functionality
 *
 * Features:
 * - Initial limit with expand option
 * - Individual post expansion tracking
 * - Empty state handling
 * - Accessible list structure
 */
export function PostsList({
  posts,
  initialLimit = 5,
  className,
}: PostsListProps) {
  const [showAll, setShowAll] = React.useState(false);
  const [expandedPosts, setExpandedPosts] = React.useState<Set<string>>(
    new Set(),
  );

  const displayedPosts = showAll ? posts : posts.slice(0, initialLimit);
  const hasMore = posts.length > initialLimit;

  const togglePostExpansion = React.useCallback((postId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }, []);

  if (posts.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No posts to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Analyzed Posts ({posts.length})
        </h3>
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((prev) => !prev)}
          >
            {showAll ? 'Show less' : `Show all ${posts.length}`}
          </Button>
        )}
      </div>

      <ul className="space-y-2 list-none p-0" aria-label="Analyzed posts">
        {displayedPosts.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              expanded={expandedPosts.has(post.id)}
              onToggleExpand={() => togglePostExpansion(post.id)}
            />
          </li>
        ))}
      </ul>

      {!showAll && hasMore && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowAll(true)}
        >
          Show {posts.length - initialLimit} more posts
        </Button>
      )}
    </div>
  );
}
