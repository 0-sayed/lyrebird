import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import {
  useLocalStorage,
  getStoredValue,
  getSidebarCookieState,
} from '../use-local-storage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should return default value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('should read existing value from localStorage synchronously (no flash)', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    // Value should be available immediately on first render (no hydration delay)
    expect(result.current[0]).toBe('stored-value');
  });

  it('should update localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('new-value'));
  });

  it('should support functional updates', () => {
    const { result } = renderHook(() => useLocalStorage('test-count', 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);

    act(() => {
      result.current[1]((prev) => prev + 5);
    });

    expect(result.current[0]).toBe(6);
  });

  it('should remove value from localStorage', () => {
    localStorage.setItem('test-key', JSON.stringify('to-remove'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    // Value should be read synchronously
    expect(result.current[0]).toBe('to-remove');

    act(() => {
      result.current[2](); // removeValue
    });

    expect(result.current[0]).toBe('default');
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('should handle boolean values', () => {
    const { result } = renderHook(() => useLocalStorage('bool-key', false));

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem('bool-key')).toBe('true');
  });

  it('should handle object values', () => {
    const defaultObj = { name: 'test', count: 0 };
    const { result } = renderHook(() => useLocalStorage('obj-key', defaultObj));

    act(() => {
      result.current[1]({ name: 'updated', count: 42 });
    });

    expect(result.current[0]).toEqual({ name: 'updated', count: 42 });
    expect(localStorage.getItem('obj-key')).toBe(
      JSON.stringify({ name: 'updated', count: 42 }),
    );
  });

  it('should handle null values', () => {
    const { result } = renderHook(() =>
      useLocalStorage<string | null>('null-key', 'default'),
    );

    act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBeNull();
    expect(localStorage.getItem('null-key')).toBe('null');
  });
});

describe('getStoredValue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return default value when key does not exist', () => {
    const result = getStoredValue('nonexistent', 'default');
    expect(result).toBe('default');
  });

  it('should return stored value when key exists', () => {
    localStorage.setItem('existing-key', JSON.stringify('stored'));
    const result = getStoredValue('existing-key', 'default');
    expect(result).toBe('stored');
  });

  it('should return default value for invalid JSON', () => {
    localStorage.setItem('invalid-key', 'not-valid-json');
    // This will throw when parsing, so should return default
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = getStoredValue('invalid-key', 'default');
    expect(result).toBe('default');
    consoleSpy.mockRestore();
  });
});

describe('getSidebarCookieState', () => {
  beforeEach(() => {
    // Clear cookies
    document.cookie = 'sidebar_state=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('should return true when cookie does not exist', () => {
    const result = getSidebarCookieState();
    expect(result).toBe(true);
  });

  it('should return true when cookie value is true', () => {
    document.cookie = 'sidebar_state=true';
    const result = getSidebarCookieState();
    expect(result).toBe(true);
  });

  it('should return false when cookie value is false', () => {
    document.cookie = 'sidebar_state=false';
    const result = getSidebarCookieState();
    expect(result).toBe(false);
  });
});
