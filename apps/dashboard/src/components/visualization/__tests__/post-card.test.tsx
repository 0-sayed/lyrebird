import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostCard, PostsList, PostPreview } from '../post-card';
import { SentimentLabel, type SentimentDataItem } from '@/types/api';

describe('Post Card Components', () => {
  // Note: Sentiment scores use -1 to +1 scale (industry standard)
  const mockPost: SentimentDataItem = {
    id: 'post-1',
    textContent: 'This is a sample post about technology and innovation.',
    source: 'Bluesky',
    sourceUrl: 'https://bsky.app/post/123',
    authorName: 'John Doe',
    sentimentScore: 0.75,
    sentimentLabel: SentimentLabel.POSITIVE,
    publishedAt: new Date().toISOString(),
  };

  const longPost: SentimentDataItem = {
    ...mockPost,
    id: 'post-long',
    textContent:
      'This is a very long post that contains more than 200 characters. ' +
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do ' +
      'eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ' +
      'ad minim veniam, quis nostrud exercitation ullamco laboris.',
  };

  const mockPosts: SentimentDataItem[] = [
    mockPost,
    {
      ...mockPost,
      id: 'post-2',
      textContent: 'Another post about something neutral.',
      sentimentScore: 0.0, // Neutral on -1 to +1 scale
      sentimentLabel: SentimentLabel.NEUTRAL,
    },
    {
      ...mockPost,
      id: 'post-3',
      textContent: 'A negative post about bad experiences.',
      sentimentScore: -0.6, // Negative on -1 to +1 scale
      sentimentLabel: SentimentLabel.NEGATIVE,
    },
    { ...mockPost, id: 'post-4', textContent: 'Fourth post' },
    { ...mockPost, id: 'post-5', textContent: 'Fifth post' },
    { ...mockPost, id: 'post-6', textContent: 'Sixth post' },
  ];

  describe('PostCard', () => {
    it('renders post content', () => {
      render(<PostCard post={mockPost} />);

      expect(
        screen.getByText(/This is a sample post about technology/),
      ).toBeInTheDocument();
    });

    it('displays author name', () => {
      render(<PostCard post={mockPost} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('shows Anonymous for missing author', () => {
      const postNoAuthor = { ...mockPost, authorName: undefined };
      render(<PostCard post={postNoAuthor} />);

      expect(screen.getByText('Anonymous')).toBeInTheDocument();
    });

    it('displays sentiment badge', () => {
      render(<PostCard post={mockPost} />);

      expect(screen.getByText('Positive')).toBeInTheDocument();
    });

    it('displays sentiment score in tooltip', async () => {
      const user = userEvent.setup();
      render(<PostCard post={mockPost} />);

      const badge = screen.getByText('Positive');
      await user.hover(badge);

      // Tooltip should show score in +X.XX format
      expect(await screen.findByText(/\+0\.75/)).toBeInTheDocument();
    });

    it('displays source link', () => {
      render(<PostCard post={mockPost} />);

      const link = screen.getByRole('link', { name: /View original post/i });
      expect(link).toHaveAttribute('href', 'https://bsky.app/post/123');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('hides source link when no URL', () => {
      const postNoUrl = { ...mockPost, sourceUrl: undefined };
      render(<PostCard post={postNoUrl} />);

      expect(
        screen.queryByRole('link', { name: /View original/i }),
      ).not.toBeInTheDocument();
    });

    it('truncates long content by default', () => {
      render(<PostCard post={longPost} />);

      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });

    it('shows full content when expanded', () => {
      render(<PostCard post={longPost} expanded />);

      expect(screen.queryByText(/\.\.\./)).not.toBeInTheDocument();
      expect(
        screen.getByText(/quis nostrud exercitation ullamco laboris/),
      ).toBeInTheDocument();
    });

    it('calls onToggleExpand when clicking show more', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(<PostCard post={longPost} onToggleExpand={onToggle} />);

      const button = screen.getByRole('button', { name: /Show more/i });
      await user.click(button);

      expect(onToggle).toHaveBeenCalledOnce();
    });

    it('shows show less button when expanded', () => {
      render(<PostCard post={longPost} expanded onToggleExpand={vi.fn()} />);

      expect(
        screen.getByRole('button', { name: /Show less/i }),
      ).toBeInTheDocument();
    });

    it('displays sentiment score bar', () => {
      render(<PostCard post={mockPost} />);

      // The score bar should show +0.75 format
      expect(screen.getByText('+0.75')).toBeInTheDocument();
    });

    it('displays relative time', () => {
      render(<PostCard post={mockPost} />);

      // Should show "just now" or similar
      expect(screen.getByText(/just now|ago/i)).toBeInTheDocument();
    });

    it('sanitizes malicious content', () => {
      const maliciousPost = {
        ...mockPost,
        textContent: 'Safe text <img src=x onerror=alert(1)>',
      };
      render(<PostCard post={maliciousPost} />);

      // Malicious img tag should be stripped, but safe text should remain
      const container = screen.getByText(/Safe text/);
      expect(container).toBeInTheDocument();
      expect(container.innerHTML).not.toContain('onerror');
      expect(container.innerHTML).not.toContain('<img');
    });
  });

  describe('PostsList', () => {
    it('renders list of posts', () => {
      render(<PostsList posts={mockPosts} />);

      expect(
        screen.getByRole('list', { name: /Analyzed posts/i }),
      ).toBeInTheDocument();
    });

    it('shows post count in heading', () => {
      render(<PostsList posts={mockPosts} />);

      expect(screen.getByText(/Analyzed Posts \(6\)/)).toBeInTheDocument();
    });

    it('limits initial display to initialLimit', () => {
      render(<PostsList posts={mockPosts} initialLimit={3} />);

      // Count PostCards by looking for unique content
      const list = screen.getByRole('list', { name: /Analyzed posts/i });
      const items = list.children;
      expect(items.length).toBe(3);
    });

    it('shows "Show all" button when more posts exist', () => {
      render(<PostsList posts={mockPosts} initialLimit={3} />);

      expect(
        screen.getByRole('button', { name: /Show all 6/i }),
      ).toBeInTheDocument();
    });

    it('shows all posts after clicking Show all', async () => {
      const user = userEvent.setup();
      render(<PostsList posts={mockPosts} initialLimit={3} />);

      await user.click(screen.getByRole('button', { name: /Show all/i }));

      // Now all 6 posts should be visible
      const list = screen.getByRole('list', { name: /Analyzed posts/i });
      expect(list.children.length).toBe(6);
    });

    it('shows "Show less" after expanding', async () => {
      const user = userEvent.setup();
      render(<PostsList posts={mockPosts} initialLimit={3} />);

      await user.click(screen.getByRole('button', { name: /Show all/i }));

      expect(
        screen.getByRole('button', { name: /Show less/i }),
      ).toBeInTheDocument();
    });

    it('displays empty message when no posts', () => {
      render(<PostsList posts={[]} />);

      expect(screen.getByText('No posts to display')).toBeInTheDocument();
    });

    it('handles single post', () => {
      render(<PostsList posts={[mockPost]} />);

      expect(screen.getByText(/Analyzed Posts \(1\)/)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Show all/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('PostPreview', () => {
    it('renders compact preview', () => {
      render(<PostPreview post={mockPost} />);

      expect(screen.getByText('+0.75')).toBeInTheDocument();
    });

    it('truncates long content', () => {
      render(<PostPreview post={longPost} />);

      // Preview should be truncated to 100 chars
      const text = screen.getByText(/Lorem ipsum/);
      expect(text.textContent).not.toContain('ullamco laboris');
    });

    it('shows sentiment badge', () => {
      render(<PostPreview post={mockPost} />);

      expect(screen.getByText('+0.75')).toBeInTheDocument();
    });
  });
});
