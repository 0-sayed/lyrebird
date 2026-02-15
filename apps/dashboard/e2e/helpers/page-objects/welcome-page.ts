import type { Page, Locator } from '@playwright/test';

/**
 * Page object for the Welcome/Prompt screen
 *
 * Locators based on actual UI components:
 * - welcome-prompt.tsx: data-testid="welcome-prompt"
 * - Textarea: placeholder="Describe what sentiment you want to analyze..."
 * - Submit button: aria-label="Start analysis"
 */
export class WelcomePage {
  readonly page: Page;
  readonly container: Locator;
  readonly promptInput: Locator;
  readonly submitButton: Locator;
  readonly characterCount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId('welcome-prompt');
    this.promptInput = page.getByPlaceholder(
      /describe what sentiment you want to analyze/i,
    );
    this.submitButton = page.getByRole('button', { name: /start analysis/i });
    this.characterCount = page.locator('#prompt-length-hint');
  }

  /**
   * Navigate to the welcome page
   */
  async goto() {
    await this.page.goto('/');
  }

  /**
   * Fill the prompt input with a query
   */
  async fillPrompt(query: string) {
    await this.promptInput.fill(query);
  }

  /**
   * Submit the prompt by clicking the button
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Fill and submit a prompt in one action
   * Returns a promise that resolves when the job creation response is received
   */
  async submitPrompt(query: string): Promise<{ jobId: string }> {
    await this.fillPrompt(query);

    // Set up response listener before clicking
    const responsePromise = this.page.waitForResponse(
      (res) =>
        res.url().includes('/api/jobs') && res.request().method() === 'POST',
    );

    await this.submit();

    const response = await responsePromise;
    const data = (await response.json()) as { jobId: string };
    return data;
  }

  /**
   * Click an example prompt suggestion
   */
  async clickExample(example: string) {
    await this.page.getByRole('button', { name: example }).click();
  }

  /**
   * Check if the welcome page is visible
   */
  async isVisible(): Promise<boolean> {
    return this.container.isVisible();
  }

  /**
   * Get the current character count display (e.g., "15/500")
   */
  async getCharacterCount(): Promise<string | null> {
    return this.characterCount.textContent();
  }

  /**
   * Check if the submit button is enabled
   */
  async isSubmitEnabled(): Promise<boolean> {
    return this.submitButton.isEnabled();
  }
}
