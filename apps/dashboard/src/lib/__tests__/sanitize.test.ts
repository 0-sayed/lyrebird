import { describe, expect, it } from 'vitest';

import { sanitizeText, sanitizeUrl } from '@/lib/sanitize';

describe('Sanitize Utilities', () => {
  describe('sanitizeText', () => {
    it('should strip script content', () => {
      const input = '<script>alert("xss")</script>';
      // DOMPurify strips script tags entirely
      const result = sanitizeText(input);
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    it('should strip malicious event handlers', () => {
      const input = '<img src="x" onerror="alert(1)">';
      const result = sanitizeText(input);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('should preserve plain text', () => {
      const input = 'This is a normal message without HTML';
      expect(sanitizeText(input)).toBe('This is a normal message without HTML');
    });

    it('should handle empty string', () => {
      expect(sanitizeText('')).toBe('');
    });

    it('should strip dangerous tags', () => {
      const input = '<script>evil()</script>';
      const result = sanitizeText(input);
      expect(result).not.toContain('<script>');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow http URLs', () => {
      const url = 'http://example.com/path';
      expect(sanitizeUrl(url)).toBe(url);
    });

    it('should allow https URLs', () => {
      const url = 'https://example.com/path?query=1';
      expect(sanitizeUrl(url)).toBe(url);
    });

    it('should reject javascript: URLs', () => {
      const url = 'javascript:alert(1)';
      expect(sanitizeUrl(url)).toBe('');
    });

    it('should reject javascript: URLs with encoding tricks', () => {
      const url = 'JavaScript:alert(1)';
      expect(sanitizeUrl(url)).toBe('');
    });

    it('should allow relative URLs', () => {
      const url = '/path/to/page';
      expect(sanitizeUrl(url)).toBe(url);
    });

    it('should reject data: URLs', () => {
      const url = 'data:text/html,<script>alert(1)</script>';
      expect(sanitizeUrl(url)).toBe('');
    });

    it('should reject vbscript: URLs', () => {
      const url = 'vbscript:msgbox';
      expect(sanitizeUrl(url)).toBe('');
    });

    it('should reject vbscript: URLs case-insensitively', () => {
      const url = 'VBScript:evil';
      expect(sanitizeUrl(url)).toBe('');
    });

    it('should reject protocol-relative URLs', () => {
      const url = '//example.com/path';
      expect(sanitizeUrl(url)).toBe('');
    });
  });
});
