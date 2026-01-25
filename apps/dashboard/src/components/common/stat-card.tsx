import * as React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface StatCardProps {
  icon: React.ReactNode;
  label: React.ReactNode;
  labelId: string;
  value: string;
  valueColorClass?: string;
  subValue?: React.ReactNode;
  isLive?: boolean;
  emptyLabel?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Generic statistic card with icon, label, value, and optional subvalue
 *
 * Features:
 * - Consistent styling across all stat displays
 * - Live indicator animation
 * - Accessibility support via labelId
 */
export function StatCard({
  icon,
  label,
  labelId,
  value,
  valueColorClass,
  subValue,
  isLive,
  emptyLabel = 'No data',
}: StatCardProps) {
  const isEmpty = value === '\u2014'; // em dash

  return (
    <Card
      className="w-full min-w-[180px] flex-1 sm:max-w-[280px]"
      role="region"
      aria-labelledby={labelId}
    >
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span id={labelId} className="text-sm font-medium">
            {label}
          </span>
          {isLive && (
            <>
              <span
                className="ml-auto h-2 w-2 animate-pulse rounded-full bg-green-500"
                aria-hidden="true"
              />
              <span className="sr-only">Live data</span>
            </>
          )}
        </div>
        <div
          className={cn(
            'mt-2 text-2xl font-bold tabular-nums',
            valueColorClass,
          )}
          aria-live={isLive ? 'polite' : 'off'}
          aria-atomic="true"
        >
          {isEmpty ? <span aria-label={emptyLabel}>{value}</span> : value}
        </div>
        {subValue && (
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {subValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
