import * as React from 'react';

import { RootLayout } from '@/components/layout';
import { AnalysisView } from '@/components/analysis';
import { AppLoadingOverlay } from '@/components/common';
import { getStoredValue, getSidebarCookieState } from '@/hooks';
import { STORAGE_KEYS } from '@/lib/constants';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Gets the initial active job ID from localStorage.
 * Restores the last opened job on app start.
 */
function getInitialJobId(): string | null {
  return getStoredValue<string | null>(STORAGE_KEYS.LAST_JOB_ID, null);
}

/**
 * Persists the active job ID to localStorage.
 */
function persistJobId(jobId: string | null): void {
  if (typeof window === 'undefined') return;

  try {
    if (jobId) {
      window.localStorage.setItem(
        STORAGE_KEYS.LAST_JOB_ID,
        JSON.stringify(jobId),
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.LAST_JOB_ID);
    }
  } catch (error) {
    console.warn('Error persisting job ID:', error);
  }
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Main dashboard component with analysis-centered UI
 *
 * Refactored from the chat-like interface to a clean, analysis-focused experience:
 * - Initial state: Centered welcome prompt
 * - Analysis state: Real-time chart with stats
 * - Completed state: Full results with posts sidebar
 *
 * Features:
 * - Real-time job status updates via SSE
 * - History navigation via sidebar
 * - Sentiment visualization with area chart
 * - Persists last opened job and sidebar states to localStorage
 */
export function Dashboard() {
  // Track if app is ready (initial hydration complete)
  const [isAppReady, setIsAppReady] = React.useState(false);

  // Read initial sidebar state from cookie (shadcn sidebar uses cookies)
  const initialSidebarOpen = React.useMemo(() => getSidebarCookieState(), []);

  // Active job state with localStorage persistence
  const [activeJobId, setActiveJobIdState] = React.useState<string | null>(
    getInitialJobId,
  );

  // Persist to localStorage when activeJobId changes
  React.useEffect(() => {
    persistJobId(activeJobId);
  }, [activeJobId]);

  // Mark app as ready after first render
  React.useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is painted
    const raf = requestAnimationFrame(() => {
      setIsAppReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Handlers - single function for setting active job
  const setActiveJobId = React.useCallback((jobId: string | null) => {
    setActiveJobIdState(jobId);
  }, []);

  const handleJobDeleted = React.useCallback(
    (jobId: string) => {
      // If the deleted job is the active one, clear it
      if (activeJobId === jobId) {
        setActiveJobIdState(null);
      }
    },
    [activeJobId],
  );

  return (
    <>
      {/* Loading overlay - covers everything until app is ready */}
      <AppLoadingOverlay isReady={isAppReady} minDisplayTime={200} />

      <RootLayout
        activeJobId={activeJobId ?? undefined}
        initialSidebarOpen={initialSidebarOpen}
        onNewChat={() => setActiveJobId(null)}
        onSelectJob={setActiveJobId}
        onJobDeleted={handleJobDeleted}
      >
        <AnalysisView
          key={activeJobId ?? 'new'}
          initialJobId={activeJobId ?? undefined}
          onNewAnalysis={setActiveJobId}
          onComplete={setActiveJobId}
        />
      </RootLayout>
    </>
  );
}
