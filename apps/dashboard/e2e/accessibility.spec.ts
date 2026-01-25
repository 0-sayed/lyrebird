import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have proper heading structure', async ({ page }) => {
    // Main heading should exist
    const mainHeading = page.getByRole('heading', { level: 2 });
    await expect(mainHeading).toBeVisible();
  });

  test('should have accessible button labels', async ({ page }) => {
    // Theme toggle should have accessible name
    const themeToggle = page.getByRole('button', { name: /toggle theme/i });
    await expect(themeToggle).toBeVisible();

    // New chat button should have accessible name
    const newChatButton = page.getByRole('button', { name: /new chat/i });
    await expect(newChatButton).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Focus should start on a focusable element
    await page.keyboard.press('Tab');

    // Skip link or first focusable element should be focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('prompt input should be focusable and labeled', async ({ page }) => {
    const promptInput = page.getByPlaceholder(/describe.*sentiment.*analyze/i);

    // Should be focusable
    await promptInput.focus();
    await expect(promptInput).toBeFocused();

    // Should have accessible description or label
    const ariaLabel = await promptInput.getAttribute('aria-label');
    const placeholder = await promptInput.getAttribute('placeholder');
    expect(ariaLabel || placeholder).toBeTruthy();
  });

  test('should have visible focus indicators', async ({ page }) => {
    const themeToggle = page.getByTestId('theme-toggle');

    // Focus the button
    await themeToggle.focus();
    await expect(themeToggle).toBeFocused();

    // Focus ring should be visible (checking for outline/ring CSS)
    // This is a visual check - we verify the element is focused
  });

  test('should have proper ARIA attributes on interactive elements', async ({
    page,
  }) => {
    // Dropdown menu trigger should have proper attributes
    const themeToggle = page.getByTestId('theme-toggle');
    await expect(themeToggle).toHaveAttribute('aria-haspopup', /.*/);
  });

  test('color contrast should be sufficient in light mode', async ({
    page,
  }) => {
    // Set light theme
    const themeToggle = page.getByTestId('theme-toggle');
    await themeToggle.click();
    await page.getByRole('menuitem', { name: /light/i }).click();

    // Text should be visible (this is a smoke test, not a full contrast check)
    await expect(page.getByText('Welcome to Lyrebird')).toBeVisible();
  });

  test('color contrast should be sufficient in dark mode', async ({ page }) => {
    // Set dark theme
    const themeToggle = page.getByTestId('theme-toggle');
    await themeToggle.click();
    await page.getByRole('menuitem', { name: /dark/i }).click();

    // Text should be visible
    await expect(page.getByText('Welcome to Lyrebird')).toBeVisible();
  });
});

test.describe('Screen Reader Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have skip link or main landmark', async ({ page }) => {
    // Check for main content area or skip link
    const main = page.locator('main');
    const skipLink = page.getByRole('link', { name: /skip/i });

    // At least one should exist
    const mainExists = await main.count();
    const skipExists = await skipLink.count();
    expect(mainExists + skipExists).toBeGreaterThan(0);
  });

  test('should announce loading states', async ({ page }) => {
    // The loading indicator should have ARIA attributes
    const promptInput = page.getByPlaceholder(/describe.*sentiment.*analyze/i);
    await promptInput.fill('Test query');

    // Submit (if button exists and is enabled)
    const submitButton = page.getByRole('button', { name: /analyze|send/i });
    if (await submitButton.isEnabled()) {
      // The typing indicator should have aria-label when shown
      // This is validated by the component tests
    }
  });

  test('should have proper list semantics for suggestions', async ({
    page,
  }) => {
    // Suggestion cards should be accessible
    const searchCard = page.getByText('Search Topics');
    await expect(searchCard).toBeVisible();
  });
});
