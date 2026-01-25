import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { THEME_STORAGE_KEY, THEMES, type Theme } from '@/lib/constants';

interface ThemeProviderContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeProviderContext = createContext<
  ThemeProviderContextValue | undefined
>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

/**
 * Determines if the system prefers dark mode
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Gets the stored theme from localStorage
 */
function getStoredTheme(storageKey: string): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(storageKey);
  if (stored && THEMES.includes(stored as Theme)) {
    return stored as Theme;
  }
  return null;
}

/**
 * Theme provider component that manages light/dark/system theme
 *
 * Features:
 * - Persists theme preference to localStorage
 * - Respects system preference when set to 'system'
 * - Applies theme class to document root
 * - Listens for system theme changes
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return getStoredTheme(storageKey) ?? defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (theme === 'system') {
      return getSystemTheme();
    }
    return theme;
  });

  // Update document class and resolved theme when theme changes
  useEffect(() => {
    const root = window.document.documentElement;

    // Remove existing theme classes
    root.classList.remove('light', 'dark');

    let resolved: 'light' | 'dark';
    if (theme === 'system') {
      resolved = getSystemTheme();
    } else {
      resolved = theme;
    }

    root.classList.add(resolved);
    setResolvedTheme(resolved);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (event: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');

      const newTheme = event.matches ? 'dark' : 'light';
      root.classList.add(newTheme);
      setResolvedTheme(newTheme);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setThemeState(newTheme);
  };

  const value: ThemeProviderContextValue = {
    theme,
    setTheme,
    resolvedTheme,
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

/**
 * Hook to access theme context
 *
 * @returns Theme context with current theme, setter, and resolved theme
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeProviderContextValue {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
