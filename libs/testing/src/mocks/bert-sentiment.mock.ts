/**
 * Mock implementation of BertSentimentService for testing
 */
export const createMockBertSentimentService = () => ({
  analyze: jest.fn().mockResolvedValue({
    score: 0.5,
    label: 'neutral',
    confidence: 0.6,
    source: 'afinn',
  }),
  isReady: jest.fn().mockReturnValue(true),
  getStatus: jest.fn().mockReturnValue({
    ready: true,
    provider: 'afinn',
    huggingfaceConfigured: false,
  }),
  onModuleInit: jest.fn(),
});
