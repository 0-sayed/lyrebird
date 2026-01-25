import { getNSSChartColor } from '@/lib/sentiment-utils';

// =============================================================================
// Types
// =============================================================================

export interface ChartCenterLabelProps {
  /** Center X coordinate */
  cx: number;
  /** Center Y coordinate */
  cy: number;
  /** Net Sentiment Score (-100 to +100) */
  nss: number;
}

// =============================================================================
// Component
// =============================================================================

/**
 * SVG center label for donut charts showing NSS value
 *
 * Features:
 * - Color coded based on NSS value
 * - Accessible text rendering
 */
export function ChartCenterLabel({ cx, cy, nss }: ChartCenterLabelProps) {
  const color = getNSSChartColor(nss);

  return (
    <g>
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-muted-foreground text-xs"
      >
        NSS
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xl font-bold"
        fill={color}
      >
        {nss > 0 ? '+' : ''}
        {nss}
      </text>
    </g>
  );
}
