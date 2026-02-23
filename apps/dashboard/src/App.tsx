import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { lazy, Suspense } from 'react';

import { ThemeProvider } from '@/providers/theme-provider';
import { AuthGuard } from '@/components/auth-guard';
import { Dashboard } from '@/pages';
import { TermsOfServicePage } from '@/pages/terms-of-service';
import { PrivacyPolicyPage } from '@/pages/privacy-policy';
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
  const pathname = window.location.pathname;

  if (pathname === '/terms') {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="lyrebird-theme">
        <TermsOfServicePage />
      </ThemeProvider>
    );
  }

  if (pathname === '/privacy') {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="lyrebird-theme">
        <PrivacyPolicyPage />
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="lyrebird-theme">
        <AuthGuard>
          <Dashboard />
        </AuthGuard>
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
