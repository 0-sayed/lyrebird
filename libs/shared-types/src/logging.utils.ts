/**
 * Logging utilities for safe log output
 * Prevents log injection attacks by sanitizing user input
 */

/**
 * Sanitize user input for safe logging
 * Removes newlines and control characters to prevent log injection
 *
 * @param input - User-provided string to sanitize
 * @param maxLength - Maximum length to truncate to (default: 100)
 * @returns Sanitized string safe for logging
 */
export function sanitizeForLog(input: string, maxLength = 100): string {
  return (
    input
      .replace(/[\r\n\t]/g, ' ') // Replace newlines and tabs with spaces
      // Remove control characters (ASCII 0-31 and 127)
      .split('')
      .filter((char) => {
        const code = char.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .trim()
      .substring(0, maxLength)
  );
}
