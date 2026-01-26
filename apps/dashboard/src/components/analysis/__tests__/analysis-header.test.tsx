import { describe, expect, it } from 'vitest';

import { render, screen } from '@/__tests__/test-utils';
import { AnalysisHeader } from '../analysis-header';
import type { AnalysisHeaderProps } from '../types';

// =============================================================================
// Test Helpers
// =============================================================================

function renderAnalysisHeader(props: Partial<AnalysisHeaderProps> = {}) {
  const defaultProps: AnalysisHeaderProps = {
    query: 'test query',
    phase: { type: 'analyzing', jobId: 'job-123', query: 'test query' },
    ...props,
  };

  return render(<AnalysisHeader {...defaultProps} />);
}

// =============================================================================
// Tests
// =============================================================================

describe('AnalysisHeader', () => {
  describe('rendering', () => {
    it('renders the query text in curly quotes', () => {
      renderAnalysisHeader({ query: 'sentiment analysis test' });
      // Component uses &ldquo; and &rdquo; for curly quotes
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        '\u201Csentiment analysis test\u201D',
      );
    });

    it('renders the query as an h2 heading', () => {
      renderAnalysisHeader({ query: 'my query' });
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toBeInTheDocument();
    });

    it('renders post count', () => {
      renderAnalysisHeader({ postsProcessed: 42 });
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders posts label', () => {
      renderAnalysisHeader();
      expect(screen.getByText('Posts')).toBeInTheDocument();
    });

    it('defaults postsProcessed to 0', () => {
      renderAnalysisHeader({ postsProcessed: undefined });
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('renders total posts when provided', () => {
      renderAnalysisHeader({ postsProcessed: 25, totalPosts: 100 });
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText(/\/ 100/)).toBeInTheDocument();
    });

    it('does not render total posts when not provided', () => {
      renderAnalysisHeader({ postsProcessed: 25 });
      expect(screen.queryByText(/\//)).not.toBeInTheDocument();
    });
  });

  describe('status display', () => {
    describe('analyzing phase', () => {
      it('shows "Analyzing" status text', () => {
        renderAnalysisHeader({
          phase: { type: 'analyzing', jobId: 'job-123', query: 'test' },
        });
        expect(screen.getByText('Analyzing')).toBeInTheDocument();
      });
    });

    describe('completed phase', () => {
      it('shows "Analysis complete" status text', () => {
        renderAnalysisHeader({
          phase: { type: 'completed', jobId: 'job-123', query: 'test' },
        });
        expect(screen.getByText('Analysis complete')).toBeInTheDocument();
      });
    });

    describe('failed phase', () => {
      it('shows "Analysis failed" status text', () => {
        renderAnalysisHeader({
          phase: {
            type: 'failed',
            jobId: 'job-123',
            query: 'test',
            error: 'Something went wrong',
          },
        });
        expect(screen.getByText('Analysis failed')).toBeInTheDocument();
      });
    });

    describe('initial phase', () => {
      it('does not show any status text for initial phase', () => {
        renderAnalysisHeader({
          phase: { type: 'initial' },
        });
        expect(screen.queryByText('Analyzing')).not.toBeInTheDocument();
        expect(screen.queryByText('Analysis complete')).not.toBeInTheDocument();
        expect(screen.queryByText('Analysis failed')).not.toBeInTheDocument();
      });
    });

    describe('loading phase', () => {
      it('does not show any status text for loading phase', () => {
        renderAnalysisHeader({
          phase: { type: 'loading', jobId: 'job-123' },
        });
        expect(screen.queryByText('Analyzing')).not.toBeInTheDocument();
        expect(screen.queryByText('Analysis complete')).not.toBeInTheDocument();
        expect(screen.queryByText('Analysis failed')).not.toBeInTheDocument();
      });
    });
  });

  describe('error message', () => {
    it('shows error message when phase is failed and errorMessage is provided', () => {
      renderAnalysisHeader({
        phase: {
          type: 'failed',
          jobId: 'job-123',
          query: 'test',
          error: 'API error',
        },
        errorMessage: 'The analysis failed due to a network error',
      });
      expect(
        screen.getByText('The analysis failed due to a network error'),
      ).toBeInTheDocument();
    });

    it('does not show error message when phase is not failed', () => {
      renderAnalysisHeader({
        phase: { type: 'analyzing', jobId: 'job-123', query: 'test' },
        errorMessage: 'Some error',
      });
      expect(screen.queryByText('Some error')).not.toBeInTheDocument();
    });

    it('does not show error message when errorMessage is not provided', () => {
      renderAnalysisHeader({
        phase: {
          type: 'failed',
          jobId: 'job-123',
          query: 'test',
          error: 'err',
        },
        errorMessage: undefined,
      });
      // The component should not crash and the error section should not be rendered
      expect(screen.getByText('Analysis failed')).toBeInTheDocument();
    });

  });

  describe('edge cases', () => {
    it('handles empty query string', () => {
      renderAnalysisHeader({ query: '' });
      const heading = screen.getByRole('heading', { level: 2 });
      // Curly quotes around empty string
      expect(heading).toHaveTextContent('\u201C\u201D');
    });

    it('handles query with special characters', () => {
      renderAnalysisHeader({ query: 'test & "quotes" <script>' });
      const heading = screen.getByRole('heading', { level: 2 });
      // Curly quotes wrap the content
      expect(heading).toHaveTextContent(
        '\u201Ctest & "quotes" <script>\u201D',
      );
    });

    it('handles zero posts processed', () => {
      renderAnalysisHeader({ postsProcessed: 0 });
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('handles large post counts', () => {
      renderAnalysisHeader({ postsProcessed: 999999, totalPosts: 1000000 });
      expect(screen.getByText('999999')).toBeInTheDocument();
      expect(screen.getByText(/\/ 1000000/)).toBeInTheDocument();
    });

    it('handles posts processed greater than total', () => {
      renderAnalysisHeader({ postsProcessed: 150, totalPosts: 100 });
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText(/\/ 100/)).toBeInTheDocument();
    });
  });
});
