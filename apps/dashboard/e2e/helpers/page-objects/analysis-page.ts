import type { Page, Locator } from '@playwright/test';

/**
 * Page object for the Analysis view (analyzing/completed/failed states)
 *
 * Locators based on actual UI components:
 * - sentiment-live-chart.tsx: data-testid="sentiment-live-chart"
 * - connection-status.tsx: role="status" with aria-label
 * - posts-sidebar.tsx: data-testid="posts-sidebar"
 * - stats-summary.tsx: StatCard components with labelId
 */
export class AnalysisPage {
  readonly page: Page;
  readonly chart: Locator;
  readonly chartCanvas: Locator;
  readonly connectionStatus: Locator;
  readonly postsSidebar: Locator;
  readonly postsSidebarToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chart = page.getByTestId('sentiment-live-chart');
    this.chartCanvas = this.chart.locator('canvas');
    // Connection status has aria-label="Connection status: ..." to distinguish from other role="status" elements
    this.connectionStatus = page.getByRole('status', { name: /Connection status/i });
    this.postsSidebar = page.getByTestId('posts-sidebar');
    // Toggle button changes aria-label based on state
    this.postsSidebarToggle = page.getByRole('button', {
      name: /expand posts sidebar|collapse posts sidebar/i,
    });
  }

  // ---------------------------------------------------------------------------
  // Connection Status
  // ---------------------------------------------------------------------------

  /**
   * Wait for connection status to show "Connected"
   */
  async waitForConnected(timeout = 10000) {
    // Wait for connection status with "Connected" in the aria-label
    await this.page
      .getByRole('status', { name: /Connection status: Connected/i })
      .waitFor({ timeout });
  }

  /**
   * Check if connection status shows "Connected"
   */
  async isConnected(): Promise<boolean> {
    const text = await this.connectionStatus.textContent();
    return text?.toLowerCase().includes('connected') ?? false;
  }

  /**
   * Get the current connection status text
   */
  async getConnectionStatusText(): Promise<string | null> {
    return this.connectionStatus.textContent();
  }

  // ---------------------------------------------------------------------------
  // Chart
  // ---------------------------------------------------------------------------

  /**
   * Wait for chart to be visible and have data
   */
  async waitForChart(timeout = 10000) {
    await this.chart.waitFor({ timeout });
  }

  /**
   * Check if chart has rendered canvas
   */
  async hasChartCanvas(): Promise<boolean> {
    return this.chartCanvas.isVisible();
  }

  /**
   * Get the posts count shown in the chart header (e.g., "10 posts")
   */
  async getChartPostsCount(): Promise<number | null> {
    // Chart header shows "Sentiment over time \u2022 X posts"
    const headerText = await this.chart.textContent();
    const match = headerText?.match(/(\d+)\s*posts?/i);
    return match?.[1] ? parseInt(match[1], 10) : null;
  }

  /**
   * Check if chart shows "Waiting for data..." empty state
   */
  async isWaitingForData(): Promise<boolean> {
    const waitingText = this.page.getByText(/waiting for data/i);
    return waitingText.isVisible();
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  /**
   * Check if stats are visible (average sentiment card)
   */
  async hasStats(): Promise<boolean> {
    return this.page.getByText(/average/i).isVisible();
  }

  /**
   * Get the average sentiment value displayed
   */
  async getAverageSentiment(): Promise<string | null> {
    // Find the stat card with "Average" label and get its value
    const statCard = this.page.locator('[aria-labelledby="stat-average"]');
    const value = await statCard.locator('.text-2xl, .text-xl').textContent();
    return value;
  }

  /**
   * Get the NSS value displayed
   */
  async getNSSValue(): Promise<string | null> {
    const statCard = this.page.locator('[aria-labelledby="stat-nss"]');
    const value = await statCard.locator('.text-2xl, .text-xl').textContent();
    return value;
  }

  /**
   * Check if distribution card is visible
   */
  async hasDistribution(): Promise<boolean> {
    return this.page.getByText(/distribution/i).isVisible();
  }

  // ---------------------------------------------------------------------------
  // Posts Sidebar
  // ---------------------------------------------------------------------------

  /**
   * Open the posts sidebar
   */
  async openPostsSidebar() {
    const isOpen = await this.postsSidebar.isVisible();
    if (!isOpen) {
      await this.postsSidebarToggle.click();
      await this.postsSidebar.waitFor({ state: 'visible' });
    }
  }

  /**
   * Close the posts sidebar
   */
  async closePostsSidebar() {
    const isOpen = await this.postsSidebar.isVisible();
    if (isOpen) {
      await this.postsSidebarToggle.click();
      await this.postsSidebar.waitFor({ state: 'hidden' });
    }
  }

  /**
   * Check if posts sidebar is open
   */
  async isPostsSidebarOpen(): Promise<boolean> {
    return this.postsSidebar.isVisible();
  }

  /**
   * Get the number of post cards in the sidebar
   */
  async getPostsCount(): Promise<number> {
    await this.openPostsSidebar();
    // Post cards are rendered as clickable elements inside the sidebar
    const postCards = this.postsSidebar.locator('[role="button"]');
    return postCards.count();
  }

  // ---------------------------------------------------------------------------
  // Analysis Header
  // ---------------------------------------------------------------------------

  /**
   * Check if analysis is in "failed" state
   */
  async isFailed(): Promise<boolean> {
    return this.page.getByText(/analysis failed/i).isVisible();
  }

  /**
   * Check if analysis is "completed"
   */
  async isCompleted(): Promise<boolean> {
    return this.page.getByText(/analysis complete/i).isVisible();
  }

  /**
   * Check if analysis is "analyzing"
   */
  async isAnalyzing(): Promise<boolean> {
    return this.page.getByText(/^analyzing$/i).isVisible();
  }

  /**
   * Get the error message (when failed)
   */
  async getErrorMessage(): Promise<string | null> {
    const errorDiv = this.page.locator('.bg-destructive\\/10');
    if (await errorDiv.isVisible()) {
      return errorDiv.textContent();
    }
    return null;
  }

  /**
   * Click the retry/try again button (after failure)
   */
  async clickRetry() {
    await this.page.getByRole('button', { name: /try again|retry/i }).click();
  }
}
