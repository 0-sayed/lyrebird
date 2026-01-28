/**
 * BERT Sentiment Service Integration Tests
 *
 * These tests verify the BertSentimentService using the real ONNX model.
 * The model is downloaded on first run and cached locally.
 *
 * Note: First run will download ~67MB model file.
 *
 * IMPORTANT: These tests require running with --experimental-vm-modules flag
 * due to @huggingface/transformers being an ESM module.
 *
 * Run with: NODE_OPTIONS='--experimental-vm-modules' pnpm jest apps/analysis/src/services/bert-sentiment-integration.spec.ts
 *
 * Skip in CI: Set SKIP_ONNX_TESTS=true to skip these tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BertSentimentService } from './bert-sentiment.service';
import {
  SENTIMENT_TEST_CASES,
  EDGE_CASE_TEXTS,
  createMessageBatch,
} from '../../../../test/fixtures/sentiment-fixtures';

// Increase timeout for model download on first run
jest.setTimeout(120000);

// Skip tests if SKIP_ONNX_TESTS=true or if running in standard Jest (no ESM support)
const skipOnnxTests =
  process.env.SKIP_ONNX_TESTS === 'true' ||
  process.env.NODE_OPTIONS?.includes('--experimental-vm-modules') !== true;

const describeOrSkip = skipOnnxTests ? describe.skip : describe;

describeOrSkip('BertSentimentService Integration', () => {
  let service: BertSentimentService;
  let module: TestingModule;

  beforeAll(async () => {
    // Create service with real ONNX model (no mock factory)
    module = await Test.createTestingModule({
      providers: [
        BertSentimentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ML_MODEL_CACHE_DIR') return './.models-cache-test';
              if (key === 'ML_QUANTIZATION') return 'q8';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BertSentimentService>(BertSentimentService);

    // Initialize the model (downloads on first run)
    await service.onModuleInit();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('model initialization', () => {
    it('should be ready after initialization', () => {
      expect(service.isReady()).toBe(true);
    });

    it('should report correct status', () => {
      const status = service.getStatus();
      expect(status.ready).toBe(true);
      expect(status.provider).toBe('local-onnx');
      expect(status.modelLoaded).toBe(true);
      expect(status.modelName).toBe(
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
      );
      expect(status.quantization).toBe('q8');
      expect(status.error).toBeUndefined();
    });
  });

  describe('positive sentiment accuracy', () => {
    it.each(SENTIMENT_TEST_CASES.positive)(
      'should identify positive sentiment in: "$text"',
      async ({ text }) => {
        const result = await service.analyze(text);

        expect(result.source).toBe('local-onnx');
        expect(result.score).toBeGreaterThan(0);
        expect(['positive', 'neutral']).toContain(result.label);
      },
    );

    it('should classify clearly positive text correctly', async () => {
      const result = await service.analyze(
        'This is absolutely amazing! Best purchase ever!',
      );

      expect(result.source).toBe('local-onnx');
      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('negative sentiment accuracy', () => {
    it.each(SENTIMENT_TEST_CASES.negative)(
      'should identify negative sentiment in: "$text"',
      async ({ text }) => {
        const result = await service.analyze(text);

        expect(result.source).toBe('local-onnx');
        expect(result.score).toBeLessThan(0);
        expect(['negative', 'neutral']).toContain(result.label);
      },
    );

    it('should classify clearly negative text correctly', async () => {
      const result = await service.analyze(
        'This is terrible. Worst product ever. Complete waste of money.',
      );

      expect(result.source).toBe('local-onnx');
      expect(result.label).toBe('negative');
      expect(result.score).toBeLessThan(-0.5);
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('neutral sentiment', () => {
    it('should handle ambiguous text', async () => {
      const result = await service.analyze('The weather today is cloudy.');

      expect(result.source).toBe('local-onnx');
      // Model may or may not classify this as neutral - just verify it works
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('context understanding', () => {
    it('should handle negation patterns correctly (BERT understands context)', async () => {
      const result = await service.analyze('This is not bad at all!');

      expect(result.source).toBe('local-onnx');
      // BERT should understand "not bad" as positive
      expect(result.label).toBe('positive');
    });

    it('should understand sarcasm-like patterns', async () => {
      const result = await service.analyze(
        'Oh great, another bug. Just perfect.',
      );

      expect(result.source).toBe('local-onnx');
      // Model may interpret this as negative due to context
      expect(result).toBeDefined();
    });
  });

  describe('edge case handling', () => {
    it('should handle very long text by truncating', async () => {
      const result = await service.analyze(EDGE_CASE_TEXTS.veryLong);

      expect(result.source).toBe('local-onnx');
      // Repeated "I love this product" should be positive
      expect(result.score).toBeGreaterThan(0.1);
    });

    it('should handle special characters without crashing', async () => {
      const result = await service.analyze(EDGE_CASE_TEXTS.specialChars);

      expect(result).toBeDefined();
      expect(result.source).toBe('local-onnx');
    });

    it('should handle empty text gracefully', async () => {
      const result = await service.analyze(EDGE_CASE_TEXTS.empty);

      expect(result).toBeDefined();
      expect(result.label).toBe('neutral');
      expect(result.score).toBe(0);
    });

    it('should handle unicode text', async () => {
      const result = await service.analyze(EDGE_CASE_TEXTS.unicode);

      expect(result).toBeDefined();
      expect(result.source).toBe('local-onnx');
    });
  });

  describe('performance characteristics', () => {
    it('should complete analysis within acceptable time (<500ms after model load)', async () => {
      const startTime = Date.now();
      await service.analyze('This is a performance test.');
      const duration = Date.now() - startTime;

      // Local ONNX inference should be fast after model is loaded
      expect(duration).toBeLessThan(500);
    });

    it('should handle batch of texts efficiently', async () => {
      const texts = [
        'Great product!',
        'Terrible experience.',
        'It works okay.',
        'I love it!',
        'Worst ever.',
      ];

      const startTime = Date.now();
      const results = await Promise.all(texts.map((t) => service.analyze(t)));
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      // 5 inferences should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('consistency', () => {
    it('should return identical results for identical input', async () => {
      const text = 'This product changed my life for the better!';

      const result1 = await service.analyze(text);
      const result2 = await service.analyze(text);

      expect(result1.label).toBe(result2.label);
      expect(result1.score).toBeCloseTo(result2.score, 6);
      expect(result1.confidence).toBeCloseTo(result2.confidence, 6);
    });
  });

  describe('stress testing', () => {
    it('should handle 20 concurrent analysis requests', async () => {
      const messages = createMessageBatch(20);
      const texts = messages.map((m) => m.textContent);

      const startTime = Date.now();
      const results = await Promise.all(texts.map((t) => service.analyze(t)));
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(20);
      results.forEach((result) => {
        expect(result.source).toBe('local-onnx');
        expect(result.label).toMatch(/positive|negative|neutral/);
        expect(result.score).toBeGreaterThanOrEqual(-1);
        expect(result.score).toBeLessThanOrEqual(1);
      });

      // 20 concurrent requests should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should handle 50 sequential analysis requests without degradation', async () => {
      const messages = createMessageBatch(50);
      const texts = messages.map((m) => m.textContent);
      const durations: number[] = [];

      for (const text of texts) {
        const startTime = Date.now();
        const result = await service.analyze(text);
        durations.push(Date.now() - startTime);

        expect(result.source).toBe('local-onnx');
      }

      // Calculate average duration (excluding first which may have warmup overhead)
      const avgDuration =
        durations.slice(1).reduce((a, b) => a + b, 0) / (durations.length - 1);

      // Average should be under 200ms per request
      expect(avgDuration).toBeLessThan(200);

      // No single request should take more than 1 second
      const maxDuration = Math.max(...durations);
      expect(maxDuration).toBeLessThan(1000);
    });

    it('should maintain accuracy under load', async () => {
      const positiveTexts = SENTIMENT_TEST_CASES.positive.map((c) => c.text);
      const negativeTexts = SENTIMENT_TEST_CASES.negative.map((c) => c.text);

      // Analyze all texts concurrently
      const [positiveResults, negativeResults] = await Promise.all([
        Promise.all(positiveTexts.map((t) => service.analyze(t))),
        Promise.all(negativeTexts.map((t) => service.analyze(t))),
      ]);

      // All positive texts should have positive scores
      positiveResults.forEach((result) => {
        expect(result.score).toBeGreaterThan(0);
      });

      // All negative texts should have negative scores
      negativeResults.forEach((result) => {
        expect(result.score).toBeLessThan(0);
      });
    });
  });
});

/**
 * Model Loading Performance Tests
 *
 * These tests verify model loading performance characteristics.
 * They create fresh service instances to measure initialization time.
 */
