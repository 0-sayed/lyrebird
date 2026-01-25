/**
 * Reusable chart legend component for lightweight-charts
 */

// =============================================================================
// Sentiment Live Chart Legend
// =============================================================================

export interface SentimentLiveChartLegendProps {
  className?: string;
}

/**
 * Legend for the sentiment live chart showing sentiment score and running average
 */
export function SentimentLiveChartLegend({
  className,
}: SentimentLiveChartLegendProps) {
  return (
    <div
      className={`flex items-center justify-center gap-6 text-xs text-muted-foreground ${className ?? ''}`}
    >
      <div className="flex items-center gap-2">
        <div className="relative h-3 w-3 overflow-hidden rounded-full">
          <div className="absolute left-0 top-0 h-full w-1/2 bg-red-500" />
          <div className="absolute right-0 top-0 h-full w-1/2 bg-green-500" />
        </div>
        <span>Sentiment Score</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="h-0.5 w-4 bg-muted-foreground"
          style={{ opacity: 0.8 }}
        />
        <span>Running Average</span>
      </div>
    </div>
  );
}
