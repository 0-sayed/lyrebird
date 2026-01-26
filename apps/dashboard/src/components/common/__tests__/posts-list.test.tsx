import { describe, expect, it } from 'vitest';

import { PostsList } from '../posts-list';
import {
  render,
  screen,
  within,
  userEvent,
  createMockSentimentItem,
  createMockSentimentItems,
} from '@/__tests__/test-utils';

// =============================================================================
// Test Data
// =============================================================================

function createPosts(count: number) {
  return createMockSentimentItems(count, 'varied');
}

// =============================================================================
// Tests
// =============================================================================

describe('PostsList', () => {
  // ===========================================================================
  // Rendering
  // ===========================================================================

  describe('rendering', () => {
    it('renders empty state when no posts', () => {
      render(<PostsList posts={[]} />);

      expect(screen.getByText('No posts to display')).toBeInTheDocument();
    });

    it('renders post count in header', () => {
      const posts = createPosts(3);

      render(<PostsList posts={posts} />);

      expect(screen.getByText('Analyzed Posts (3)')).toBeInTheDocument();
    });

    it('renders posts as list items', () => {
      const posts = createPosts(3);

      render(<PostsList posts={posts} />);

      const list = screen.getByRole('list', { name: 'Analyzed posts' });
      const items = within(list).getAllByRole('listitem');

      expect(items).toHaveLength(3);
    });

  });

  // ===========================================================================
  // Initial Limit and Show More
  // ===========================================================================

  describe('initial limit and show more', () => {
    it('shows only initialLimit posts by default', () => {
      const posts = createPosts(10);

      render(<PostsList posts={posts} initialLimit={5} />);

      const list = screen.getByRole('list', { name: 'Analyzed posts' });
      const items = within(list).getAllByRole('listitem');

      expect(items).toHaveLength(5);
    });

    it('uses default initialLimit of 5', () => {
      const posts = createPosts(10);

      render(<PostsList posts={posts} />);

      const list = screen.getByRole('list', { name: 'Analyzed posts' });
      const items = within(list).getAllByRole('listitem');

      expect(items).toHaveLength(5);
    });

    it('shows "Show all N" button when more posts available', () => {
      const posts = createPosts(10);

      render(<PostsList posts={posts} initialLimit={5} />);

      expect(
        screen.getByRole('button', { name: 'Show all 10' }),
      ).toBeInTheDocument();
    });

    it('shows "Show N more posts" button at bottom', () => {
      const posts = createPosts(10);

      render(<PostsList posts={posts} initialLimit={5} />);

      expect(
        screen.getByRole('button', { name: 'Show 5 more posts' }),
      ).toBeInTheDocument();
    });

    it('does not show "Show all" button when posts count equals limit', () => {
      const posts = createPosts(5);

      render(<PostsList posts={posts} initialLimit={5} />);

      expect(
        screen.queryByRole('button', { name: /Show all/ }),
      ).not.toBeInTheDocument();
    });

    it('does not show "Show all" button when posts count is less than limit', () => {
      const posts = createPosts(3);

      render(<PostsList posts={posts} initialLimit={5} />);

      expect(
        screen.queryByRole('button', { name: /Show all/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /more posts/ }),
      ).not.toBeInTheDocument();
    });

    it('shows all posts when "Show all" button clicked', async () => {
      const user = userEvent.setup();
      const posts = createPosts(10);

      render(<PostsList posts={posts} initialLimit={5} />);

      await user.click(screen.getByRole('button', { name: 'Show all 10' }));

      const list = screen.getByRole('list', { name: 'Analyzed posts' });
      const items = within(list).getAllByRole('listitem');

      expect(items).toHaveLength(10);
    });

    it('shows all posts when bottom "Show more" button clicked', async () => {
      const user = userEvent.setup();
      const posts = createPosts(10);

      render(<PostsList posts={posts} initialLimit={5} />);

      await user.click(
        screen.getByRole('button', { name: 'Show 5 more posts' }),
      );

      const list = screen.getByRole('list', { name: 'Analyzed posts' });
      const items = within(list).getAllByRole('listitem');

      expect(items).toHaveLength(10);
    });

    it('shows "Show less" button after expanding', async () => {
      const user = userEvent.setup();
      const posts = createPosts(10);

      render(<PostsList posts={posts} initialLimit={5} />);

      await user.click(screen.getByRole('button', { name: 'Show all 10' }));

      expect(
        screen.getByRole('button', { name: 'Show less' }),
      ).toBeInTheDocument();
    });

    it('hides bottom "Show more" button after expanding', async () => {
      const user = userEvent.setup();
      const posts = createPosts(10);

      render(<PostsList posts={posts} initialLimit={5} />);

      await user.click(screen.getByRole('button', { name: 'Show all 10' }));

      expect(
        screen.queryByRole('button', { name: /more posts/ }),
      ).not.toBeInTheDocument();
    });

    it('collapses back to initial limit when "Show less" clicked', async () => {
      const user = userEvent.setup();
      const posts = createPosts(10);

      render(<PostsList posts={posts} initialLimit={5} />);

      // Expand
      await user.click(screen.getByRole('button', { name: 'Show all 10' }));
      // Collapse
      await user.click(screen.getByRole('button', { name: 'Show less' }));

      const list = screen.getByRole('list', { name: 'Analyzed posts' });
      const items = within(list).getAllByRole('listitem');

      expect(items).toHaveLength(5);
    });
  });

  // ===========================================================================
  // Post Expansion
  // ===========================================================================

  describe('post expansion', () => {
    it('passes expanded state to PostCard', () => {
      const posts = [
        createMockSentimentItem({
          id: 'post-1',
          textContent: 'A'.repeat(250), // Long enough to be expandable
        }),
      ];

      render(<PostsList posts={posts} />);

      // PostCard shows "Show more" button when content is truncated
      expect(
        screen.getByRole('button', { name: 'Show more' }),
      ).toBeInTheDocument();
    });

    it('toggles individual post expansion', async () => {
      const user = userEvent.setup();
      const posts = [
        createMockSentimentItem({
          id: 'post-1',
          textContent: 'A'.repeat(250),
        }),
      ];

      render(<PostsList posts={posts} />);

      // Initially collapsed
      expect(
        screen.getByRole('button', { name: 'Show more' }),
      ).toBeInTheDocument();

      // Expand
      await user.click(screen.getByRole('button', { name: 'Show more' }));

      // Now shows "Show less"
      expect(
        screen.getByRole('button', { name: 'Show less' }),
      ).toBeInTheDocument();
    });

    it('tracks multiple post expansions independently', async () => {
      const user = userEvent.setup();
      const posts = [
        createMockSentimentItem({
          id: 'post-1',
          textContent: 'First post content. ' + 'A'.repeat(250),
        }),
        createMockSentimentItem({
          id: 'post-2',
          textContent: 'Second post content. ' + 'B'.repeat(250),
        }),
      ];

      render(<PostsList posts={posts} />);

      // Both have "Show more" initially
      const showMoreButtons = screen.getAllByRole('button', {
        name: 'Show more',
      });
      expect(showMoreButtons).toHaveLength(2);

      // Expand first post only
      await user.click(showMoreButtons[0]!);

      // First post shows "Show less", second still shows "Show more"
      expect(
        screen.getByRole('button', { name: 'Show less' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Show more' }),
      ).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Accessibility
  // ===========================================================================

  describe('accessibility', () => {
    it('uses semantic list markup', () => {
      const posts = createPosts(3);

      render(<PostsList posts={posts} />);

      expect(
        screen.getByRole('list', { name: 'Analyzed posts' }),
      ).toBeInTheDocument();
    });

    it('renders each post in a listitem', () => {
      const posts = createPosts(3);

      render(<PostsList posts={posts} />);

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);
    });

    it('has heading for posts section', () => {
      const posts = createPosts(3);

      render(<PostsList posts={posts} />);

      expect(
        screen.getByRole('heading', { level: 3, name: /Analyzed Posts/ }),
      ).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles single post', () => {
      const posts = createPosts(1);

      render(<PostsList posts={posts} />);

      expect(screen.getByText('Analyzed Posts (1)')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Show all/ }),
      ).not.toBeInTheDocument();
    });

    it('handles initialLimit of 0', () => {
      const posts = createPosts(5);

      render(<PostsList posts={posts} initialLimit={0} />);

      // Should show "Show all 5" since hasMore = 5 > 0
      expect(
        screen.getByRole('button', { name: 'Show all 5' }),
      ).toBeInTheDocument();

      // List should be empty initially
      const list = screen.getByRole('list', { name: 'Analyzed posts' });
      expect(within(list).queryAllByRole('listitem')).toHaveLength(0);
    });

    it('handles initialLimit greater than posts count', () => {
      const posts = createPosts(3);

      render(<PostsList posts={posts} initialLimit={10} />);

      const list = screen.getByRole('list', { name: 'Analyzed posts' });
      const items = within(list).getAllByRole('listitem');

      expect(items).toHaveLength(3);
      expect(
        screen.queryByRole('button', { name: /Show all/ }),
      ).not.toBeInTheDocument();
    });

    it('handles large number of posts', () => {
      const posts = createPosts(100);

      render(<PostsList posts={posts} initialLimit={5} />);

      expect(
        screen.getByRole('button', { name: 'Show all 100' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Show 95 more posts' }),
      ).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Empty State
  // ===========================================================================

  describe('empty state', () => {
    it('renders card with empty message', () => {
      render(<PostsList posts={[]} />);

      expect(screen.getByText('No posts to display')).toBeInTheDocument();
    });

    it('applies className to empty state card', () => {
      const { container } = render(
        <PostsList posts={[]} className="test-class" />,
      );

      // The Card component is the first child in empty state
      const card = container.querySelector('.test-class');
      expect(card).toBeInTheDocument();
    });

    it('does not render list or buttons in empty state', () => {
      render(<PostsList posts={[]} />);

      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Show/ }),
      ).not.toBeInTheDocument();
    });
  });
});
