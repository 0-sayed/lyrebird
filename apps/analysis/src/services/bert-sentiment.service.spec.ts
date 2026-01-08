/**
 * BERT Sentiment Service Unit Tests
 *
 * Tests the BertSentimentService with mocked HTTP client and AFINN analyzer.
 * The service uses HuggingFace Inference API as primary with AFINN fallback.
 *
 * Test Strategy:
 * 1. Mock HTTP client to simulate HuggingFace API responses
 * 2. Mock AFINN analyzer for predictable fallback behavior
 * 3. Test HuggingFace API path, AFINN fallback path, and error handling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BertSentimentService,
  HTTP_CLIENT,
  AFINN_ANALYZER,
  HttpClient,
} from './bert-sentiment.service';
import {
  SENTIMENT_TEST_CASES,
  EDGE_CASE_TEXTS,
} from '../../../../test/fixtures/sentiment-fixtures';

describe('BertSentimentService', () => {
  let service: BertSentimentService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockAfinnAnalyzer: {
    analyze: jest.Mock;
  };
  let mockConfigService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    // Create mock HTTP client
    mockHttpClient = {
      post: jest.fn(),
    };

    // Create mock AFINN analyzer
    mockAfinnAnalyzer = {
      analyze: jest.fn().mockReturnValue({
        score: 3,
        comparative: 0.6,
        tokens: ['test', 'word'],
        positive: ['good'],
        negative: [],
      }),
    };

    // Create mock ConfigService with HuggingFace API key
    mockConfigService = {
      get: jest.fn().mockReturnValue('test-api-key'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BertSentimentService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HTTP_CLIENT,
          useValue: mockHttpClient,
        },
        {
          provide: AFINN_ANALYZER,
          useValue: mockAfinnAnalyzer,
        },
      ],
    }).compile();

    service = module.get<BertSentimentService>(BertSentimentService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should always be ready (AFINN fallback available)', () => {
      expect(service.isReady()).toBe(true);
    });

    it('should report correct status with API key configured', () => {
      const status = service.getStatus();
      expect(status.ready).toBe(true);
      expect(status.provider).toBe('huggingface');
      expect(status.huggingfaceConfigured).toBe(true);
    });

    it('should report AFINN provider when API key not configured', async () => {
      // Create service without API key
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BertSentimentService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: AFINN_ANALYZER,
            useValue: mockAfinnAnalyzer,
          },
        ],
      }).compile();

      const noApiService =
        module.get<BertSentimentService>(BertSentimentService);
      const status = noApiService.getStatus();

      expect(status.ready).toBe(true);
      expect(status.provider).toBe('afinn');
      expect(status.huggingfaceConfigured).toBe(false);

      await module.close();
    });
  });

  describe('analyze with HuggingFace API', () => {
    describe('positive sentiment', () => {
      beforeEach(() => {
        mockHttpClient.post.mockResolvedValue([
          [{ label: 'POSITIVE', score: 0.95 }],
        ]);
      });

      it.each(SENTIMENT_TEST_CASES.positive)(
        'should return positive for: "$text"',
        async ({ text, minScore, maxScore }) => {
          const result = await service.analyze(text);

          expect(result.label).toBe('positive');
          expect(result.score).toBeGreaterThanOrEqual(minScore);
          expect(result.score).toBeLessThanOrEqual(maxScore);
          expect(result.confidence).toBeGreaterThan(0.6);
          expect(result.source).toBe('huggingface');
        },
      );

      it('should have high confidence for clearly positive text', async () => {
        mockHttpClient.post.mockResolvedValue([
          [{ label: 'POSITIVE', score: 0.98 }],
        ]);

        const result = await service.analyze('I absolutely love this!');

        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.source).toBe('huggingface');
      });
    });

    describe('negative sentiment', () => {
      beforeEach(() => {
        mockHttpClient.post.mockResolvedValue([
          [{ label: 'NEGATIVE', score: 0.92 }],
        ]);
      });

      it.each(SENTIMENT_TEST_CASES.negative)(
        'should return negative for: "$text"',
        async ({ text, minScore, maxScore }) => {
          const result = await service.analyze(text);

          expect(result.label).toBe('negative');
          expect(result.score).toBeGreaterThanOrEqual(minScore);
          expect(result.score).toBeLessThanOrEqual(maxScore);
          expect(result.confidence).toBeGreaterThan(0.6);
          expect(result.source).toBe('huggingface');
        },
      );

      it('should have high confidence for clearly negative text', async () => {
        mockHttpClient.post.mockResolvedValue([
          [{ label: 'NEGATIVE', score: 0.97 }],
        ]);

        const result = await service.analyze('This is absolutely terrible!');

        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.source).toBe('huggingface');
      });
    });

    describe('neutral sentiment', () => {
      beforeEach(() => {
        // Low confidence = neutral (below NEUTRAL_THRESHOLD of 0.6)
        mockHttpClient.post.mockResolvedValue([
          [{ label: 'POSITIVE', score: 0.55 }],
        ]);
      });

      it.each(SENTIMENT_TEST_CASES.neutral)(
        'should return neutral for ambiguous text: "$text"',
        async ({ text }) => {
          const result = await service.analyze(text);

          expect(result.label).toBe('neutral');
          expect(result.score).toBeGreaterThanOrEqual(0.2);
          expect(result.score).toBeLessThanOrEqual(0.8);
          expect(result.source).toBe('huggingface');
        },
      );
    });

    describe('score mapping', () => {
      it('should map POSITIVE with high score to 0.75-1.0 range', async () => {
        mockHttpClient.post.mockResolvedValue([
          [{ label: 'POSITIVE', score: 0.95 }],
        ]);

        const result = await service.analyze('Great!');

        // 0.5 + (0.95 * 0.5) = 0.975
        expect(result.score).toBeGreaterThanOrEqual(0.9);
        expect(result.score).toBeLessThanOrEqual(1.0);
      });

      it('should map NEGATIVE with high score to 0.0-0.25 range', async () => {
        mockHttpClient.post.mockResolvedValue([
          [{ label: 'NEGATIVE', score: 0.95 }],
        ]);

        const result = await service.analyze('Terrible!');

        // 0.5 - (0.95 * 0.5) = 0.025
        expect(result.score).toBeGreaterThanOrEqual(0.0);
        expect(result.score).toBeLessThanOrEqual(0.1);
      });
    });
  });

  describe('AFINN fallback', () => {
    it('should use AFINN when API key not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BertSentimentService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: AFINN_ANALYZER,
            useValue: mockAfinnAnalyzer,
          },
        ],
      }).compile();

      const noApiService =
        module.get<BertSentimentService>(BertSentimentService);

      const result = await noApiService.analyze('test text');

      expect(result.source).toBe('afinn');
      expect(mockAfinnAnalyzer.analyze).toHaveBeenCalledWith('test text');

      await module.close();
    });

    it('should fallback to AFINN on rate limit (429)', async () => {
      const rateLimitError = new Error('Rate limited') as Error & {
        statusCode?: number;
      };
      rateLimitError.statusCode = 429;
      mockHttpClient.post.mockRejectedValue(rateLimitError);

      const result = await service.analyze('test text');

      expect(result.source).toBe('afinn');
      expect(mockAfinnAnalyzer.analyze).toHaveBeenCalled();
    });

    it('should fallback to AFINN on API error', async () => {
      mockHttpClient.post.mockRejectedValue(new Error('Network error'));

      const result = await service.analyze('test text');

      expect(result.source).toBe('afinn');
      expect(mockAfinnAnalyzer.analyze).toHaveBeenCalled();
    });

    it('should return positive from AFINN for positive comparative score', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockAfinnAnalyzer.analyze.mockReturnValue({
        score: 5,
        comparative: 2.5, // High positive
        tokens: ['love', 'amazing'],
        positive: ['love', 'amazing'],
        negative: [],
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BertSentimentService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: AFINN_ANALYZER,
            useValue: mockAfinnAnalyzer,
          },
        ],
      }).compile();

      const noApiService =
        module.get<BertSentimentService>(BertSentimentService);
      const result = await noApiService.analyze('I love this amazing product');

      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThan(0.55);
      expect(result.source).toBe('afinn');

      await module.close();
    });

    it('should return negative from AFINN for negative comparative score', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockAfinnAnalyzer.analyze.mockReturnValue({
        score: -5,
        comparative: -2.5, // High negative
        tokens: ['hate', 'terrible'],
        positive: [],
        negative: ['hate', 'terrible'],
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BertSentimentService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
          {
            provide: AFINN_ANALYZER,
            useValue: mockAfinnAnalyzer,
          },
        ],
      }).compile();

      const noApiService =
        module.get<BertSentimentService>(BertSentimentService);
      const result = await noApiService.analyze('I hate this terrible product');

      expect(result.label).toBe('negative');
      expect(result.score).toBeLessThan(0.45);
      expect(result.source).toBe('afinn');

      await module.close();
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue([
        [{ label: 'POSITIVE', score: 0.5 }],
      ]);
    });

    it('should handle empty text gracefully', async () => {
      await expect(
        service.analyze(EDGE_CASE_TEXTS.empty),
      ).resolves.toBeDefined();
    });

    it('should handle whitespace-only text', async () => {
      await expect(
        service.analyze(EDGE_CASE_TEXTS.whitespace),
      ).resolves.toBeDefined();
    });

    it('should truncate very long text', async () => {
      mockHttpClient.post.mockResolvedValue([
        [{ label: 'POSITIVE', score: 0.9 }],
      ]);

      const result = await service.analyze(EDGE_CASE_TEXTS.veryLong);

      expect(result).toBeDefined();
      // Verify truncation happened - the text sent should be <= 503 chars (500 + "...")
      const calledWith = mockHttpClient.post.mock.calls[0][1] as {
        inputs: string;
      };
      expect(calledWith.inputs.length).toBeLessThanOrEqual(503);
    });

    it('should handle special characters safely', async () => {
      mockHttpClient.post.mockResolvedValue([
        [{ label: 'POSITIVE', score: 0.85 }],
      ]);

      await expect(
        service.analyze(EDGE_CASE_TEXTS.specialChars),
      ).resolves.toBeDefined();
    });

    it('should handle unicode text', async () => {
      mockHttpClient.post.mockResolvedValue([
        [{ label: 'POSITIVE', score: 0.75 }],
      ]);

      await expect(
        service.analyze(EDGE_CASE_TEXTS.unicode),
      ).resolves.toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw if API returns empty response', async () => {
      mockHttpClient.post.mockResolvedValue([]);

      // With fallback, it should use AFINN instead of throwing
      const result = await service.analyze('test');
      expect(result.source).toBe('afinn');
    });

    it('should handle null response gracefully', async () => {
      mockHttpClient.post.mockResolvedValue(
        null as unknown as {
          label: 'POSITIVE' | 'NEGATIVE';
          score: number;
        }[][],
      );

      // With fallback, it should use AFINN
      const result = await service.analyze('test');
      expect(result.source).toBe('afinn');
    });
  });

  describe('consistency', () => {
    it('should return consistent results for same input', async () => {
      mockHttpClient.post.mockResolvedValue([
        [{ label: 'POSITIVE', score: 0.88 }],
      ]);

      const text = 'This is a great product!';
      const result1 = await service.analyze(text);
      const result2 = await service.analyze(text);

      expect(result1.label).toBe(result2.label);
      expect(result1.score).toBeCloseTo(result2.score, 4);
      expect(result1.confidence).toBeCloseTo(result2.confidence, 4);
    });
  });

  describe('concurrent access', () => {
    beforeEach(() => {
      mockHttpClient.post.mockResolvedValue([
        [{ label: 'POSITIVE', score: 0.85 }],
      ]);
    });

    it('should handle multiple concurrent analyze calls', async () => {
      const texts = [
        'I love this!',
        'This is great!',
        'Amazing product!',
        'Best ever!',
        'Wonderful!',
      ];

      const results = await Promise.all(texts.map((t) => service.analyze(t)));

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('label');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('source');
      });
    });
  });

  describe('API resilience', () => {
    it('should fallback to AFINN on HTTP 500 error', async () => {
      const serverError = new Error('Server error') as Error & {
        statusCode?: number;
      };
      serverError.statusCode = 500;
      mockHttpClient.post.mockRejectedValue(serverError);

      const result = await service.analyze('test text');

      expect(result.source).toBe('afinn');
      expect(mockAfinnAnalyzer.analyze).toHaveBeenCalled();
    });

    it('should fallback to AFINN on HTTP 503 error', async () => {
      const serviceUnavailableError = new Error(
        'Service unavailable',
      ) as Error & {
        statusCode?: number;
      };
      serviceUnavailableError.statusCode = 503;
      mockHttpClient.post.mockRejectedValue(serviceUnavailableError);

      const result = await service.analyze('test text');

      expect(result.source).toBe('afinn');
    });

    it('should fallback to AFINN on timeout error', async () => {
      mockHttpClient.post.mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await service.analyze('test text');

      expect(result.source).toBe('afinn');
    });

    it('should fallback to AFINN when response has unexpected structure', async () => {
      // Response with empty inner array
      mockHttpClient.post.mockResolvedValue([[]]);

      const result = await service.analyze('test text');

      expect(result.source).toBe('afinn');
    });

    it('should select highest scoring result when multiple labels returned', async () => {
      mockHttpClient.post.mockResolvedValue([
        [
          { label: 'NEGATIVE', score: 0.3 },
          { label: 'POSITIVE', score: 0.95 },
        ],
      ]);

      const result = await service.analyze('test text');

      expect(result.source).toBe('huggingface');
      expect(result.label).toBe('positive');
    });
  });

  describe('AFINN score normalization', () => {
    it('should normalize very positive AFINN scores correctly', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockAfinnAnalyzer.analyze.mockReturnValue({
        score: 20,
        comparative: 5, // Maximum positive
        tokens: ['love', 'amazing', 'best', 'fantastic'],
        positive: ['love', 'amazing', 'best', 'fantastic'],
        negative: [],
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BertSentimentService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: AFINN_ANALYZER, useValue: mockAfinnAnalyzer },
        ],
      }).compile();

      const afinnService =
        module.get<BertSentimentService>(BertSentimentService);
      const result = await afinnService.analyze('love amazing best fantastic');

      expect(result.score).toBe(1); // Should be clamped to 1
      expect(result.label).toBe('positive');

      await module.close();
    });

    it('should normalize very negative AFINN scores correctly', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockAfinnAnalyzer.analyze.mockReturnValue({
        score: -20,
        comparative: -5, // Maximum negative
        tokens: ['hate', 'terrible', 'awful', 'horrible'],
        positive: [],
        negative: ['hate', 'terrible', 'awful', 'horrible'],
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BertSentimentService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: AFINN_ANALYZER, useValue: mockAfinnAnalyzer },
        ],
      }).compile();

      const afinnService =
        module.get<BertSentimentService>(BertSentimentService);
      const result = await afinnService.analyze('hate terrible awful horrible');

      expect(result.score).toBe(0); // Should be clamped to 0
      expect(result.label).toBe('negative');

      await module.close();
    });

    it('should calculate confidence based on scored word ratio', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockAfinnAnalyzer.analyze.mockReturnValue({
        score: 2,
        comparative: 0.5,
        tokens: ['the', 'product', 'is', 'good'],
        positive: ['good'],
        negative: [],
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BertSentimentService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: AFINN_ANALYZER, useValue: mockAfinnAnalyzer },
        ],
      }).compile();

      const afinnService =
        module.get<BertSentimentService>(BertSentimentService);
      const result = await afinnService.analyze('the product is good');

      // 1 scored word out of 4 tokens = 0.25 ratio
      // confidence = 0.4 + 0.25 * 0.5 = 0.525
      expect(result.confidence).toBeGreaterThan(0.4);
      expect(result.confidence).toBeLessThan(0.85);

      await module.close();
    });
  });
});
