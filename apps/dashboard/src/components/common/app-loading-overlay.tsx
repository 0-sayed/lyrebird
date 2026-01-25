import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface AppLoadingOverlayProps {
  /** Whether the app is ready (overlay will fade out) */
  isReady: boolean;
  /** Minimum display time in ms to prevent flash (default: 300) */
  minDisplayTime?: number;
}

/**
 * Full-screen loading overlay that shows while the app initializes.
 *
 * Features:
 * - Prevents flash of incorrect content (FOIC)
 * - Smooth fade-out animation when ready
 * - Minimum display time to prevent jarring quick flash
 * - Centered green spinner
 */
export function AppLoadingOverlay({
  isReady,
  minDisplayTime = 300,
}: AppLoadingOverlayProps) {
  const [shouldShow, setShouldShow] = React.useState(true);
  const [isVisible, setIsVisible] = React.useState(true);
  const mountTimeRef = React.useRef(Date.now());

  React.useEffect(() => {
    if (!isReady) return;

    // Calculate remaining time to meet minimum display
    const elapsed = Date.now() - mountTimeRef.current;
    const remainingTime = Math.max(0, minDisplayTime - elapsed);

    // Wait for minimum time, then start fade out
    const fadeTimer = setTimeout(() => {
      setIsVisible(false);
    }, remainingTime);

    // Remove from DOM after fade animation completes
    const removeTimer = setTimeout(() => {
      setShouldShow(false);
    }, remainingTime + 300); // 300ms for fade animation

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [isReady, minDisplayTime]);

  if (!shouldShow) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!isVisible}
    >
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
