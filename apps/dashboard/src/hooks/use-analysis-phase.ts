import * as React from 'react';

import type { AnalysisPhase } from '@/components/analysis/types';

// =============================================================================
// Types
// =============================================================================

export interface UseAnalysisPhaseOptions {
  /** Initial job ID to load */
  initialJobId?: string | null;
}

export interface UseAnalysisPhaseReturn {
  /** Current phase of the analysis workflow */
  phase: AnalysisPhase;
  /** Update the phase */
  setPhase: React.Dispatch<React.SetStateAction<AnalysisPhase>>;
  /** Whether the UI is animating out */
  isExiting: boolean;
  /** Set exiting state */
  setIsExiting: React.Dispatch<React.SetStateAction<boolean>>;
  /** Get the current job ID from the phase */
  currentJobId: string | null | undefined;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Manages the analysis workflow state machine
 *
 * States:
 * - initial: Shows centered welcome prompt
 * - loading: Fetching saved job data
 * - analyzing: Shows header + real-time chart + stats
 * - completed: Shows header + chart + stats + posts sidebar
 * - failed: Shows header with error message
 */
export function useAnalysisPhase({
  initialJobId,
}: UseAnalysisPhaseOptions): UseAnalysisPhaseReturn {
  // State machine - start with 'loading' if we have an initialJobId to prevent welcome flash
  const [phase, setPhase] = React.useState<AnalysisPhase>(() =>
    initialJobId
      ? { type: 'loading', jobId: initialJobId }
      : { type: 'initial' },
  );
  const [isExiting, setIsExiting] = React.useState(false);

  // Get the current job ID from phase
  const currentJobId = phase.type !== 'initial' ? phase.jobId : initialJobId;

  return {
    phase,
    setPhase,
    isExiting,
    setIsExiting,
    currentJobId,
  };
}
