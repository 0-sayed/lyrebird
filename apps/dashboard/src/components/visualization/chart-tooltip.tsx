import type { TooltipProps } from 'recharts';
import type {
  NameType,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent';

// =============================================================================
// Types
// =============================================================================

interface ChartDataItem {
  name: string;
  value: number;
  fill: string;
  percentage?: number;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Custom tooltip for Recharts pie charts
 *
 * Displays sentiment category name, post count, and percentage
 */
export function ChartTooltip({
  active,
  payload,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0 || !payload[0]) {
    return null;
  }

  const data = payload[0].payload as ChartDataItem;

  return (
    <div
      className="rounded-lg border bg-popover px-3 py-2 shadow-md"
      role="tooltip"
      aria-live="polite"
    >
      <p className="font-medium">{data.name}</p>
      <p className="text-sm text-muted-foreground">
        {data.value} posts ({data.percentage}%)
      </p>
    </div>
  );
}
