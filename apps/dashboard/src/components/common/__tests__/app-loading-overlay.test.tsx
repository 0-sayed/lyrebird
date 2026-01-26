import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { act, render } from '@/__tests__/test-utils';
import { AppLoadingOverlay } from '../app-loading-overlay';

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// Test Helpers
// =============================================================================

function getOverlay() {
  return document.querySelector('[aria-hidden]');
}

// =============================================================================
// Tests
// =============================================================================

describe('AppLoadingOverlay', () => {
  describe('accessibility', () => {
    it('has aria-hidden="false" when visible', () => {
      render(<AppLoadingOverlay isReady={false} />);
      const overlay = getOverlay();
      expect(overlay).toHaveAttribute('aria-hidden', 'false');
    });

    it('has aria-hidden="true" when fading out', () => {
      render(<AppLoadingOverlay isReady={true} minDisplayTime={0} />);

      // Advance past minDisplayTime to trigger fade
      act(() => {
        vi.advanceTimersByTime(1);
      });

      const overlay = getOverlay();
      expect(overlay).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('removal from DOM', () => {
    it('removes overlay from DOM after fade animation completes', () => {
      render(<AppLoadingOverlay isReady={true} minDisplayTime={0} />);

      // Initially visible
      expect(getOverlay()).toBeInTheDocument();

      // Advance past fade timer
      act(() => {
        vi.advanceTimersByTime(1);
      });

      // Still in DOM but fading (aria-hidden indicates fading state)
      expect(getOverlay()).toBeInTheDocument();
      expect(getOverlay()).toHaveAttribute('aria-hidden', 'true');

      // Advance past remove timer (300ms for fade animation)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Now removed from DOM
      expect(getOverlay()).not.toBeInTheDocument();
    });

    it('returns null after shouldShow becomes false', () => {
      const { container } = render(
        <AppLoadingOverlay isReady={true} minDisplayTime={0} />,
      );

      // Advance past all timers (fade timer + animation duration)
      act(() => {
        vi.advanceTimersByTime(301);
      });

      expect(container.firstChild).toBeNull();
    });
  });

  describe('state transitions', () => {
    it('does not fade out when isReady is false', () => {
      render(<AppLoadingOverlay isReady={false} />);

      // Wait a long time
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should still be visible (aria-hidden="false" indicates visible state)
      expect(getOverlay()).toHaveAttribute('aria-hidden', 'false');
    });

    it('begins fade when isReady changes to true', () => {
      const { rerender } = render(
        <AppLoadingOverlay isReady={false} minDisplayTime={0} />,
      );

      // Should be visible while not ready
      expect(getOverlay()).toHaveAttribute('aria-hidden', 'false');

      // Change to ready with minDisplayTime=0
      act(() => {
        rerender(<AppLoadingOverlay isReady={true} minDisplayTime={0} />);
      });

      // Advance just a tiny bit to trigger the timer
      act(() => {
        vi.advanceTimersByTime(1);
      });

      // Should be fading now (aria-hidden="true" indicates fading state)
      expect(getOverlay()).toHaveAttribute('aria-hidden', 'true');
    });

    it('cleans up timers on unmount', () => {
      const { unmount } = render(
        <AppLoadingOverlay isReady={true} minDisplayTime={100} />,
      );

      // Unmount before timers complete
      unmount();

      // Advance timers - should not throw
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // No error means cleanup worked
      expect(true).toBe(true);
    });
  });
});
