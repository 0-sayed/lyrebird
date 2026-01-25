/**
 * Date utility functions for formatting and manipulation
 */

/**
 * Format a date string as a full localized datetime string
 * Used for tooltips to show the complete timestamp
 *
 * @param dateString - ISO date string to format
 * @returns Full datetime string (e.g., "Jan 23, 2026, 4:30:15 PM")
 */
export function formatFullDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export interface FormatRelativeTimeOptions {
  /** Include "ago" suffix (e.g., "5m ago" vs "5m") */
  suffix?: boolean;
  /** Show year for dates in different years */
  showYear?: boolean;
}

const DEFAULT_OPTIONS: FormatRelativeTimeOptions = {
  suffix: false,
  showYear: false,
};

/**
 * Format a date string as relative time (e.g., "5m", "2h ago", "3d")
 *
 * @param dateString - ISO date string to format
 * @param options - Formatting options
 * @returns Formatted relative time string
 */
export function formatRelativeTime(
  dateString: string,
  options: FormatRelativeTimeOptions = {},
): string {
  const { suffix, showYear } = { ...DEFAULT_OPTIONS, ...options };

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  const ago = suffix ? ' ago' : '';

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m${ago}`;
  if (diffHours < 24) return `${diffHours}h${ago}`;
  if (diffDays < 7) return `${diffDays}d${ago}`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      showYear && date.getFullYear() !== now.getFullYear()
        ? 'numeric'
        : undefined,
  });
}
