import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { DEFAULT_QUERY_OPTIONS } from './constants';

/**
 * Creates and configures the QueryClient instance
 *
 * Features:
 * - Sensible default stale/cache times
 * - Global error handling with toast notifications
 * - Retry configuration
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...DEFAULT_QUERY_OPTIONS,
      },
      mutations: {
        retry: 1,
        onError: (error) => {
          // Global mutation error handler
          const message =
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred';
          toast.error('Error', {
            description: message,
          });
        },
      },
    },
  });
}

/**
 * Singleton QueryClient instance for the application
 * Use this in App.tsx and for imperative cache operations
 */
export const queryClient = createQueryClient();
