/**
 * URL utilities for safe navigation
 */

/**
 * Open a URL in a new window/tab with security best practices
 *
 * @param url - The URL to open (should be pre-sanitized)
 */
export function openInNewWindow(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
