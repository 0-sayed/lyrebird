/**
 * Tests for useAnalysisPhase hook
 *
 * This hook manages the analysis workflow state machine with phases:
 * initial, loading, analyzing, completed, failed
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { useAnalysisPhase } from '../use-analysis-phase';

// =============================================================================
// Initial State Tests
// =============================================================================

describe('useAnalysisPhase', () => {
  describe('Initial State', () => {
    it('starts with initial phase when no initialJobId', () => {
      const { result } = renderHook(() => useAnalysisPhase({}));

      expect(result.current.phase).toEqual({ type: 'initial' });
      expect(result.current.isExiting).toBe(false);
      expect(result.current.currentJobId).toBeUndefined();
    });

    it('starts with loading phase when initialJobId provided', () => {
      const { result } = renderHook(() =>
        useAnalysisPhase({ initialJobId: 'job-123' }),
      );

      expect(result.current.phase).toEqual({
        type: 'loading',
        jobId: 'job-123',
      });
      expect(result.current.currentJobId).toBe('job-123');
    });

    it('handles null initialJobId as no job', () => {
      const { result } = renderHook(() =>
        useAnalysisPhase({ initialJobId: null }),
      );

      expect(result.current.phase).toEqual({ type: 'initial' });
    });
  });

  // ===========================================================================
  // Phase Transitions
  // ===========================================================================

  describe('Phase Transitions', () => {
    it('transitions from initial to analyzing', () => {
      const { result } = renderHook(() => useAnalysisPhase({}));

      act(() => {
        result.current.setPhase({
          type: 'analyzing',
          jobId: 'job-123',
          query: 'test query',
        });
      });

      expect(result.current.phase).toEqual({
        type: 'analyzing',
        jobId: 'job-123',
        query: 'test query',
      });
      expect(result.current.currentJobId).toBe('job-123');
    });

    it('transitions from analyzing to completed', () => {
      const { result } = renderHook(() => useAnalysisPhase({}));

      // First go to analyzing
      act(() => {
        result.current.setPhase({
          type: 'analyzing',
          jobId: 'job-123',
          query: 'test query',
        });
      });

      // Then to completed
      act(() => {
        result.current.setPhase({
          type: 'completed',
          jobId: 'job-123',
          query: 'test query',
        });
      });

      expect(result.current.phase).toEqual({
        type: 'completed',
        jobId: 'job-123',
        query: 'test query',
      });
    });

    it('transitions from analyzing to failed', () => {
      const { result } = renderHook(() => useAnalysisPhase({}));

      act(() => {
        result.current.setPhase({
          type: 'analyzing',
          jobId: 'job-123',
          query: 'test query',
        });
      });

      act(() => {
        result.current.setPhase({
          type: 'failed',
          jobId: 'job-123',
          query: 'test query',
          error: 'Analysis failed',
        });
      });

      expect(result.current.phase).toEqual({
        type: 'failed',
        jobId: 'job-123',
        query: 'test query',
        error: 'Analysis failed',
      });
    });

    it('transitions from loading to completed', () => {
      const { result } = renderHook(() =>
        useAnalysisPhase({ initialJobId: 'job-123' }),
      );

      act(() => {
        result.current.setPhase({
          type: 'completed',
          jobId: 'job-123',
          query: 'loaded query',
        });
      });

      expect(result.current.phase.type).toBe('completed');
    });
  });

  // ===========================================================================
  // Exiting State
  // ===========================================================================

  describe('Exiting State', () => {
    it('tracks isExiting state', () => {
      const { result } = renderHook(() => useAnalysisPhase({}));

      expect(result.current.isExiting).toBe(false);

      act(() => {
        result.current.setIsExiting(true);
      });

      expect(result.current.isExiting).toBe(true);

      act(() => {
        result.current.setIsExiting(false);
      });

      expect(result.current.isExiting).toBe(false);
    });
  });

  // ===========================================================================
  // Current Job ID
  // ===========================================================================

  describe('Current Job ID', () => {
    it('returns undefined when in initial phase', () => {
      const { result } = renderHook(() => useAnalysisPhase({}));

      expect(result.current.currentJobId).toBeUndefined();
    });

    it('returns initialJobId when in initial phase with initialJobId', () => {
      const { result } = renderHook(() =>
        useAnalysisPhase({ initialJobId: 'job-123' }),
      );

      // Even though phase is 'loading', currentJobId should be available
      expect(result.current.currentJobId).toBe('job-123');
    });

    it('returns jobId from phase when not in initial phase', () => {
      const { result } = renderHook(() => useAnalysisPhase({}));

      act(() => {
        result.current.setPhase({
          type: 'analyzing',
          jobId: 'job-456',
          query: 'test',
        });
      });

      expect(result.current.currentJobId).toBe('job-456');
    });
  });

  // ===========================================================================
  // setPhase with Callback
  // ===========================================================================

  describe('setPhase with Callback', () => {
    it('supports functional updates', () => {
      const { result } = renderHook(() => useAnalysisPhase({}));

      act(() => {
        result.current.setPhase({
          type: 'analyzing',
          jobId: 'job-123',
          query: 'test',
        });
      });

      act(() => {
        result.current.setPhase((prev) => {
          if (prev.type === 'analyzing') {
            return {
              type: 'completed',
              jobId: prev.jobId,
              query: prev.query,
            };
          }
          return prev;
        });
      });

      expect(result.current.phase.type).toBe('completed');
    });
  });

  // ===========================================================================
  // Return Type Stability
  // ===========================================================================

  describe('Return Type Stability', () => {
    it('returns all expected properties', () => {
      const { result } = renderHook(() => useAnalysisPhase({}));

      expect(result.current).toHaveProperty('phase');
      expect(result.current).toHaveProperty('setPhase');
      expect(result.current).toHaveProperty('isExiting');
      expect(result.current).toHaveProperty('setIsExiting');
      expect(result.current).toHaveProperty('currentJobId');
    });

    it('maintains function reference stability on rerender', () => {
      const { result, rerender } = renderHook(() => useAnalysisPhase({}));

      const initialSetPhase = result.current.setPhase;
      const initialSetIsExiting = result.current.setIsExiting;

      rerender();

      // React setState functions should be stable
      expect(result.current.setPhase).toBe(initialSetPhase);
      expect(result.current.setIsExiting).toBe(initialSetIsExiting);
    });
  });
});
