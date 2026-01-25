import { useState, useEffect, useCallback } from 'react';
import type { ZodType } from 'zod';

/**
 * Reads a value from localStorage synchronously.
 * Safe to call during render - returns defaultValue if window is undefined.
 * Optionally validates the parsed data against a Zod schema.
 */
function readStorageValue<T>(
  key: string,
  defaultValue: T,
  schema?: ZodType<T>,
): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const item = window.localStorage.getItem(key);
    if (item !== null) {
      const parsed: unknown = JSON.parse(item);

      // Validate with Zod schema if provided
      if (schema) {
        const result = schema.safeParse(parsed);
        if (result.success) {
          return result.data;
        }
        // Validation failed - return default and clear invalid data
        if (import.meta.env.DEV) {
          console.warn(
            `localStorage key "${key}" failed validation:`,
            result.error.format(),
          );
        }
        window.localStorage.removeItem(key);
        return defaultValue;
      }

      return parsed as T;
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }
  return defaultValue;
}

export interface UseLocalStorageOptions<T> {
  /** Optional Zod schema to validate parsed data */
  schema?: ZodType<T>;
}

/**
 * A hook for persisting state to localStorage with SSR safety.
 *
 * Features:
 * - SSR-safe: Returns default value during server render
 * - No flash: Reads synchronously on initial render (client-side)
 * - Type-safe: Preserves TypeScript types
 * - Syncs across tabs via storage event listener
 * - Handles JSON serialization/deserialization
 * - Optional Zod schema validation for parsed data
 *
 * @param key - The localStorage key
 * @param defaultValue - The default value if no stored value exists
 * @param options - Optional configuration including schema validation
 * @returns A tuple of [value, setValue, removeValue]
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useLocalStorage('sidebar-open', true);
 *
 * // With schema validation
 * const [settings, setSettings] = useLocalStorage('settings', defaults, {
 *   schema: SettingsSchema,
 * });
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options?: UseLocalStorageOptions<T>,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const { schema } = options ?? {};

  // Initialize synchronously from localStorage to prevent flash
  // This reads on first render, avoiding the useEffect delay
  const [storedValue, setStoredValue] = useState<T>(() =>
    readStorageValue(key, defaultValue, schema),
  );

  // Sync with other tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          const parsed: unknown = JSON.parse(event.newValue);

          // Validate with Zod schema if provided
          if (schema) {
            const result = schema.safeParse(parsed);
            if (result.success) {
              setStoredValue(result.data);
            } else {
              if (import.meta.env.DEV) {
                console.warn(
                  `localStorage key "${key}" failed validation on storage event:`,
                  result.error.format(),
                );
              }
              setStoredValue(defaultValue);
            }
          } else {
            setStoredValue(parsed as T);
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn(
              `Error parsing localStorage change for "${key}":`,
              error,
            );
          }
        }
      } else if (event.key === key && event.newValue === null) {
        // Key was removed
        setStoredValue(defaultValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, defaultValue, schema]);

  // Setter that writes to localStorage
  // Uses functional update form to avoid stale closure issues with rapid calls
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((currentValue) => {
        try {
          const valueToStore =
            value instanceof Function ? value(currentValue) : value;

          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
          }
          return valueToStore;
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn(`Error setting localStorage key "${key}":`, error);
          }
          return currentValue;
        }
      });
    },
    [key],
  );

  // Remove the item from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(defaultValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`Error removing localStorage key "${key}":`, error);
      }
    }
  }, [key, defaultValue]);

  // Value is already initialized synchronously, no hydration delay
  return [storedValue, setValue, removeValue];
}

/**
 * Reads a value from localStorage synchronously (for initial state).
 * Use this when you need the stored value before first render.
 *
 * @param key - The localStorage key
 * @param defaultValue - The default value if no stored value exists
 * @returns The stored value or default value
 */
export function getStoredValue<T>(key: string, defaultValue: T): T {
  return readStorageValue(key, defaultValue);
}

/**
 * Reads the sidebar state from the cookie (for SidebarProvider).
 * The shadcn/ui sidebar component stores state in a cookie.
 *
 * @returns The stored sidebar open state, or true if not set
 */
export function getSidebarCookieState(): boolean {
  if (typeof document === 'undefined') return true;

  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'sidebar_state') {
        return value === 'true';
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Error reading sidebar cookie:', error);
    }
  }
  return true; // Default to open
}
