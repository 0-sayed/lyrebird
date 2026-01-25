import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatFullDateTime, formatRelativeTime } from '../date-utils';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-25T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to create dates relative to now in ms (must be called inside tests/hooks)
  const msAgo = (ms: number) =>
    new Date(Date.now() - ms).toISOString();

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it('returns "just now" for timestamps less than 1 minute ago', () => {
    expect(formatRelativeTime(msAgo(30 * SECOND))).toBe('just now');
  });

  it('returns "just now" for timestamps exactly at current time', () => {
    expect(formatRelativeTime(msAgo(0))).toBe('just now');
  });

  it('returns minutes format for timestamps < 1 hour', () => {
    expect(formatRelativeTime(msAgo(5 * MINUTE))).toBe('5m');
  });

  it('returns 1m for timestamps exactly 1 minute ago', () => {
    expect(formatRelativeTime(msAgo(1 * MINUTE))).toBe('1m');
  });

  it('returns 59m for timestamps just under 1 hour', () => {
    expect(formatRelativeTime(msAgo(59 * MINUTE))).toBe('59m');
  });

  it('returns hours format for timestamps < 24 hours', () => {
    expect(formatRelativeTime(msAgo(2 * HOUR))).toBe('2h');
  });

  it('returns 1h for timestamps exactly 1 hour ago', () => {
    expect(formatRelativeTime(msAgo(1 * HOUR))).toBe('1h');
  });

  it('returns 23h for timestamps just under 24 hours', () => {
    expect(formatRelativeTime(msAgo(23 * HOUR))).toBe('23h');
  });

  it('returns days format for timestamps < 7 days', () => {
    expect(formatRelativeTime(msAgo(3 * DAY))).toBe('3d');
  });

  it('returns 1d for timestamps exactly 1 day ago', () => {
    expect(formatRelativeTime(msAgo(1 * DAY))).toBe('1d');
  });

  it('returns 6d for timestamps just under 7 days', () => {
    expect(formatRelativeTime(msAgo(6 * DAY))).toBe('6d');
  });

  it('returns formatted date for timestamps >= 7 days', () => {
    const result = formatRelativeTime(msAgo(7 * DAY));
    // Should return a localized date like "Jan 18"
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/18/);
  });

  describe('suffix option', () => {
    it('includes "ago" suffix when option is true', () => {
      expect(formatRelativeTime(msAgo(5 * MINUTE), { suffix: true })).toBe(
        '5m ago',
      );
    });

    it('includes "ago" suffix for hours', () => {
      expect(formatRelativeTime(msAgo(2 * HOUR), { suffix: true })).toBe(
        '2h ago',
      );
    });

    it('includes "ago" suffix for days', () => {
      expect(formatRelativeTime(msAgo(3 * DAY), { suffix: true })).toBe(
        '3d ago',
      );
    });

    it('does not add suffix to "just now"', () => {
      expect(formatRelativeTime(msAgo(30 * SECOND), { suffix: true })).toBe(
        'just now',
      );
    });

    it('does not add suffix to formatted dates >= 7 days', () => {
      const result = formatRelativeTime(msAgo(7 * DAY), { suffix: true });
      expect(result).not.toContain('ago');
    });
  });

  describe('showYear option', () => {
    it('does not include year for same year dates', () => {
      // 24 days ago, still in 2026
      const result = formatRelativeTime(msAgo(24 * DAY), { showYear: true });
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/1/);
      expect(result).not.toMatch(/2026/);
    });

    it('includes year for different year dates when showYear is true', () => {
      // 31 days ago = Dec 25, 2025
      const result = formatRelativeTime(msAgo(31 * DAY), { showYear: true });
      expect(result).toMatch(/Dec/);
      expect(result).toMatch(/25/);
      expect(result).toMatch(/2025/);
    });

    it('does not include year for different year dates when showYear is false', () => {
      // 31 days ago = Dec 25, 2025
      const result = formatRelativeTime(msAgo(31 * DAY), { showYear: false });
      expect(result).toMatch(/Dec/);
      expect(result).toMatch(/25/);
      expect(result).not.toMatch(/2025/);
    });
  });
});

describe('formatFullDateTime', () => {
  it('returns formatted date string with month, day, year, and time', () => {
    const date = '2026-01-25T12:30:45Z';
    const result = formatFullDateTime(date);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/25/);
    expect(result).toMatch(/2026/);
  });

  it('includes seconds in output', () => {
    const date = '2026-01-25T12:30:45Z';
    const result = formatFullDateTime(date);
    // The format should include seconds (45 or :45)
    expect(result).toMatch(/45/);
  });

  it('handles different months correctly', () => {
    const date = '2026-06-15T08:15:30Z';
    const result = formatFullDateTime(date);
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
  });

  it('handles midnight timestamps', () => {
    const date = '2026-01-25T00:00:00Z';
    const result = formatFullDateTime(date);
    expect(result).toMatch(/Jan/);
    // Date could be 24 or 25 depending on timezone
    expect(result).toMatch(/2[4-5]/);
    expect(result).toMatch(/2026/);
    // Should have a time component (exact format depends on locale)
    expect(result.length).toBeGreaterThan(10);
  });
});
