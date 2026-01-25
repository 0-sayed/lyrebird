import * as React from 'react';

import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    // Ensure max is positive to avoid division by zero
    const safeMax = max > 0 ? max : 1;
    // Clamp value within valid range for ARIA compliance
    const clampedValue = Math.min(Math.max(value, 0), safeMax);
    const percentage = (clampedValue / safeMax) * 100;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clampedValue}
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
          className,
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-primary transition-all"
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    );
  },
);
Progress.displayName = 'Progress';

export { Progress };
