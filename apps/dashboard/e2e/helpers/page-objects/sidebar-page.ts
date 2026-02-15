import type { Page, Locator } from '@playwright/test';

/**
 * Page object for the left sidebar (history list + settings)
 *
 * Locators based on actual UI components:
 * - history-list.tsx: SidebarMenuButton with job.prompt as tooltip
 * - settings-menu.tsx: data-testid="settings-menu", data-testid="theme-toggle"
 */
export class SidebarPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly settingsButton: Locator;
  readonly themeToggle: Locator;
  readonly sidebarTrigger: Locator;

  constructor(page: Page) {
    this.page = page;
    // The main sidebar container
    this.sidebar = page.locator('[data-sidebar="sidebar"]');
    this.settingsButton = page.getByTestId('settings-menu');
    this.themeToggle = page.getByTestId('theme-toggle');
    // Mobile sidebar trigger
    this.sidebarTrigger = page.locator('[data-sidebar="trigger"]');
  }

  // ---------------------------------------------------------------------------
  // Helper Methods
  // ---------------------------------------------------------------------------

  /**
   * Ensure sidebar is visible (opens it on mobile if needed)
   */
  private async ensureSidebarVisible() {
    const isSidebarVisible = await this.sidebar.isVisible();
    if (!isSidebarVisible) {
      // On mobile, try to open the sidebar
      const isTriggerVisible = await this.sidebarTrigger.isVisible();
      if (isTriggerVisible) {
        await this.sidebarTrigger.click();
        await this.sidebar.waitFor({ state: 'visible' });
        // Wait for animation to complete
        await this.page.waitForTimeout(300);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // History List
  // ---------------------------------------------------------------------------

  /**
   * Get all history items (job buttons in the sidebar)
   */
  getHistoryItems(): Locator {
    // History items are SidebarMenuButton elements containing job prompts
    return this.sidebar.locator(
      '[role="menuitem"], [data-sidebar-menu-button]',
    );
  }

  /**
   * Click on a history item by its prompt text
   */
  async selectJobByPrompt(promptText: string) {
    // Ensure sidebar is visible (handles mobile)
    await this.ensureSidebarVisible();

    // Find button containing the prompt text
    // Use first() because mobile may render duplicate elements
    const button = this.sidebar
      .getByRole('button', { name: promptText })
      .first();

    // Wait for the button to be visible
    await button.waitFor({ state: 'visible' });

    // On mobile, sidebar re-renders can cause stability issues
    // Retry the click a few times if needed
    let retries = 3;
    while (retries > 0) {
      try {
        await button.click({ timeout: 5000 });
        return;
      } catch {
        retries--;
        if (retries === 0) throw new Error(`Failed to click "${promptText}"`);
        // Wait and re-open sidebar if needed
        await this.page.waitForTimeout(500);
        await this.ensureSidebarVisible();
      }
    }
  }

  /**
   * Delete a job from history using the dropdown menu
   */
  async deleteJob(promptText: string) {
    // Ensure sidebar is visible (handles mobile)
    await this.ensureSidebarVisible();

    // Find the history item row
    const historyItem = this.sidebar.locator('li').filter({
      has: this.page.getByText(promptText, { exact: false }),
    });

    // Hover to reveal the more options button
    await historyItem.hover();

    // Click the "More options" button (has sr-only text)
    const moreButton = historyItem.getByRole('button', {
      name: /more options/i,
    });
    await moreButton.click();

    // Click delete in the dropdown
    const deleteItem = this.page.getByRole('menuitem', { name: /delete/i });
    await deleteItem.click();
  }

  /**
   * Check if a job exists in history
   */
  async hasJob(promptText: string): Promise<boolean> {
    const button = this.sidebar.getByRole('button', {
      name: new RegExp(promptText, 'i'),
    });
    return button.isVisible();
  }

  /**
   * Get the count of jobs in history
   */
  async getJobCount(): Promise<number> {
    // Each history item is wrapped in a SidebarMenuItem (li element)
    const items = this.sidebar.locator('li');
    return items.count();
  }

  // ---------------------------------------------------------------------------
  // Theme Settings
  // ---------------------------------------------------------------------------

  /**
   * Open the settings menu
   */
  async openSettings() {
    await this.settingsButton.click();
  }

  /**
   * Set the theme to a specific value
   */
  async setTheme(theme: 'light' | 'dark' | 'system') {
    await this.openSettings();

    // Hover the theme toggle to open submenu
    await this.themeToggle.hover();

    // Select the theme option
    const themeLabel = theme.charAt(0).toUpperCase() + theme.slice(1);
    await this.page.getByRole('menuitem', { name: themeLabel }).click();
  }

  /**
   * Check if dark mode is active
   */
  async isDarkMode(): Promise<boolean> {
    const htmlClass = await this.page.locator('html').getAttribute('class');
    return htmlClass?.includes('dark') ?? false;
  }

  /**
   * Check if light mode is active
   */
  async isLightMode(): Promise<boolean> {
    const htmlClass = await this.page.locator('html').getAttribute('class');
    return !htmlClass?.includes('dark');
  }

  // ---------------------------------------------------------------------------
  // Mobile Sidebar
  // ---------------------------------------------------------------------------

  /**
   * Check if mobile sidebar trigger is visible
   */
  async isMobileTriggerVisible(): Promise<boolean> {
    return this.sidebarTrigger.isVisible();
  }

  /**
   * Open mobile sidebar
   */
  async openMobileSidebar() {
    await this.sidebarTrigger.click();
    await this.sidebar.waitFor({ state: 'visible' });
  }

  /**
   * Check if sidebar is visible
   */
  async isSidebarVisible(): Promise<boolean> {
    return this.sidebar.isVisible();
  }
}
