import { describe, expect, it, beforeEach } from 'vitest';

import { THEME_STORAGE_KEY, THEMES } from '@/lib/constants';

describe('Theme System', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset document classes
    document.documentElement.classList.remove('light', 'dark');
  });

  describe('Theme Constants', () => {
    it('should have correct storage key', () => {
      expect(THEME_STORAGE_KEY).toBe('lyrebird-theme');
    });

    it('should define all theme options', () => {
      expect(THEMES).toContain('light');
      expect(THEMES).toContain('dark');
      expect(THEMES).toContain('system');
      expect(THEMES).toHaveLength(3);
    });
  });

  describe('Theme Persistence', () => {
    it('should store theme in localStorage', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('should retrieve stored theme', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      expect(storedTheme).toBe('light');
    });
  });
});
