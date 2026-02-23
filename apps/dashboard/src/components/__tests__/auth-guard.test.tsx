import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/__tests__/test-utils';
import { AuthGuard } from '../auth-guard';

// =============================================================================
// Mocks
// =============================================================================

let mockSession: { user: { id: string; name: string } } | null = null;
let mockIsPending = false;

vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({
    data: mockSession,
    isPending: mockIsPending,
  }),
  signIn: { social: vi.fn() },
}));

// =============================================================================
// Tests
// =============================================================================

describe('AuthGuard', () => {
  beforeEach(() => {
    mockSession = null;
    mockIsPending = false;
  });

  describe('when not authenticated', () => {
    it('should show sign-in page', () => {
      render(
        <AuthGuard>
          <div>Protected content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Lyrebird')).toBeInTheDocument();
      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    });
  });

  describe('when session is pending', () => {
    it('should show loading spinner', () => {
      mockSession = null;
      mockIsPending = true;

      const { container } = render(
        <AuthGuard>
          <div>Protected content</div>
        </AuthGuard>,
      );

      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Continue with Google'),
      ).not.toBeInTheDocument();
    });
  });

  describe('when authenticated', () => {
    it('should show children', () => {
      mockSession = { user: { id: 'user-1', name: 'Test User' } };
      mockIsPending = false;

      render(
        <AuthGuard>
          <div>Protected content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Protected content')).toBeInTheDocument();
      expect(
        screen.queryByText('Continue with Google'),
      ).not.toBeInTheDocument();
    });
  });
});
