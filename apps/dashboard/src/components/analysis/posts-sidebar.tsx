import * as React from 'react';
import { ChevronRight, ChevronLeft, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { SentimentLabel, type SentimentDataItem } from '@/types/api';
import { AnalysisPostCard } from './analysis-post-card';
import type { PostsSidebarProps } from './types';

type SentimentFilter = 'all' | SentimentLabel;
type SortMode = 'newest' | 'most-positive' | 'most-negative';
type ExplorerState = {
  posts: SentimentDataItem[];
  searchQuery: string;
  sentimentFilter: SentimentFilter;
  sortMode: SortMode;
  visibleCount: number;
};

const INITIAL_VISIBLE_COUNT = 25;
const VISIBLE_COUNT_INCREMENT = 25;

const sentimentFilters: Array<{
  label: string;
  value: SentimentFilter;
}> = [
  { label: 'All', value: 'all' },
  { label: 'Positive', value: SentimentLabel.POSITIVE },
  { label: 'Neutral', value: SentimentLabel.NEUTRAL },
  { label: 'Negative', value: SentimentLabel.NEGATIVE },
];

function getPublishedTime(post: SentimentDataItem) {
  const time = new Date(post.publishedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function createInitialExplorerState(posts: SentimentDataItem[]): ExplorerState {
  return {
    posts,
    searchQuery: '',
    sentimentFilter: 'all',
    sortMode: 'newest',
    visibleCount: INITIAL_VISIBLE_COUNT,
  };
}

// =============================================================================
// PostsSidebar Component
// =============================================================================

/**
 * Collapsible right sidebar showing analyzed posts
 *
 * Features:
 * - Slide-in animation
 * - Scrollable post list
 * - Collapsible with toggle button
 * - Post selection
 */
export function PostsSidebar({
  posts,
  isOpen,
  onToggle,
  onSelectPost,
  selectedPostId,
  className,
}: PostsSidebarProps) {
  const [explorerState, setExplorerState] = React.useState(() =>
    createInitialExplorerState(posts),
  );
  const activeExplorerState =
    explorerState.posts === posts
      ? explorerState
      : createInitialExplorerState(posts);
  const { searchQuery, sentimentFilter, sortMode, visibleCount } =
    activeExplorerState;

  const updateExplorerState = (
    update: (state: ExplorerState) => ExplorerState,
  ) => {
    setExplorerState((currentState) =>
      update(
        currentState.posts === posts
          ? currentState
          : createInitialExplorerState(posts),
      ),
    );
  };

  const filteredPosts = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return posts
      .map((post, index) => ({ post, index }))
      .filter(({ post }) => {
        if (
          sentimentFilter !== 'all' &&
          post.sentimentLabel !== sentimentFilter
        ) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return (
          post.textContent.toLowerCase().includes(normalizedQuery) ||
          (post.authorName?.toLowerCase().includes(normalizedQuery) ?? false)
        );
      })
      .sort((left, right) => {
        const result =
          sortMode === 'newest'
            ? getPublishedTime(right.post) - getPublishedTime(left.post)
            : sortMode === 'most-positive'
              ? right.post.sentimentScore - left.post.sentimentScore
              : left.post.sentimentScore - right.post.sentimentScore;

        return result || left.index - right.index;
      })
      .map(({ post }) => post);
  }, [posts, searchQuery, sentimentFilter, sortMode]);

  const selectedPostIndex = selectedPostId
    ? filteredPosts.findIndex((post) => post.id === selectedPostId)
    : -1;
  const visibleLimit =
    selectedPostIndex >= visibleCount ? selectedPostIndex + 1 : visibleCount;
  const visiblePosts = filteredPosts.slice(0, visibleLimit);
  const hasMorePosts = visibleLimit < filteredPosts.length;

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateExplorerState((state) => ({
      ...state,
      searchQuery: event.target.value,
      visibleCount: INITIAL_VISIBLE_COUNT,
    }));
  };

  const handleSentimentFilterChange = (filter: SentimentFilter) => {
    updateExplorerState((state) => ({
      ...state,
      sentimentFilter: filter,
      visibleCount: INITIAL_VISIBLE_COUNT,
    }));
  };

  const handleSortModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    updateExplorerState((state) => ({
      ...state,
      sortMode: event.target.value as SortMode,
      visibleCount: INITIAL_VISIBLE_COUNT,
    }));
  };

  return (
    <>
      {/* Toggle button (always visible) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className={cn(
          'fixed right-0 top-1/2 z-20 h-12 w-8 -translate-y-1/2 rounded-l-lg rounded-r-none border-0 shadow-md transition-all hover:shadow-lg',
          'bg-gradient-to-l from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
          'text-white hover:text-white',
          'dark:from-green-600 dark:to-green-700 dark:hover:from-green-700 dark:hover:to-green-800',
          isOpen && 'right-96',
        )}
        aria-label={isOpen ? 'Collapse posts sidebar' : 'Expand posts sidebar'}
      >
        {isOpen ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Sidebar panel */}
      <aside
        data-testid="posts-sidebar"
        aria-hidden={!isOpen}
        inert={isOpen ? undefined : true}
        className={cn(
          'fixed right-0 top-0 z-10 h-full w-96 border-l bg-background shadow-lg transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className,
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">Posts</h3>
            <p className="text-xs text-muted-foreground">
              {posts.length} analyzed post{posts.length !== 1 ? 's' : ''}
            </p>

            <div className="mt-3 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search posts"
                  placeholder="Search posts"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-9"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {sentimentFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    variant={
                      sentimentFilter === filter.value ? 'default' : 'outline'
                    }
                    size="sm"
                    aria-pressed={sentimentFilter === filter.value}
                    onClick={() => handleSentimentFilterChange(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>

              <select
                aria-label="Sort posts"
                value={sortMode}
                onChange={handleSortModeChange}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="newest">Newest</option>
                <option value="most-positive">Most positive</option>
                <option value="most-negative">Most negative</option>
              </select>

              {filteredPosts.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Showing {visiblePosts.length} of {filteredPosts.length}{' '}
                  matching post{filteredPosts.length === 1 ? '' : 's'}
                </p>
              ) : null}
            </div>
          </div>

          {/* Posts list */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {visiblePosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No matching posts
                </p>
              ) : (
                <div className="space-y-3">
                  {visiblePosts.map((post) => (
                    <AnalysisPostCard
                      key={post.id}
                      post={post}
                      isSelected={post.id === selectedPostId}
                      onClick={() => onSelectPost?.(post)}
                    />
                  ))}
                </div>
              )}

              {hasMorePosts ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => {
                    updateExplorerState((state) => ({
                      ...state,
                      visibleCount:
                        state.visibleCount + VISIBLE_COUNT_INCREMENT,
                    }));
                  }}
                >
                  Show more
                </Button>
              ) : null}
            </div>
          </ScrollArea>
        </div>
      </aside>
    </>
  );
}
