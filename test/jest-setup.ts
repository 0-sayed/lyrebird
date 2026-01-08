// Mock uuid to avoid ESM issues in tests
jest.mock('uuid', () => ({
  v4: jest.fn(() => '00000000-0000-0000-0000-000000000000'),
}));

// Increase Jest's default timeout for cleanup operations
// Some NestJS internal operations may take longer to settle
jest.setTimeout(10000);

// Use beforeAll to set up any global state
beforeAll(() => {
  // Suppress console output during tests for cleaner output
  // Comment this out if you need to debug test issues
  // jest.spyOn(console, 'log').mockImplementation(() => {});
});
