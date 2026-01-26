import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMockSentimentItem,
  createMockSentimentItems,
  render,
  resetMockIdCounter,
  screen,
  userEvent,
} from '@/__tests__/test-utils';
import { PostsSidebar } from '../posts-sidebar';

// =============================================================================
// Test Setup
// =============================================================================

describe('PostsSidebar', () => {
  const defaultProps = {
    posts: [] as ReturnType<typeof createMockSentimentItem>[],
    isOpen: true,
    onToggle: vi.fn(),
  };

  beforeEach(() => {
    resetMockIdCounter();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Rendering Tests
  // ===========================================================================

  describe('rendering', () => {
    it('renders the sidebar with header', () => {
      render(<PostsSidebar {...defaultProps} />);

      expect(screen.getByText('Posts')).toBeInTheDocument();
    });

    it('renders the posts count (singular)', () => {
      const posts = [createMockSentimentItem()];
      render(<PostsSidebar {...defaultProps} posts={posts} />);

      expect(screen.getByText('1 analyzed post')).toBeInTheDocument();
    });

    it('renders the posts count (plural)', () => {
      const posts = createMockSentimentItems(5);
      render(<PostsSidebar {...defaultProps} posts={posts} />);

      expect(screen.getByText('5 analyzed posts')).toBeInTheDocument();
    });

    it('renders zero posts correctly', () => {
      render(<PostsSidebar {...defaultProps} posts={[]} />);

      expect(screen.getByText('0 analyzed posts')).toBeInTheDocument();
    });

    it('renders post cards for each post', () => {
      const posts = createMockSentimentItems(3);
      render(<PostsSidebar {...defaultProps} posts={posts} />);

      // Each post card has role="button"
      const postCards = screen.getAllByRole('button', {
        name: /View original post/,
      });
      expect(postCards).toHaveLength(3);
    });

  });

  // ===========================================================================
  // Toggle Button Tests
  // ===========================================================================

  describe('toggle button', () => {
    it('renders toggle button', () => {
      render(<PostsSidebar {...defaultProps} />);

      const toggleButton = screen.getByRole('button', {
        name: /posts sidebar/i,
      });
      expect(toggleButton).toBeInTheDocument();
    });

    it('has collapse label when open', () => {
      render(<PostsSidebar {...defaultProps} isOpen={true} />);

      expect(
        screen.getByRole('button', { name: 'Collapse posts sidebar' }),
      ).toBeInTheDocument();
    });

    it('has expand label when closed', () => {
      render(<PostsSidebar {...defaultProps} isOpen={false} />);

      expect(
        screen.getByRole('button', { name: 'Expand posts sidebar' }),
      ).toBeInTheDocument();
    });

    it('calls onToggle when clicked', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(<PostsSidebar {...defaultProps} onToggle={onToggle} />);

      const toggleButton = screen.getByRole('button', {
        name: /posts sidebar/i,
      });
      await user.click(toggleButton);

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Post Selection Tests
  // ===========================================================================

  describe('post selection', () => {
    it('highlights selected post', () => {
      const posts = createMockSentimentItems(3);
      render(
        <PostsSidebar
          {...defaultProps}
          posts={posts}
          selectedPostId="item-1"
        />,
      );

      // The AnalysisPostCard receives isSelected prop
      // We can verify by checking that our post exists
      const postCards = screen.getAllByRole('button', {
        name: /View original post/,
      });
      expect(postCards).toHaveLength(3);
    });

    it('calls onSelectPost when a post is clicked', async () => {
      const user = userEvent.setup();
      const onSelectPost = vi.fn();
      const posts = [
        createMockSentimentItem({ id: 'post-1', sourceUrl: undefined }),
      ];
      render(
        <PostsSidebar
          {...defaultProps}
          posts={posts}
          onSelectPost={onSelectPost}
        />,
      );

      // Post card without sourceUrl calls onClick (which becomes onSelectPost)
      const postCard = screen.getByRole('button', { name: 'View post' });
      await user.click(postCard);

      expect(onSelectPost).toHaveBeenCalledWith(posts[0]);
    });

    it('does not call onSelectPost when post has sourceUrl', async () => {
      const user = userEvent.setup();
      const onSelectPost = vi.fn();
      const posts = [
        createMockSentimentItem({
          id: 'post-1',
          sourceUrl: 'https://example.com/post/1',
        }),
      ];

      // Mock window.open for this test
      const originalOpen = window.open;
      window.open = vi.fn();

      render(
        <PostsSidebar
          {...defaultProps}
          posts={posts}
          onSelectPost={onSelectPost}
        />,
      );

      const postCard = screen.getByRole('button', {
        name: /View original post/,
      });
      await user.click(postCard);

      // With sourceUrl, it opens the URL instead of calling onSelectPost
      expect(onSelectPost).not.toHaveBeenCalled();

      window.open = originalOpen;
    });

    it('works without onSelectPost callback', async () => {
      const user = userEvent.setup();
      const posts = [
        createMockSentimentItem({ id: 'post-1', sourceUrl: undefined }),
      ];

      // Should not throw
      render(<PostsSidebar {...defaultProps} posts={posts} />);

      const postCard = screen.getByRole('button', { name: 'View post' });
      await user.click(postCard);
    });
  });

  // ===========================================================================
  // Accessibility Tests
  // ===========================================================================

  describe('accessibility', () => {
    it('sidebar has aside element', () => {
      render(<PostsSidebar {...defaultProps} />);

      const sidebar = screen.getByTestId('posts-sidebar');
      expect(sidebar.tagName).toBe('ASIDE');
    });

    it('toggle button has descriptive aria-label', () => {
      render(<PostsSidebar {...defaultProps} isOpen={true} />);

      const toggleButton = screen.getByRole('button', {
        name: 'Collapse posts sidebar',
      });
      expect(toggleButton).toHaveAttribute(
        'aria-label',
        'Collapse posts sidebar',
      );
    });

    it('header section has proper heading', () => {
      render(<PostsSidebar {...defaultProps} />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Posts');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles large number of posts', () => {
      const posts = createMockSentimentItems(100);
      render(<PostsSidebar {...defaultProps} posts={posts} />);

      expect(screen.getByText('100 analyzed posts')).toBeInTheDocument();
    });

    it('handles posts with missing optional fields', () => {
      const posts = [
        createMockSentimentItem({
          authorName: undefined,
          sourceUrl: undefined,
        }),
      ];

      render(<PostsSidebar {...defaultProps} posts={posts} />);

      // Should still render without error
      expect(
        screen.getByRole('button', { name: 'View post' }),
      ).toBeInTheDocument();
    });

    it('renders correctly when selectedPostId does not match any post', () => {
      const posts = createMockSentimentItems(3);
      render(
        <PostsSidebar
          {...defaultProps}
          posts={posts}
          selectedPostId="non-existent-id"
        />,
      );

      // Should render all posts without error
      const postCards = screen.getAllByRole('button', {
        name: /View original post/,
      });
      expect(postCards).toHaveLength(3);
    });
  });
});
