import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { lazy, Suspense } from 'react';

import { ThemeProvider } from '@/providers/theme-provider';
import { Dashboard } from '@/pages';
import { queryClient } from '@/lib/query-client';

// Lazy load devtools and only in development
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((mod) => ({
        default: mod.ReactQueryDevtools,
      })),
    )
  : () => null;

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="lyrebird-theme">
        <Dashboard />
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition="bottom-right"
          />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}

export default App;
