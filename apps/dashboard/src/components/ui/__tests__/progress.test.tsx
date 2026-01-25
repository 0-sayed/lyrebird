/**
 * Tests for Progress component
 *
 * Tests cover edge cases for numeric input validation and ARIA compliance.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Progress } from '../progress';

describe('Progress', () => {
  describe('basic rendering', () => {
    it('renders with default values', () => {
      render(<Progress />);
      const progressbar = screen.getByRole('progressbar');

      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      expect(progressbar).toHaveAttribute('aria-valuenow', '0');
    });

    it('renders with custom value and max', () => {
      render(<Progress value={50} max={200} />);
      const progressbar = screen.getByRole('progressbar');

      expect(progressbar).toHaveAttribute('aria-valuenow', '50');
      expect(progressbar).toHaveAttribute('aria-valuemax', '200');
    });
  });

  describe('edge cases', () => {
    it('handles max=0 without crashing (no NaN/Infinity)', () => {
      render(<Progress value={50} max={0} />);
      const progressbar = screen.getByRole('progressbar');

      // Should use safeMax of 1, clamping value to 1
      expect(progressbar).toHaveAttribute('aria-valuemax', '1');
      expect(progressbar).toHaveAttribute('aria-valuenow', '1');
    });

    it('handles negative max without crashing', () => {
      render(<Progress value={50} max={-10} />);
      const progressbar = screen.getByRole('progressbar');

      // Should use safeMax of 1
      expect(progressbar).toHaveAttribute('aria-valuemax', '1');
      expect(progressbar).toHaveAttribute('aria-valuenow', '1');
    });

    it('clamps value to not exceed max (ARIA compliance)', () => {
      render(<Progress value={150} max={100} />);
      const progressbar = screen.getByRole('progressbar');

      // aria-valuenow should not exceed aria-valuemax
      expect(progressbar).toHaveAttribute('aria-valuenow', '100');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });

    it('clamps negative values to 0', () => {
      render(<Progress value={-50} max={100} />);
      const progressbar = screen.getByRole('progressbar');

      expect(progressbar).toHaveAttribute('aria-valuenow', '0');
    });
  });

  describe('ARIA compliance', () => {
    it('aria-valuenow is always between aria-valuemin and aria-valuemax', () => {
      render(<Progress value={75} max={100} />);
      const progressbar = screen.getByRole('progressbar');

      const valueNow = Number(progressbar.getAttribute('aria-valuenow'));
      const valueMin = Number(progressbar.getAttribute('aria-valuemin'));
      const valueMax = Number(progressbar.getAttribute('aria-valuemax'));

      expect(valueNow).toBeGreaterThanOrEqual(valueMin);
      expect(valueNow).toBeLessThanOrEqual(valueMax);
    });
  });
});
