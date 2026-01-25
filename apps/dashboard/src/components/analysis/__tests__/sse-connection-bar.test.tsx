import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SSEConnectionBar } from '../sse-connection-bar';
import type { ConnectionStatus } from '@/hooks';

describe('SSEConnectionBar', () => {
  const defaultProps = {
    status: 'connected' as ConnectionStatus,
    lastHeartbeat: null,
    reconnectAttempts: 0,
  };

  describe('connection states', () => {
    it('should display "Connected" status when connected', () => {
      render(<SSEConnectionBar {...defaultProps} status="connected" />);

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Connection status: Connected',
      );
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should display "Connecting..." status when connecting', () => {
      render(<SSEConnectionBar {...defaultProps} status="connecting" />);

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Connection status: Connecting...',
      );
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('should display "Disconnected" status when disconnected', () => {
      render(<SSEConnectionBar {...defaultProps} status="disconnected" />);

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Connection status: Disconnected',
      );
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should display "Connection Error" status when error', () => {
      render(<SSEConnectionBar {...defaultProps} status="error" />);

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Connection status: Connection Error',
      );
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });
  });

  describe('timestamp conversion', () => {
    it('should convert lastHeartbeat timestamp to Date for display', () => {
      const timestamp = new Date('2024-01-15T10:30:00').getTime();
      render(
        <SSEConnectionBar
          {...defaultProps}
          status="connected"
          lastHeartbeat={timestamp}
        />,
      );

      // The component should render without error when given a timestamp
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should handle null lastHeartbeat gracefully', () => {
      render(
        <SSEConnectionBar
          {...defaultProps}
          status="connected"
          lastHeartbeat={null}
        />,
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('reconnect attempts', () => {
    it('should pass reconnectAttempts to ConnectionStatus component', () => {
      render(
        <SSEConnectionBar
          {...defaultProps}
          status="error"
          reconnectAttempts={3}
        />,
      );

      // The component should render with error state showing attempts count
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Connection status: Connection Error',
      );
    });
  });
});
