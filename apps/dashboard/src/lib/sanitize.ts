import DOMPurify from 'dompurify';

/**
 * Sanitize user-generated content to prevent XSS attacks.
 *
 * Use this for any content that comes from:
 * - User prompts
 * - Post text content
 * - Author names
 * - Any other user-generated data
 *
 * @param dirty - The potentially unsafe string to sanitize
 * @returns A sanitized string safe for rendering
 */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: [], // Strip all attributes
  });
}

/**
 * Sanitize a URL to prevent javascript: protocol attacks
 *
 * @param url - The URL to sanitize
 * @returns A safe URL or empty string if unsafe
 */
export function sanitizeUrl(url: string): string {
  // Block protocol-relative URLs (//example.com)
  // These can be used for data exfiltration or unexpected redirects
  if (url.startsWith('//')) {
    return '';
  }

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
    return '';
  } catch {
    // If URL parsing fails, it's likely a relative URL which is safe
    // But check for javascript: anyway
    if (url.toLowerCase().startsWith('javascript:')) {
      return '';
    }
    return url;
  }
}
