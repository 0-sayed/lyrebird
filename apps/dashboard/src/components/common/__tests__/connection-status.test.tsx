import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { render, screen, userEvent, waitFor } from '@/__tests__/test-utils';
import { ConnectionStatus } from '../connection-status';
import type { ConnectionStatus as ConnectionStatusType } from '@/hooks';

// =============================================================================
// Test Helpers
// =============================================================================

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  lastHeartbeat?: Date | null;
  reconnectAttempts?: number;
  className?: string;
}

function renderConnectionStatus(props: Partial<ConnectionStatusProps> = {}) {
  const defaultProps: ConnectionStatusProps = {
    status: 'connected',
    ...props,
  };

  return render(<ConnectionStatus {...defaultProps} />);
}

// =============================================================================
// Tests
// =============================================================================

describe('ConnectionStatus', () => {
  describe('status rendering', () => {
    it('renders connected status with correct label', () => {
      renderConnectionStatus({ status: 'connected' });
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('renders connecting status with correct label', () => {
      renderConnectionStatus({ status: 'connecting' });
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('renders disconnected status with correct label', () => {
      renderConnectionStatus({ status: 'disconnected' });
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('renders error status with correct label', () => {
      renderConnectionStatus({ status: 'error' });
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has status role', () => {
      renderConnectionStatus({ status: 'connected' });
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('has aria-live="polite" for screen readers', () => {
      renderConnectionStatus({ status: 'connected' });
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
    });

    it('has aria-label for connected status', () => {
      renderConnectionStatus({ status: 'connected' });
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute(
        'aria-label',
        'Connection status: Connected',
      );
    });

    it('has aria-label for connecting status', () => {
      renderConnectionStatus({ status: 'connecting' });
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute(
        'aria-label',
        'Connection status: Connecting...',
      );
    });

    it('has aria-label for disconnected status', () => {
      renderConnectionStatus({ status: 'disconnected' });
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute(
        'aria-label',
        'Connection status: Disconnected',
      );
    });

    it('has aria-label for error status', () => {
      renderConnectionStatus({ status: 'error' });
      const statusElement = screen.getByRole('status');
      expect(statusElement).toHaveAttribute(
        'aria-label',
        'Connection status: Connection Error',
      );
    });

    it('hides icon from screen readers with aria-hidden', () => {
      renderConnectionStatus({ status: 'connected' });
      const statusElement = screen.getByRole('status');
      const icon = statusElement.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('tooltip content', () => {
    const user = userEvent.setup();
    let originalToLocaleTimeString: typeof Date.prototype.toLocaleTimeString;

    beforeEach(() => {
      // Mock toLocaleTimeString to return consistent values
      originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
      Date.prototype.toLocaleTimeString = vi.fn(() => '2:30:00 PM');
    });

    afterEach(() => {
      Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
    });

    it('shows status label in tooltip when hovered', async () => {
      renderConnectionStatus({ status: 'connected' });
      const trigger = screen.getByRole('status');
      await user.hover(trigger);
      await waitFor(() => {
        // Tooltip shows status label (Connected appears in badge and tooltip)
        expect(screen.getAllByText('Connected').length).toBeGreaterThanOrEqual(
          1,
        );
      });
    });

    it('shows last heartbeat time when provided and hovered', async () => {
      const heartbeat = new Date('2024-01-15T14:30:00');
      renderConnectionStatus({
        status: 'connected',
        lastHeartbeat: heartbeat,
      });
      const trigger = screen.getByRole('status');
      await user.hover(trigger);
      await waitFor(() => {
        // Tooltip content may be rendered multiple times (visible + sr-only)
        expect(
          screen.getAllByText(/Last update: 2:30:00 PM/).length,
        ).toBeGreaterThanOrEqual(1);
      });
    });

    it('does not show last heartbeat in tooltip when null', async () => {
      renderConnectionStatus({
        status: 'connected',
        lastHeartbeat: null,
      });
      const trigger = screen.getByRole('status');
      await user.hover(trigger);
      // Give tooltip time to appear
      await waitFor(() => {
        expect(screen.getAllByText('Connected').length).toBeGreaterThanOrEqual(
          1,
        );
      });
      expect(screen.queryByText(/Last update/)).not.toBeInTheDocument();
    });

    it('does not show last heartbeat in tooltip when undefined', async () => {
      renderConnectionStatus({
        status: 'connected',
        lastHeartbeat: undefined,
      });
      const trigger = screen.getByRole('status');
      await user.hover(trigger);
      await waitFor(() => {
        expect(screen.getAllByText('Connected').length).toBeGreaterThanOrEqual(
          1,
        );
      });
      expect(screen.queryByText(/Last update/)).not.toBeInTheDocument();
    });

    it('shows reconnect attempts for error status when hovered', async () => {
      renderConnectionStatus({
        status: 'error',
        reconnectAttempts: 3,
      });
      const trigger = screen.getByRole('status');
      await user.hover(trigger);
      await waitFor(() => {
        // Tooltip content may be rendered multiple times (visible + sr-only)
        expect(
          screen.getAllByText(/Reconnect attempts: 3/).length,
        ).toBeGreaterThanOrEqual(1);
      });
    });

    it('does not show reconnect attempts when zero', async () => {
      renderConnectionStatus({
        status: 'error',
        reconnectAttempts: 0,
      });
      const trigger = screen.getByRole('status');
      await user.hover(trigger);
      await waitFor(() => {
        expect(
          screen.getAllByText('Connection Error').length,
        ).toBeGreaterThanOrEqual(1);
      });
      expect(screen.queryByText(/Reconnect attempts/)).not.toBeInTheDocument();
    });

    it('does not show reconnect attempts for connected status', async () => {
      renderConnectionStatus({
        status: 'connected',
        reconnectAttempts: 5,
      });
      const trigger = screen.getByRole('status');
      await user.hover(trigger);
      await waitFor(() => {
        expect(screen.getAllByText('Connected').length).toBeGreaterThanOrEqual(
          1,
        );
      });
      expect(screen.queryByText(/Reconnect attempts/)).not.toBeInTheDocument();
    });

    it('does not show reconnect attempts for connecting status', async () => {
      renderConnectionStatus({
        status: 'connecting',
        reconnectAttempts: 2,
      });
      const trigger = screen.getByRole('status');
      await user.hover(trigger);
      await waitFor(() => {
        expect(
          screen.getAllByText('Connecting...').length,
        ).toBeGreaterThanOrEqual(1);
      });
      expect(screen.queryByText(/Reconnect attempts/)).not.toBeInTheDocument();
    });

    it('does not show reconnect attempts for disconnected status', async () => {
      renderConnectionStatus({
        status: 'disconnected',
        reconnectAttempts: 1,
      });
      const trigger = screen.getByRole('status');
      await user.hover(trigger);
      await waitFor(() => {
        expect(
          screen.getAllByText('Disconnected').length,
        ).toBeGreaterThanOrEqual(1);
      });
      expect(screen.queryByText(/Reconnect attempts/)).not.toBeInTheDocument();
    });

    it('shows both heartbeat and reconnect attempts for error status', async () => {
      const heartbeat = new Date('2024-01-15T14:30:00');
      renderConnectionStatus({
        status: 'error',
        lastHeartbeat: heartbeat,
        reconnectAttempts: 5,
      });
      const trigger = screen.getByRole('status');
      await user.hover(trigger);
      await waitFor(() => {
        // Tooltip content may be rendered multiple times (visible + sr-only)
        expect(
          screen.getAllByText(/Last update: 2:30:00 PM/).length,
        ).toBeGreaterThanOrEqual(1);
      });
      expect(
        screen.getAllByText(/Reconnect attempts: 5/).length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

});
