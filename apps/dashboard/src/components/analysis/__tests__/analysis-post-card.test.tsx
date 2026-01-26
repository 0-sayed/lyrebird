import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SentimentLabel } from '@/types/api';
import {
  createMockSentimentItem,
  render,
  resetMockIdCounter,
  screen,
  userEvent,
} from '@/__tests__/test-utils';
import { AnalysisPostCard } from '../analysis-post-card';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock openInNewWindow to verify it's called correctly
vi.mock('@/lib/url-utils', () => ({
  openInNewWindow: vi.fn(),
}));

// Import the mocked function for assertions
import { openInNewWindow } from '@/lib/url-utils';

// =============================================================================
// Test Setup
// =============================================================================

describe('AnalysisPostCard', () => {
  const mockWindowOpen = vi.fn();
  const originalWindowOpen = window.open;

  beforeEach(() => {
    resetMockIdCounter();
    window.open = mockWindowOpen;
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.open = originalWindowOpen;
    mockWindowOpen.mockClear();
  });

  // ===========================================================================
  // Rendering Tests
  // ===========================================================================

  describe('rendering', () => {
    it('renders the post content', () => {
      const post = createMockSentimentItem({
        textContent: 'This is a test post content',
      });

      render(<AnalysisPostCard post={post} />);

      expect(screen.getByText('This is a test post content')).toBeInTheDocument();
    });

    it('renders the author name with @ prefix', () => {
      const post = createMockSentimentItem({
        authorName: 'testuser',
      });

      render(<AnalysisPostCard post={post} />);

      expect(screen.getByText('@testuser')).toBeInTheDocument();
    });

    it('renders anonymous when author name is missing', () => {
      const post = createMockSentimentItem({
        authorName: undefined,
      });

      render(<AnalysisPostCard post={post} />);

      expect(screen.getByText('@anonymous')).toBeInTheDocument();
    });

    it('renders the sentiment score with sign and emoji', () => {
      const post = createMockSentimentItem({
        sentimentScore: 0.75,
      });

      render(<AnalysisPostCard post={post} />);

      // Should show "+0.75" with emoji
      expect(screen.getByText(/\+0\.75/)).toBeInTheDocument();
    });

    it('renders negative sentiment score without plus sign', () => {
      const post = createMockSentimentItem({
        sentimentScore: -0.42,
        sentimentLabel: SentimentLabel.NEGATIVE,
      });

      render(<AnalysisPostCard post={post} />);

      // Should show "-0.42" (no plus sign)
      expect(screen.getByText(/-0\.42/)).toBeInTheDocument();
    });

    it('truncates long content to 120 characters', () => {
      const longContent = 'A'.repeat(200);
      const post = createMockSentimentItem({
        textContent: longContent,
      });

      render(<AnalysisPostCard post={post} />);

      // truncateText adds ellipsis after truncation
      const content = screen.getByText(/^A+/);
      expect(content.textContent?.length).toBeLessThanOrEqual(123); // 120 + "..."
    });

    it('renders the relative timestamp', () => {
      const post = createMockSentimentItem({
        publishedAt: new Date().toISOString(),
      });

      render(<AnalysisPostCard post={post} />);

      // Should have a time element
      const timeElement = screen.getByRole('time');
      expect(timeElement).toBeInTheDocument();
    });

    it('renders time element with datetime attribute', () => {
      const publishedAt = '2024-01-15T12:00:00Z';
      const post = createMockSentimentItem({
        publishedAt,
      });

      render(<AnalysisPostCard post={post} />);

      const timeElement = screen.getByRole('time');
      expect(timeElement).toHaveAttribute('datetime', publishedAt);
    });

    it('applies custom className', () => {
      const post = createMockSentimentItem();

      render(<AnalysisPostCard post={post} className="custom-class" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  // ===========================================================================
  // Accessibility Tests
  // ===========================================================================

  describe('accessibility', () => {
    it('has role="button"', () => {
      const post = createMockSentimentItem();

      render(<AnalysisPostCard post={post} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('has tabIndex="0" for keyboard focus', () => {
      const post = createMockSentimentItem();

      render(<AnalysisPostCard post={post} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('tabIndex', '0');
    });

    it('has aria-label indicating source when sourceUrl exists', () => {
      const post = createMockSentimentItem({
        source: 'bluesky',
        sourceUrl: 'https://bsky.app/post/123',
      });

      render(<AnalysisPostCard post={post} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'View original post on bluesky');
    });

    it('has generic aria-label when no sourceUrl', () => {
      const post = createMockSentimentItem({
        sourceUrl: undefined,
      });

      render(<AnalysisPostCard post={post} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'View post');
    });

    it('time element has title attribute for full datetime', () => {
      const post = createMockSentimentItem({
        publishedAt: '2024-01-15T12:00:00Z',
      });

      render(<AnalysisPostCard post={post} />);

      const timeElement = screen.getByRole('time');
      expect(timeElement).toHaveAttribute('title');
    });
  });

  // ===========================================================================
  // Interaction Tests
  // ===========================================================================

  describe('interactions', () => {
    it('calls openInNewWindow when clicked and sourceUrl exists', async () => {
      const user = userEvent.setup();
      const post = createMockSentimentItem({
        sourceUrl: 'https://bsky.app/post/123',
      });

      render(<AnalysisPostCard post={post} />);

      await user.click(screen.getByRole('button'));

      expect(openInNewWindow).toHaveBeenCalledWith('https://bsky.app/post/123');
    });

    it('calls onClick when clicked and no sourceUrl', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const post = createMockSentimentItem({
        sourceUrl: undefined,
      });

      render(<AnalysisPostCard post={post} onClick={onClick} />);

      await user.click(screen.getByRole('button'));

      expect(onClick).toHaveBeenCalled();
      expect(openInNewWindow).not.toHaveBeenCalled();
    });

    it('does not call onClick when sourceUrl exists', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const post = createMockSentimentItem({
        sourceUrl: 'https://bsky.app/post/123',
      });

      render(<AnalysisPostCard post={post} onClick={onClick} />);

      await user.click(screen.getByRole('button'));

      expect(onClick).not.toHaveBeenCalled();
      expect(openInNewWindow).toHaveBeenCalled();
    });

    it('handles Enter key press', async () => {
      const user = userEvent.setup();
      const post = createMockSentimentItem({
        sourceUrl: 'https://bsky.app/post/123',
      });

      render(<AnalysisPostCard post={post} />);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(openInNewWindow).toHaveBeenCalledWith('https://bsky.app/post/123');
    });

    it('handles Space key press', async () => {
      const user = userEvent.setup();
      const post = createMockSentimentItem({
        sourceUrl: 'https://bsky.app/post/123',
      });

      render(<AnalysisPostCard post={post} />);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');

      expect(openInNewWindow).toHaveBeenCalledWith('https://bsky.app/post/123');
    });

    it('does not trigger on other key presses', async () => {
      const user = userEvent.setup();
      const post = createMockSentimentItem({
        sourceUrl: 'https://bsky.app/post/123',
      });

      render(<AnalysisPostCard post={post} />);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('a');

      expect(openInNewWindow).not.toHaveBeenCalled();
    });

    it('calls onClick on Enter when no sourceUrl', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const post = createMockSentimentItem({
        sourceUrl: undefined,
      });

      render(<AnalysisPostCard post={post} onClick={onClick} />);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(onClick).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Sentiment Display Tests
  // ===========================================================================

  describe('sentiment display', () => {
    it('displays positive score with plus sign', () => {
      const post = createMockSentimentItem({
        sentimentScore: 0.5,
        sentimentLabel: SentimentLabel.POSITIVE,
      });

      render(<AnalysisPostCard post={post} />);

      expect(screen.getByText(/\+0\.50/)).toBeInTheDocument();
    });

    it('displays negative score without plus sign', () => {
      const post = createMockSentimentItem({
        sentimentScore: -0.5,
        sentimentLabel: SentimentLabel.NEGATIVE,
      });

      render(<AnalysisPostCard post={post} />);

      expect(screen.getByText(/-0\.50/)).toBeInTheDocument();
    });

    it('displays zero score with plus sign', () => {
      const post = createMockSentimentItem({
        sentimentScore: 0,
        sentimentLabel: SentimentLabel.NEUTRAL,
      });

      render(<AnalysisPostCard post={post} />);

      // 0 >= 0 is true so it gets "+"
      expect(screen.getByText(/\+0\.00/)).toBeInTheDocument();
    });

    it('shows smiling face emoji for highly positive score', () => {
      const post = createMockSentimentItem({
        sentimentScore: 0.5,
        sentimentLabel: SentimentLabel.POSITIVE,
      });

      render(<AnalysisPostCard post={post} />);

      // getSentimentEmoji returns smiling face for score >= 0.4
      expect(screen.getByText(/\u{1F60A}/u)).toBeInTheDocument();
    });

    it('shows slightly smiling face for moderately positive score', () => {
      const post = createMockSentimentItem({
        sentimentScore: 0.2,
        sentimentLabel: SentimentLabel.POSITIVE,
      });

      render(<AnalysisPostCard post={post} />);

      // score >= 0.1 and < 0.4 gets slightly smiling face
      expect(screen.getByText(/\u{1F642}/u)).toBeInTheDocument();
    });

    it('shows neutral face for neutral score', () => {
      const post = createMockSentimentItem({
        sentimentScore: 0,
        sentimentLabel: SentimentLabel.NEUTRAL,
      });

      render(<AnalysisPostCard post={post} />);

      // score >= -0.1 and < 0.1 gets neutral face
      expect(screen.getByText(/\u{1F610}/u)).toBeInTheDocument();
    });

    it('shows confused face for slightly negative score', () => {
      const post = createMockSentimentItem({
        sentimentScore: -0.2,
        sentimentLabel: SentimentLabel.NEGATIVE,
      });

      render(<AnalysisPostCard post={post} />);

      // score >= -0.4 and < -0.1 gets confused face
      expect(screen.getByText(/\u{1F615}/u)).toBeInTheDocument();
    });

    it('shows disappointed face for very negative score', () => {
      const post = createMockSentimentItem({
        sentimentScore: -0.5,
        sentimentLabel: SentimentLabel.NEGATIVE,
      });

      render(<AnalysisPostCard post={post} />);

      // score < -0.4 gets disappointed face
      expect(screen.getByText(/\u{1F61E}/u)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles empty text content', () => {
      const post = createMockSentimentItem({
        textContent: '',
      });

      render(<AnalysisPostCard post={post} />);

      // Component should still render
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('handles empty author name (shows anonymous)', () => {
      const post = createMockSentimentItem({
        authorName: '',
      });

      render(<AnalysisPostCard post={post} />);

      // Empty string is falsy, so it shows anonymous
      expect(screen.getByText('@anonymous')).toBeInTheDocument();
    });

    it('handles empty sourceUrl (shows null)', () => {
      const post = createMockSentimentItem({
        sourceUrl: '',
      });

      render(<AnalysisPostCard post={post} />);

      // Empty string URL should be sanitized to null
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'View post');
    });

    it('handles extreme positive sentiment score', () => {
      const post = createMockSentimentItem({
        sentimentScore: 1.0,
        sentimentLabel: SentimentLabel.POSITIVE,
      });

      render(<AnalysisPostCard post={post} />);

      expect(screen.getByText(/\+1\.00/)).toBeInTheDocument();
    });

    it('handles extreme negative sentiment score', () => {
      const post = createMockSentimentItem({
        sentimentScore: -1.0,
        sentimentLabel: SentimentLabel.NEGATIVE,
      });

      render(<AnalysisPostCard post={post} />);

      expect(screen.getByText(/-1\.00/)).toBeInTheDocument();
    });

    it('handles content with special characters', () => {
      const post = createMockSentimentItem({
        textContent: '<script>alert("xss")</script> & "quotes"',
      });

      render(<AnalysisPostCard post={post} />);

      // Content should be sanitized and rendered safely
      // The sanitizer should strip script tags (case-insensitive check)
      expect(screen.queryByText(/<script>/i)).not.toBeInTheDocument();
    });

    it('does nothing when no onClick and no sourceUrl', async () => {
      const user = userEvent.setup();
      const post = createMockSentimentItem({
        sourceUrl: undefined,
      });

      render(<AnalysisPostCard post={post} />);

      // Should not throw
      await user.click(screen.getByRole('button'));

      expect(openInNewWindow).not.toHaveBeenCalled();
    });
  });
});
