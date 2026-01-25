import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show welcome screen initially', async ({ page }) => {
    await expect(page.getByText('Welcome to Lyrebird')).toBeVisible();
    await expect(
      page.getByText(/Analyze sentiment from Bluesky posts/i),
    ).toBeVisible();
  });

  test('should display suggestion cards', async ({ page }) => {
    await expect(page.getByText('Search Topics')).toBeVisible();
    await expect(page.getByText('Track Trends')).toBeVisible();
    await expect(page.getByText('Explore Posts')).toBeVisible();
  });

  test('should have a prompt input', async ({ page }) => {
    const promptInput = page.getByPlaceholder(/describe.*sentiment.*analyze/i);
    await expect(promptInput).toBeVisible();
    await expect(promptInput).toBeEnabled();
  });

  test('should have a submit button', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /analyze|send/i });
    await expect(submitButton).toBeVisible();
  });

  test('should enable submit when prompt is entered', async ({ page }) => {
    const promptInput = page.getByPlaceholder(/describe.*sentiment.*analyze/i);
    const submitButton = page.getByRole('button', { name: /analyze|send/i });

    // Initially may be disabled if empty
    await promptInput.fill('iPhone 15 reviews');

    // Button should now be enabled
    await expect(submitButton).toBeEnabled();
  });
});

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have a new chat button', async ({ page }) => {
    const newChatButton = page.getByRole('button', { name: /new chat/i });
    await expect(newChatButton).toBeVisible();
  });

  test('should have a theme toggle', async ({ page }) => {
    const themeToggle = page.getByTestId('theme-toggle');
    await expect(themeToggle).toBeVisible();
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

    // New chat button should be visible in sidebar
    const newChatButton = page.getByRole('button', { name: /new chat/i });
    await expect(newChatButton).toBeVisible();
  });
});