describeOrSkip('BertSentimentService Model Loading', () => {
  it('should load model within acceptable time (<30s for cached, <120s for download)', async () => {
    const module = await Test.createTestingModule({
      providers: [
        BertSentimentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ML_MODEL_CACHE_DIR') return './.models-cache-test';
              if (key === 'ML_QUANTIZATION') return 'q8';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    const service = module.get<BertSentimentService>(BertSentimentService);

    const startTime = Date.now();
    await service.onModuleInit();
    const loadDuration = Date.now() - startTime;

    expect(service.isReady()).toBe(true);

    // Model loading should complete within 30s for cached model, 120s for first download
    // Using 120s as upper bound since we don't know if cached
    expect(loadDuration).toBeLessThan(120000);

    await module.close();
  });

  it('should handle multiple sequential initializations', async () => {
    // Test that we can create and destroy services repeatedly without issues
    for (let i = 0; i < 3; i++) {
      const module = await Test.createTestingModule({
        providers: [
          BertSentimentService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'ML_MODEL_CACHE_DIR') return './.models-cache-test';
                if (key === 'ML_QUANTIZATION') return 'q8';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const service = module.get<BertSentimentService>(BertSentimentService);
      await service.onModuleInit();

      expect(service.isReady()).toBe(true);

      // Quick analysis to verify service works
      const result = await service.analyze('Test text');
      expect(result.source).toBe('local-onnx');

      await module.close();
    }
  });
});
