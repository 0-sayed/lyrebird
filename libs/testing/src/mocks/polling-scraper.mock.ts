/**
 * Mock implementation of PollingScraperService for testing
 */
export const createMockPollingScraperService = () => ({
  startPollingJob: jest.fn(),
  stopPollingJob: jest.fn(),
  getActiveJobs: jest.fn().mockReturnValue([]),
});
