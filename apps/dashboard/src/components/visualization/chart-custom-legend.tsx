// =============================================================================
// Types
// =============================================================================

interface ChartDataItem {
  name: string;
  value: number;
  fill: string;
  percentage?: number;
}

export interface ChartCustomLegendProps {
  data: ChartDataItem[];
  total: number;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Custom legend for Recharts charts with percentage display
 *
 * Features:
 * - Color-coded markers
 * - Percentage calculation
 * - Accessible list structure
 */
export function ChartCustomLegend({ data, total }: ChartCustomLegendProps) {
  return (
    <ul
      className="flex flex-wrap justify-center gap-4 text-sm"
      role="list"
      aria-label="Sentiment distribution legend"
    >
      {data.map((entry) => {
        const percentage =
          total > 0 ? Math.round((entry.value / total) * 100) : 0;
        return (
          <li key={entry.name} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: entry.fill }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">
              {entry.name}: {percentage}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
