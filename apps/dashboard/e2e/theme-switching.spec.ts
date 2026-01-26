import { test, expect } from '@playwright/test';

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
    // Open settings menu
    const settingsMenu = page.getByTestId('settings-menu');
    await settingsMenu.click();

    // Hover theme toggle to show submenu
    await page.getByTestId('theme-toggle').hover();

    // Select light theme from dropdown
    const lightOption = page.getByRole('menuitem', { name: /light/i });
    await lightOption.click();

    // Verify html doesn't have dark class
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);
  });

  test('should toggle to dark theme', async ({ page }) => {
    // Open settings menu
    const settingsMenu = page.getByTestId('settings-menu');
    await settingsMenu.click();

    // Hover theme toggle to show submenu
    await page.getByTestId('theme-toggle').hover();

    // Select dark theme from dropdown
    const darkOption = page.getByRole('menuitem', { name: /dark/i });
    await darkOption.click();

    // Verify html has dark class
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
  });

  test('should persist theme across page reload', async ({ page }) => {
    // Open settings menu
    const settingsMenu = page.getByTestId('settings-menu');
    await settingsMenu.click();

    // Hover theme toggle and set dark theme
    await page.getByTestId('theme-toggle').hover();
    await page.getByRole('menuitem', { name: /dark/i }).click();

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="settings-menu"]');

    // Theme should still be dark
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
  });
});
