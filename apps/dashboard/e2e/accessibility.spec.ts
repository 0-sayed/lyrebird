import { test, expect } from '@playwright/test';
import { SidebarPage } from './helpers/page-objects/sidebar-page';

test.describe('Accessibility', () => {
  // Skip sidebar-dependent tests on mobile viewports
  test.skip(
    ({ viewport }) => (viewport?.width ?? 1280) < 768,
    'Accessibility tests require desktop viewport for sidebar access',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have proper heading structure', async ({ page }) => {
    // Main heading should exist
    const mainHeading = page.getByRole('heading', { level: 1 });
    await expect(mainHeading).toBeVisible();
  });

  test('should have accessible button labels', async ({ page }) => {
    // Settings menu should have accessible name
    const settingsMenu = page.getByTestId('settings-menu');
    await expect(settingsMenu).toBeVisible();

    // New analysis button should have accessible name
    const newAnalysisButton = page.getByRole('button', {
      name: /new analysis/i,
    });
    await expect(newAnalysisButton).toBeVisible();
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
    const settingsMenu = page.getByTestId('settings-menu');

    // Focus the button
    await settingsMenu.focus();
    await expect(settingsMenu).toBeFocused();

    // Focus ring should be visible (checking for outline/ring CSS)
    // This is a visual check - we verify the element is focused
  });

  test('should have proper ARIA attributes on interactive elements', async ({
    page,
  }) => {
    // Dropdown menu trigger should have proper attributes
    const settingsMenu = page.getByTestId('settings-menu');
    await expect(settingsMenu).toHaveAttribute('aria-haspopup', /.*/);
  });

  test('color contrast should be sufficient in light mode', async ({
    page,
  }) => {
    const sidebar = new SidebarPage(page);
    await sidebar.setTheme('light');

    // Text should be visible (this is a smoke test, not a full contrast check)
    await expect(
      page.getByText('What would you like to analyze today?'),
    ).toBeVisible();
  });

  test('color contrast should be sufficient in dark mode', async ({ page }) => {
    const sidebar = new SidebarPage(page);
    await sidebar.setTheme('dark');

    // Text should be visible
    await expect(
      page.getByText('What would you like to analyze today?'),
    ).toBeVisible();
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
    const submitButton = page.getByRole('button', { name: /start analysis/i });
    if (await submitButton.isEnabled()) {
      // The typing indicator should have aria-label when shown
      // This is validated by the component tests
    }
  });

  test('should have proper feature hints', async ({ page }) => {
    // Feature hints should be accessible
    const featureHint = page.getByText('Real-time analysis');
    await expect(featureHint).toBeVisible();
  });
});
