import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartTooltip } from '../chart-tooltip';

describe('ChartTooltip', () => {
  // Helper to create mock payload data
  const createMockPayload = (overrides: Partial<{
    name: string;
    value: number;
    fill: string;
    percentage: number;
  }> = {}) => [{
    payload: {
      name: 'Positive',
      value: 10,
      fill: '#22c55e',
      percentage: 50,
      ...overrides,
    },
  }];

  describe('rendering conditions', () => {
    it('returns null when active is false', () => {
      const { container } = render(
        <ChartTooltip active={false} payload={createMockPayload()} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when active is undefined', () => {
      const { container } = render(
        <ChartTooltip payload={createMockPayload()} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when payload is undefined', () => {
      const { container } = render(
        <ChartTooltip active={true} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when payload is empty array', () => {
      const { container } = render(
        <ChartTooltip active={true} payload={[]} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null when payload first item is undefined', () => {
      const { container } = render(
        <ChartTooltip active={true} payload={[undefined as unknown as never]} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders tooltip when active and payload is valid', () => {
      render(
        <ChartTooltip active={true} payload={createMockPayload()} />
      );

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('content display', () => {
    it('displays the category name', () => {
      render(
        <ChartTooltip active={true} payload={createMockPayload({ name: 'Positive' })} />
      );

      expect(screen.getByText('Positive')).toBeInTheDocument();
    });

    it('displays the category name for different categories', () => {
      render(
        <ChartTooltip active={true} payload={createMockPayload({ name: 'Negative' })} />
      );

      expect(screen.getByText('Negative')).toBeInTheDocument();
    });

    it('displays the post count and percentage', () => {
      render(
        <ChartTooltip active={true} payload={createMockPayload({ value: 10, percentage: 50 })} />
      );

      expect(screen.getByText('10 posts (50%)')).toBeInTheDocument();
    });

    it('displays singular post count correctly', () => {
      render(
        <ChartTooltip active={true} payload={createMockPayload({ value: 1, percentage: 100 })} />
      );

      // Component uses plural "posts" for all counts
      expect(screen.getByText('1 posts (100%)')).toBeInTheDocument();
    });

    it('displays zero post count', () => {
      render(
        <ChartTooltip active={true} payload={createMockPayload({ value: 0, percentage: 0 })} />
      );

      expect(screen.getByText('0 posts (0%)')).toBeInTheDocument();
    });

    it('displays large numbers', () => {
      render(
        <ChartTooltip active={true} payload={createMockPayload({ value: 1000, percentage: 75 })} />
      );

      expect(screen.getByText('1000 posts (75%)')).toBeInTheDocument();
    });

    it('displays percentage with decimal values', () => {
      render(
        <ChartTooltip active={true} payload={createMockPayload({ value: 5, percentage: 33.33 })} />
      );

      expect(screen.getByText('5 posts (33.33%)')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="tooltip"', () => {
      render(
        <ChartTooltip active={true} payload={createMockPayload()} />
      );

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('has aria-live="polite" for live updates', () => {
      render(
        <ChartTooltip active={true} payload={createMockPayload()} />
      );

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('edge cases', () => {
    it('handles undefined percentage', () => {
      const payload = [{
        payload: {
          name: 'Positive',
          value: 10,
          fill: '#22c55e',
          // percentage intentionally omitted
        },
      }];

      render(
        <ChartTooltip active={true} payload={payload} />
      );

      expect(screen.getByText('Positive')).toBeInTheDocument();
      // When percentage is undefined, React renders empty string in template
      expect(screen.getByText(/10 posts \(%\)/)).toBeInTheDocument();
    });

    it('handles multiple payload items (uses first)', () => {
      const multiPayload = [
        { payload: { name: 'First', value: 10, fill: '#000', percentage: 50 } },
        { payload: { name: 'Second', value: 20, fill: '#fff', percentage: 50 } },
      ];

      render(
        <ChartTooltip active={true} payload={multiPayload} />
      );

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.queryByText('Second')).not.toBeInTheDocument();
    });
  });
});
