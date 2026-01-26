import { ChevronRight, ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AnalysisPostCard } from './analysis-post-card';
import type { PostsSidebarProps } from './types';

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
          </div>

          {/* Posts list */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              <div className="space-y-3">
                {posts.map((post) => (
                  <AnalysisPostCard
                    key={post.id}
                    post={post}
                    isSelected={post.id === selectedPostId}
                    onClick={() => onSelectPost?.(post)}
                  />
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>
      </aside>
    </>
  );
}

