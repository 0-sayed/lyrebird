/**
 * Mock implementation of BertSentimentService for testing
 */
export const createMockBertSentimentService = () => ({
  analyze: jest.fn().mockResolvedValue({
    score: 0.5,
    label: 'neutral',
    confidence: 0.6,
    source: 'local-onnx',
  }),
  isReady: jest.fn().mockReturnValue(true),
  getStatus: jest.fn().mockReturnValue({
    ready: true,
    provider: 'local-onnx',
    modelLoaded: true,
    modelName: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    quantization: 'q8',
  }),
  onModuleInit: jest.fn().mockResolvedValue(undefined),
});
