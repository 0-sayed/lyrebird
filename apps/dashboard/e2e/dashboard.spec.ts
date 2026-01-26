import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show welcome screen initially', async ({ page }) => {
    await expect(
      page.getByText('What would you like to analyze today?'),
    ).toBeVisible();
    await expect(
      page.getByText(/analyze sentiment from Bluesky posts/i),
    ).toBeVisible();
  });

  test('should display feature hints', async ({ page }) => {
    await expect(page.getByText('Real-time analysis')).toBeVisible();
    await expect(page.getByText('Sentiment trends')).toBeVisible();
    await expect(page.getByText('Post exploration')).toBeVisible();
  });

  test('should have a prompt input', async ({ page }) => {
    const promptInput = page.getByPlaceholder(/describe.*sentiment.*analyze/i);
    await expect(promptInput).toBeVisible();
    await expect(promptInput).toBeEnabled();
  });

  test('should have a submit button', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /start analysis/i });
    await expect(submitButton).toBeVisible();
  });

  test('should enable submit when prompt is entered', async ({ page }) => {
    const promptInput = page.getByPlaceholder(/describe.*sentiment.*analyze/i);
    const submitButton = page.getByRole('button', { name: /start analysis/i });

    // Initially may be disabled if empty
    await promptInput.fill('iPhone 15 reviews');

    // Button should now be enabled
    await expect(submitButton).toBeEnabled();
  });
});

test.describe('Sidebar', () => {
  // Skip on mobile viewports where sidebar is hidden by default
  test.skip(
    ({ viewport }) => (viewport?.width ?? 1280) < 768,
    'Sidebar tests require desktop viewport',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have a new analysis button', async ({ page }) => {
    const newAnalysisButton = page.getByRole('button', {
      name: /new analysis/i,
    });
    await expect(newAnalysisButton).toBeVisible();
  });

  test('should have a settings menu', async ({ page }) => {
    const settingsMenu = page.getByTestId('settings-menu');
    await expect(settingsMenu).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should show mobile sidebar on small screens', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Sidebar should be hidden on mobile by default
    // There should be a hamburger menu or sheet trigger visible
    const sheetTrigger = page.locator('[data-sidebar="trigger"]');
    await expect(sheetTrigger).toBeVisible();
  });

  test('should show full sidebar on desktop', async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // New analysis button should be visible in sidebar
    const newAnalysisButton = page.getByRole('button', {
      name: /new analysis/i,
    });
    await expect(newAnalysisButton).toBeVisible();
  });
});
