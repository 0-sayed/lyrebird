import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useIsMobile } from '../use-mobile';

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: Mock;
  removeEventListener: Mock;
  onchange: null;
  addListener: Mock;
  removeListener: Mock;
  dispatchEvent: Mock;
}

describe('useIsMobile', () => {
  const originalInnerWidth = window.innerWidth;
  let matchMediaListeners: Map<string, Set<() => void>>;

  function createMatchMedia(width: number) {
    matchMediaListeners = new Map();

    return vi.fn().mockImplementation((query: string) => {
      const listeners = new Set<() => void>();
      matchMediaListeners.set(query, listeners);

      return {
        matches: width < 768,
        media: query,
        addEventListener: vi.fn((_event: string, callback: () => void) => {
          listeners.add(callback);
        }),
        removeEventListener: vi.fn((_event: string, callback: () => void) => {
          listeners.delete(callback);
        }),
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });
  }

  function setWindowWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
  }

  function triggerMediaQueryChange() {
    matchMediaListeners.forEach((listeners) => {
      listeners.forEach((callback) => callback());
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('should return true when viewport is less than 768px', () => {
    setWindowWidth(767);
    window.matchMedia = createMatchMedia(767);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('should return false when viewport is 768px or greater', () => {
    setWindowWidth(768);
    window.matchMedia = createMatchMedia(768);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('should return false for desktop width (1024px)', () => {
    setWindowWidth(1024);
    window.matchMedia = createMatchMedia(1024);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('should update when viewport changes from desktop to mobile', () => {
    setWindowWidth(1024);
    window.matchMedia = createMatchMedia(1024);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    // Simulate resize to mobile
    act(() => {
      setWindowWidth(500);
      triggerMediaQueryChange();
    });

    expect(result.current).toBe(true);
  });

  it('should update when viewport changes from mobile to desktop', () => {
    setWindowWidth(500);
    window.matchMedia = createMatchMedia(500);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    // Simulate resize to desktop
    act(() => {
      setWindowWidth(1024);
      triggerMediaQueryChange();
    });

    expect(result.current).toBe(false);
  });

  it('should clean up event listener on unmount', () => {
    setWindowWidth(1024);
    const mockMatchMedia = createMatchMedia(1024);
    window.matchMedia = mockMatchMedia;

    const { unmount } = renderHook(() => useIsMobile());

    // Get the mock instance
    const mqlInstance = mockMatchMedia.mock.results[0]
      ?.value as MockMediaQueryList;

    // Verify addEventListener was called
    expect(mqlInstance.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );

    unmount();

    // Verify removeEventListener was called with the same callback
    expect(mqlInstance.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });
});
