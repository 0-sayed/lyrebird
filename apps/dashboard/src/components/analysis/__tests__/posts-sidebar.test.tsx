import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMockSentimentItem,
  createMockSentimentItems,
  render,
  resetMockIdCounter,
  screen,
  userEvent,
} from '@/__tests__/test-utils';
import { SentimentLabel } from '@/types/api';
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

  const getPostCards = () =>
    screen.getAllByRole('button', { name: /View original post/ });

  const createExplorerPost = (
    index: number,
    overrides: Partial<ReturnType<typeof createMockSentimentItem>> = {},
  ) =>
    createMockSentimentItem({
      id: `explorer-${index}`,
      textContent: `Explorer post ${index}`,
      authorName: `author-${index}.bsky.social`,
      sentimentScore: 0,
      sentimentLabel: SentimentLabel.NEUTRAL,
      publishedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      analyzedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      ...overrides,
    });

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
  // Post Explorer Control Tests
  // ===========================================================================

  describe('post explorer controls', () => {
    it('searches posts by content and author', async () => {
      const user = userEvent.setup();
      const posts = [
        createExplorerPost(1, {
          textContent: 'Release notes for search behavior',
          authorName: 'alpha.bsky.social',
        }),
        createExplorerPost(2, {
          textContent: 'Unrelated dashboard update',
          authorName: 'beta.bsky.social',
        }),
      ];

      render(<PostsSidebar {...defaultProps} posts={posts} />);

      const search = screen.getByLabelText('Search posts');
      await user.type(search, 'release notes');

      expect(
        screen.getByText('Release notes for search behavior'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Unrelated dashboard update'),
      ).not.toBeInTheDocument();

      await user.clear(search);
      await user.type(search, 'beta');

      expect(
        screen.getByText('Unrelated dashboard update'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Release notes for search behavior'),
      ).not.toBeInTheDocument();
    });

    it('filters posts by positive, neutral, and negative sentiment', async () => {
      const user = userEvent.setup();
      const posts = [
        createExplorerPost(1, {
          textContent: 'Positive post',
          sentimentScore: 0.8,
          sentimentLabel: SentimentLabel.POSITIVE,
        }),
        createExplorerPost(2, {
          textContent: 'Neutral post',
          sentimentScore: 0,
          sentimentLabel: SentimentLabel.NEUTRAL,
        }),
        createExplorerPost(3, {
          textContent: 'Negative post',
          sentimentScore: -0.8,
          sentimentLabel: SentimentLabel.NEGATIVE,
        }),
      ];

      render(<PostsSidebar {...defaultProps} posts={posts} />);

      await user.click(screen.getByRole('button', { name: 'Positive' }));

      expect(screen.getByText('Positive post')).toBeInTheDocument();
      expect(screen.queryByText('Neutral post')).not.toBeInTheDocument();
      expect(screen.queryByText('Negative post')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Neutral' }));

      expect(screen.getByText('Neutral post')).toBeInTheDocument();
      expect(screen.queryByText('Positive post')).not.toBeInTheDocument();
      expect(screen.queryByText('Negative post')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Negative' }));

      expect(screen.getByText('Negative post')).toBeInTheDocument();
      expect(screen.queryByText('Positive post')).not.toBeInTheDocument();
      expect(screen.queryByText('Neutral post')).not.toBeInTheDocument();
    });

    it('sorts posts by newest first', async () => {
      const user = userEvent.setup();
      const posts = [
        createExplorerPost(1, {
          textContent: 'Oldest post',
          publishedAt: '2026-01-01T00:00:00.000Z',
          sentimentScore: 0.9,
        }),
        createExplorerPost(2, {
          textContent: 'Newest post',
          publishedAt: '2026-01-03T00:00:00.000Z',
          sentimentScore: 0.1,
        }),
        createExplorerPost(3, {
          textContent: 'Middle post',
          publishedAt: '2026-01-02T00:00:00.000Z',
          sentimentScore: 0.2,
        }),
      ];

      render(<PostsSidebar {...defaultProps} posts={posts} />);

      await user.selectOptions(
        screen.getByLabelText('Sort posts'),
        'most-positive',
      );
      expect(getPostCards()[0]).toHaveTextContent('Oldest post');

      await user.selectOptions(screen.getByLabelText('Sort posts'), 'newest');

      expect(getPostCards()[0]).toHaveTextContent('Newest post');
    });

    it('sorts posts by most positive and most negative sentiment', async () => {
      const user = userEvent.setup();
      const posts = [
        createExplorerPost(1, {
          textContent: 'Neutral first',
          sentimentScore: 0,
          sentimentLabel: SentimentLabel.NEUTRAL,
        }),
        createExplorerPost(2, {
          textContent: 'Most negative first',
          sentimentScore: -0.9,
          sentimentLabel: SentimentLabel.NEGATIVE,
        }),
        createExplorerPost(3, {
          textContent: 'Most positive first',
          sentimentScore: 0.9,
          sentimentLabel: SentimentLabel.POSITIVE,
        }),
      ];

      render(<PostsSidebar {...defaultProps} posts={posts} />);

      await user.selectOptions(
        screen.getByLabelText('Sort posts'),
        'most-positive',
      );
      expect(getPostCards()[0]).toHaveTextContent('Most positive first');

      await user.selectOptions(
        screen.getByLabelText('Sort posts'),
        'most-negative',
      );
      expect(getPostCards()[0]).toHaveTextContent('Most negative first');
    });

    it('renders the first 25 of 30 matching posts and shows more on request', async () => {
      const user = userEvent.setup();
      const posts = Array.from({ length: 30 }, (_, index) =>
        createExplorerPost(index, { textContent: `Paginated post ${index}` }),
      );

      render(<PostsSidebar {...defaultProps} posts={posts} />);

      expect(getPostCards()).toHaveLength(25);
      expect(
        screen.getByText('Showing 25 of 30 matching posts'),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Show more' }));

      expect(getPostCards()).toHaveLength(30);
      expect(
        screen.getByText('Showing 30 of 30 matching posts'),
      ).toBeInTheDocument();
    });

    it('resets visible posts to 25 when search changes after showing 50 of 60', async () => {
      const user = userEvent.setup();
      const posts = Array.from({ length: 60 }, (_, index) =>
        createExplorerPost(index, {
          textContent: `Reset target post ${index}`,
        }),
      );

      render(<PostsSidebar {...defaultProps} posts={posts} />);

      await user.click(screen.getByRole('button', { name: 'Show more' }));
      expect(getPostCards()).toHaveLength(50);
      expect(
        screen.getByText('Showing 50 of 60 matching posts'),
      ).toBeInTheDocument();

      await user.type(screen.getByLabelText('Search posts'), 'reset target');

      expect(getPostCards()).toHaveLength(25);
      expect(
        screen.getByText('Showing 25 of 60 matching posts'),
      ).toBeInTheDocument();
    });

    it('resets visible posts to 25 when sentiment filter changes after showing 50 of 60', async () => {
      const user = userEvent.setup();
      const posts = Array.from({ length: 60 }, (_, index) =>
        createExplorerPost(index, {
          textContent: `Filter reset post ${index}`,
          sentimentScore: 0.8,
          sentimentLabel: SentimentLabel.POSITIVE,
        }),
      );

      render(<PostsSidebar {...defaultProps} posts={posts} />);

      await user.click(screen.getByRole('button', { name: 'Show more' }));
      expect(getPostCards()).toHaveLength(50);
      expect(
        screen.getByText('Showing 50 of 60 matching posts'),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Positive' }));

      expect(getPostCards()).toHaveLength(25);
      expect(
        screen.getByText('Showing 25 of 60 matching posts'),
      ).toBeInTheDocument();
    });

    it('resets visible posts to 25 when sort changes after showing 50 of 60', async () => {
      const user = userEvent.setup();
      const posts = Array.from({ length: 60 }, (_, index) =>
        createExplorerPost(index, {
          textContent: `Sort reset post ${index}`,
          publishedAt: new Date(Date.UTC(2026, 0, 60 - index)).toISOString(),
        }),
      );

      render(<PostsSidebar {...defaultProps} posts={posts} />);

      await user.click(screen.getByRole('button', { name: 'Show more' }));
      expect(getPostCards()).toHaveLength(50);
      expect(
        screen.getByText('Showing 50 of 60 matching posts'),
      ).toBeInTheDocument();

      await user.selectOptions(
        screen.getByLabelText('Sort posts'),
        'most-positive',
      );

      expect(getPostCards()).toHaveLength(25);
      expect(
        screen.getByText('Showing 25 of 60 matching posts'),
      ).toBeInTheDocument();
    });

    it('resets controls and visible posts before rendering a changed dataset', async () => {
      const user = userEvent.setup();
      const initialPosts = Array.from({ length: 60 }, (_, index) =>
        createExplorerPost(index, {
          textContent: `Initial dataset post ${index}`,
          sentimentLabel: SentimentLabel.POSITIVE,
          sentimentScore: 0.8,
        }),
      );
      const nextPosts = Array.from({ length: 30 }, (_, index) =>
        createExplorerPost(index + 100, {
          textContent: `Next dataset post ${index}`,
          sentimentLabel: SentimentLabel.NEUTRAL,
          sentimentScore: 0,
        }),
      );

      const { rerender } = render(
        <PostsSidebar {...defaultProps} posts={initialPosts} />,
      );

      await user.type(screen.getByLabelText('Search posts'), 'initial');
      await user.click(screen.getByRole('button', { name: 'Positive' }));
      await user.selectOptions(
        screen.getByLabelText('Sort posts'),
        'most-positive',
      );
      await user.click(screen.getByRole('button', { name: 'Show more' }));
      expect(getPostCards()).toHaveLength(50);

      rerender(<PostsSidebar {...defaultProps} posts={nextPosts} />);

      expect(screen.getByLabelText('Search posts')).toHaveValue('');
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByLabelText('Sort posts')).toHaveValue('newest');
      expect(getPostCards()).toHaveLength(25);
      expect(
        screen.getByText('Showing 25 of 30 matching posts'),
      ).toBeInTheDocument();
    });

    it('keeps a selected post visible after pagination resets', async () => {
      const user = userEvent.setup();
      const posts = Array.from({ length: 60 }, (_, index) =>
        createExplorerPost(index, {
          textContent: `Selected reset post ${index}`,
          sentimentLabel: SentimentLabel.POSITIVE,
          sentimentScore: 0.8,
        }),
      );
      const selectedPostId = 'explorer-20';

      const { rerender } = render(
        <PostsSidebar {...defaultProps} posts={posts} />,
      );

      await user.click(screen.getByRole('button', { name: 'Show more' }));
      rerender(
        <PostsSidebar
          {...defaultProps}
          posts={posts}
          selectedPostId={selectedPostId}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Positive' }));

      const selectedPost = screen
        .getByText('Selected reset post 20')
        .closest('[role="button"]');
      expect(selectedPost).toHaveAttribute('aria-current', 'true');
      expect(
        screen.getByText('Showing 40 of 60 matching posts'),
      ).toBeInTheDocument();
    });

    it('shows more posts when the selected post is beyond the stored visible count', async () => {
      const user = userEvent.setup();
      const posts = Array.from({ length: 60 }, (_, index) =>
        createExplorerPost(index, {
          textContent: `Selected pagination post ${index}`,
          publishedAt: '2026-01-01T00:00:00.000Z',
        }),
      );

      render(
        <PostsSidebar
          {...defaultProps}
          posts={posts}
          selectedPostId="explorer-50"
        />,
      );

      expect(getPostCards()).toHaveLength(51);
      expect(
        screen.getByText('Showing 51 of 60 matching posts'),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Show more' }));

      expect(getPostCards()).toHaveLength(60);
      expect(
        screen.getByText('Showing 60 of 60 matching posts'),
      ).toBeInTheDocument();
    });

    it('shows an empty state when no posts match filters', async () => {
      const user = userEvent.setup();
      const posts = [
        createExplorerPost(1, { textContent: 'Visible post before search' }),
      ];

      render(<PostsSidebar {...defaultProps} posts={posts} />);

      await user.type(screen.getByLabelText('Search posts'), 'no result term');

      expect(screen.getByText('No matching posts')).toBeInTheDocument();
      expect(
        screen.queryByText('Visible post before search'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Show more' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Showing 0 of 0 matching posts'),
      ).not.toBeInTheDocument();
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

      const selectedPost = screen
        .getByText('Mock post content item-1')
        .closest('[role="button"]');

      expect(selectedPost).toHaveAttribute('aria-current', 'true');
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

    it('hides sidebar contents from assistive technology and focus when closed', () => {
      render(<PostsSidebar {...defaultProps} isOpen={false} />);

      const sidebar = screen.getByTestId('posts-sidebar');
      expect(sidebar).toHaveAttribute('aria-hidden', 'true');
      expect(sidebar).toHaveAttribute('inert');
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
      expect(getPostCards()).toHaveLength(25);
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
