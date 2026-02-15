import { test as base, expect, type APIRequestContext } from '@playwright/test';

const TEST_API_BASE = 'http://localhost:3333/__test';

async function postTestApi(
  request: APIRequestContext,
  endpoint: string,
  data: Record<string, unknown>,
): Promise<void> {
  const res = await request.post(`${TEST_API_BASE}/${endpoint}`, { data });
  expect(res.ok()).toBe(true);
}

export interface TestApi {
  emitStatus(jobId: string, status: string): Promise<void>;
  emitDataUpdate(jobId: string, score: number): Promise<void>;
  emitCompleted(
    jobId: string,
    data?: { averageSentiment?: number; totalDataPoints?: number },
  ): Promise<void>;
  emitFailed(jobId: string, error: string): Promise<void>;
}

export const test = base.extend<{ testApi: TestApi }>({
  testApi: async ({ request }, use) => {
    const api: TestApi = {
      async emitStatus(jobId, status) {
        await postTestApi(request, 'emit-status', { jobId, status });
      },
      async emitDataUpdate(jobId, score) {
        await postTestApi(request, 'emit-data-update', { jobId, score });
      },
      async emitCompleted(jobId, data = {}) {
        await postTestApi(request, 'emit-completed', { jobId, ...data });
      },
      async emitFailed(jobId, error) {
        await postTestApi(request, 'emit-failed', { jobId, error });
      },
    };
    await use(api);
  },
});

export { expect };
