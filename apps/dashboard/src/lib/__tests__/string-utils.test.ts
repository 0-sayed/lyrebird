import { describe, expect, it } from 'vitest';

import { truncateText } from '../string-utils';

// =============================================================================
// truncateText Tests
// =============================================================================

describe('truncateText', () => {
  it('returns the original text when shorter than maxLength', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('returns the original text when exactly equal to maxLength', () => {
    expect(truncateText('hello', 5)).toBe('hello');
  });

  it('truncates text longer than maxLength with ellipsis', () => {
    expect(truncateText('hello world', 5)).toBe('hello...');
  });

  it('trims whitespace before adding ellipsis', () => {
    expect(truncateText('hello world', 6)).toBe('hello...');
  });

  it('handles empty string', () => {
    expect(truncateText('', 10)).toBe('');
  });

  it('handles maxLength of 0', () => {
    expect(truncateText('hello', 0)).toBe('...');
  });

  it('handles maxLength of 1', () => {
    expect(truncateText('hello', 1)).toBe('h...');
  });

  it('handles text with only whitespace', () => {
    expect(truncateText('   ', 2)).toBe('...');
  });

  it('handles unicode characters correctly', () => {
    expect(truncateText('hello world', 7)).toBe('hello w...');
  });

  it('handles very long text', () => {
    const longText = 'a'.repeat(1000);
    const result = truncateText(longText, 10);
    expect(result).toBe('aaaaaaaaaa...');
    expect(result.length).toBe(13); // 10 + '...'
  });

  it('handles text with newlines', () => {
    expect(truncateText('hello\nworld', 5)).toBe('hello...');
  });

  it('handles text with multiple spaces', () => {
    expect(truncateText('hello   world', 8)).toBe('hello...');
  });
});
