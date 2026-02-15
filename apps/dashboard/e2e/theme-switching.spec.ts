import { test, expect } from '@playwright/test';
import { SidebarPage } from './helpers/page-objects/sidebar-page';

test.describe('Theme Switching', () => {
  // Skip on mobile viewports where sidebar is hidden by default
  test.skip(
    ({ viewport }) => (viewport?.width ?? 1280) < 768,
    'Theme switching tests require desktop viewport for settings access',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to fully load
    await page.waitForSelector('[data-testid="settings-menu"]', {
      timeout: 10000,
    });
  });

  test('should respect system dark preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await page.waitForSelector('[data-testid="settings-menu"]', {
      timeout: 10000,
    });
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('should respect system light preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await page.waitForSelector('[data-testid="settings-menu"]', {
      timeout: 10000,
    });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('should toggle to light theme', async ({ page }) => {
    const sidebar = new SidebarPage(page);
    await sidebar.setTheme('light');

    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('should toggle to dark theme', async ({ page }) => {
    const sidebar = new SidebarPage(page);
    await sidebar.setTheme('dark');

    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('should persist theme across page reload', async ({ page }) => {
    const sidebar = new SidebarPage(page);
    await sidebar.setTheme('dark');

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="settings-menu"]');

    // Theme should still be dark
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
