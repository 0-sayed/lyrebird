import { describe, expect, it } from 'vitest';
import { Activity } from 'lucide-react';

import { render, screen } from '@/__tests__/test-utils';
import { StatCard, type StatCardProps } from '../stat-card';

// =============================================================================
// Test Helpers
// =============================================================================

function renderStatCard(props: Partial<StatCardProps> = {}) {
  const defaultProps: StatCardProps = {
    icon: <Activity data-testid="stat-icon" />,
    label: 'Test Label',
    labelId: 'test-label-id',
    value: '42',
    ...props,
  };

  return render(<StatCard {...defaultProps} />);
}

// =============================================================================
// Tests
// =============================================================================

describe('StatCard', () => {
  describe('rendering', () => {
    it('renders the icon', () => {
      renderStatCard();
      expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
    });

    it('renders the label with correct id', () => {
      renderStatCard({ label: 'Total Posts', labelId: 'total-posts-label' });
      const label = screen.getByText('Total Posts');
      expect(label).toHaveAttribute('id', 'total-posts-label');
    });

    it('renders the value', () => {
      renderStatCard({ value: '1,234' });
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('renders subValue when provided', () => {
      renderStatCard({ subValue: 'Last updated: 5 min ago' });
      expect(screen.getByText('Last updated: 5 min ago')).toBeInTheDocument();
    });

    it('does not render subValue when not provided', () => {
      renderStatCard();
      expect(
        screen.queryByText(/Last updated/),
      ).not.toBeInTheDocument();
    });

    it('accepts ReactNode for label', () => {
      renderStatCard({
        label: <span data-testid="custom-label">Custom Label</span>,
      });
      expect(screen.getByTestId('custom-label')).toBeInTheDocument();
    });

    it('accepts ReactNode for subValue', () => {
      renderStatCard({
        subValue: <span data-testid="custom-subvalue">Custom Subvalue</span>,
      });
      expect(screen.getByTestId('custom-subvalue')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has region role with aria-labelledby', () => {
      renderStatCard({ labelId: 'my-stat-label' });
      const card = screen.getByRole('region');
      expect(card).toHaveAttribute('aria-labelledby', 'my-stat-label');
    });

    it('has aria-live="off" when not live', () => {
      renderStatCard({ isLive: false });
      const valueElement = screen.getByText('42');
      expect(valueElement).toHaveAttribute('aria-live', 'off');
    });

    it('has aria-live="polite" when live', () => {
      renderStatCard({ isLive: true });
      const valueElement = screen.getByText('42');
      expect(valueElement).toHaveAttribute('aria-live', 'polite');
    });

    it('has aria-atomic="true" on value', () => {
      renderStatCard();
      const valueElement = screen.getByText('42');
      expect(valueElement).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('live indicator', () => {
    it('shows live indicator when isLive is true', () => {
      renderStatCard({ isLive: true });
      expect(screen.getByText('Live data')).toBeInTheDocument();
    });

    it('does not show live indicator when isLive is false', () => {
      renderStatCard({ isLive: false });
      expect(screen.queryByText('Live data')).not.toBeInTheDocument();
    });

    it('does not show live indicator when isLive is undefined', () => {
      renderStatCard();
      expect(screen.queryByText('Live data')).not.toBeInTheDocument();
    });

    it('has sr-only text for screen readers', () => {
      renderStatCard({ isLive: true });
      const liveText = screen.getByText('Live data');
      expect(liveText).toHaveClass('sr-only');
    });
  });

  describe('empty state', () => {
    it('shows em dash value with aria-label when empty', () => {
      renderStatCard({ value: '\u2014' }); // em dash
      const emptyValue = screen.getByLabelText('No data');
      expect(emptyValue).toHaveTextContent('\u2014');
    });

    it('uses custom emptyLabel when provided', () => {
      renderStatCard({
        value: '\u2014',
        emptyLabel: 'Not available',
      });
      expect(screen.getByLabelText('Not available')).toBeInTheDocument();
    });

    it('does not add aria-label when value is not empty', () => {
      renderStatCard({ value: '100' });
      expect(screen.queryByLabelText('No data')).not.toBeInTheDocument();
    });
  });

});
