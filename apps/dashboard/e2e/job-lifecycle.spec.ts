/**
 * Job Lifecycle E2E Tests (Scenarios 1-5)
 *
 * Tests the complete job lifecycle from submission through completion,
 * including viewing results, deleting jobs, history navigation, and
 * starting new analyses.
 */
import { test, expect } from './fixtures/test-api.fixture';
import { WelcomePage, AnalysisPage, SidebarPage } from './helpers/page-objects';
import type { Page } from '@playwright/test';
import type { TestApi } from './fixtures/test-api.fixture';

/**
 * Submit a job and transition it to in_progress state.
 * This is the common setup shared by all lifecycle tests.
 */
async function submitAndStartJob(
  page: Page,
  testApi: TestApi,
  prompt: string,
): Promise<{
  jobId: string;
  welcomePage: WelcomePage;
  analysisPage: AnalysisPage;
  sidebarPage: SidebarPage;
}> {
  const welcomePage = new WelcomePage(page);
  const analysisPage = new AnalysisPage(page);
  const sidebarPage = new SidebarPage(page);

  await welcomePage.goto();
  const { jobId } = await welcomePage.submitPrompt(prompt);
  await testApi.emitStatus(jobId, 'in_progress');
  await analysisPage.waitForConnected();

  return { jobId, welcomePage, analysisPage, sidebarPage };
}

test.describe('Job Lifecycle', () => {
  test('should submit a new analysis job and transition to analyzing state', async ({
    page,
    testApi,
  }) => {
    const welcomePage = new WelcomePage(page);
    const analysisPage = new AnalysisPage(page);

    await welcomePage.goto();

    // Verify welcome page is visible
    await expect(welcomePage.container).toBeVisible();

    // Submit a prompt and get the job ID
    const { jobId } = await welcomePage.submitPrompt('iPhone 15 reviews');

    // Trigger IN_PROGRESS via test API
    await testApi.emitStatus(jobId, 'in_progress');

    // Verify connection status shows connected
    await analysisPage.waitForConnected();
    await expect(analysisPage.connectionStatus).toContainText(/connected/i);
  });

  test('should display results when job completes', async ({
    page,
    testApi,
  }) => {
    const { jobId, analysisPage } = await submitAndStartJob(
      page,
      testApi,
      'Test topic',
    );

    // Emit data points (chart requires data to render)
    await testApi.emitDataUpdate(jobId, 0.5);
    await testApi.emitDataUpdate(jobId, 0.7);
    await testApi.emitDataUpdate(jobId, 0.3);

    // Wait for chart to appear with data
    await expect(analysisPage.chart).toBeVisible();

    // Emit completion via test API
    await testApi.emitCompleted(jobId, {
      averageSentiment: 0.65,
      totalDataPoints: 50,
    });

    // Verify completion state (chart remains, stats show)
    await expect(analysisPage.chart).toBeVisible();
    await expect(page.getByText('Average', { exact: true })).toBeVisible();
  });

  test('should delete a job and return to welcome screen', async ({
    page,
    testApi,
  }) => {
    const { jobId, welcomePage, analysisPage, sidebarPage } =
      await submitAndStartJob(page, testApi, 'Delete test job');

    // Emit data and complete the job
    await testApi.emitDataUpdate(jobId, 0.6);
    await testApi.emitCompleted(jobId, {});

    // Wait for completion state (chart appears with data)
    await expect(analysisPage.chart).toBeVisible();

    // Delete the job from sidebar
    await sidebarPage.deleteJob('Delete test job');

    // Verify return to welcome screen
    await expect(welcomePage.container).toBeVisible();
  });

  test('should load a previous job from sidebar history', async ({
    page,
    testApi,
  }) => {
    const { jobId, welcomePage, sidebarPage } = await submitAndStartJob(
      page,
      testApi,
      'History test job',
    );

    // Emit data points and complete
    await testApi.emitDataUpdate(jobId, 0.5);
    await testApi.emitDataUpdate(jobId, 0.3);
    await testApi.emitCompleted(jobId, {
      averageSentiment: 0.5,
      totalDataPoints: 10,
    });

    // Click "New Analysis" to go back to welcome
    await sidebarPage.selectJobByPrompt('New Analysis');
    await expect(welcomePage.container).toBeVisible();

    // Select the previous job from history
    await sidebarPage.selectJobByPrompt('History test job');

    // Verify job shows completion state
    await expect(
      page.locator('#main-content').getByText('Analysis complete'),
    ).toBeVisible();
  });

  test('should start new analysis from completed state', async ({
    page,
    testApi,
  }) => {
    const { jobId, welcomePage, analysisPage, sidebarPage } =
      await submitAndStartJob(page, testApi, 'Completed job');

    // Emit data and complete
    await testApi.emitDataUpdate(jobId, 0.4);
    await testApi.emitCompleted(jobId, {});

    // Wait for completion (chart renders with data)
    await expect(analysisPage.chart).toBeVisible();

    // Click "New Analysis" button in sidebar
    await sidebarPage.selectJobByPrompt('New Analysis');

    // Verify welcome state
    await expect(welcomePage.container).toBeVisible();
    await expect(welcomePage.promptInput).toBeVisible();
  });
});
