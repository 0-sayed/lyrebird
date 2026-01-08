/**
 * BERT Sentiment Service Integration Tests
 *
 * These tests verify the BertSentimentService using the real AFINN analyzer.
 * HuggingFace API tests are conditionally run when HUGGINGFACE_API_KEY is set.
 *
 * No ESM workarounds needed - this implementation uses:
 * - HuggingFace Inference API (HTTP-based, no ESM issues)
 * - AFINN npm package (CommonJS compatible)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BertSentimentService } from './bert-sentiment.service';
import {
  SENTIMENT_TEST_CASES,
  EDGE_CASE_TEXTS,
} from '../../../../test/fixtures/sentiment-fixtures';

// Check if HuggingFace API key is available for integration tests
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

describe('BertSentimentService Integration', () => {
  let afinnService: BertSentimentService;
  let afinnModule: TestingModule;

  beforeAll(async () => {
    // Create service with AFINN only (no API key)
    afinnModule = await Test.createTestingModule({
      providers: [
        BertSentimentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined), // No API key
          },
        },
      ],
    }).compile();

    afinnService = afinnModule.get<BertSentimentService>(BertSentimentService);
  });

  afterAll(async () => {
    await afinnModule.close();
  });

  describe('AFINN-based analysis (real analyzer)', () => {
    describe('positive sentiment accuracy', () => {
      it.each(SENTIMENT_TEST_CASES.positive)(
        'should identify positive sentiment in: "$text"',
        async ({ text }) => {
          const result = await afinnService.analyze(text);

          // AFINN should recognize positive words
          expect(result.source).toBe('afinn');
          expect(result.score).toBeGreaterThan(0.5);
          expect(['positive', 'neutral']).toContain(result.label);
        },
      );
    });

    describe('negative sentiment accuracy', () => {
      it.each(SENTIMENT_TEST_CASES.negative)(
        'should identify negative sentiment in: "$text"',
        async ({ text }) => {
          const result = await afinnService.analyze(text);

          expect(result.source).toBe('afinn');
          expect(result.score).toBeLessThan(0.5);
          expect(['negative', 'neutral']).toContain(result.label);
        },
      );
    });

    describe('edge case handling', () => {
      it('should handle very long text by truncating', async () => {
        const result = await afinnService.analyze(EDGE_CASE_TEXTS.veryLong);

        // Repeated "I love this product" should be positive
        expect(result.score).toBeGreaterThan(0.5);
      });

      it('should handle special characters without crashing', async () => {
        const result = await afinnService.analyze(EDGE_CASE_TEXTS.specialChars);

        expect(result).toBeDefined();
        expect(result.source).toBe('afinn');
      });

      it('should handle empty text gracefully', async () => {
        const result = await afinnService.analyze(EDGE_CASE_TEXTS.empty);

        expect(result).toBeDefined();
        // Empty text has neutral score
        expect(result.score).toBeCloseTo(0.5, 1);
      });

      it('should handle unicode text', async () => {
        const result = await afinnService.analyze(EDGE_CASE_TEXTS.unicode);

        expect(result).toBeDefined();
        expect(result.source).toBe('afinn');
      });
    });

    describe('performance characteristics', () => {
      it('should complete analysis very quickly (AFINN is fast)', async () => {
        const startTime = Date.now();
        await afinnService.analyze('This is a performance test.');
        const duration = Date.now() - startTime;

        // AFINN should be nearly instantaneous
        expect(duration).toBeLessThan(50);
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
        const results = await Promise.all(
          texts.map((t) => afinnService.analyze(t)),
        );
        const duration = Date.now() - startTime;

        expect(results).toHaveLength(5);
        expect(duration).toBeLessThan(100); // Very fast for AFINN
      });
    });

    describe('consistency', () => {
      it('should return identical results for identical input', async () => {
        const text = 'This product changed my life for the better!';

        const result1 = await afinnService.analyze(text);
        const result2 = await afinnService.analyze(text);

        expect(result1.label).toBe(result2.label);
        expect(result1.score).toBeCloseTo(result2.score, 6);
        expect(result1.confidence).toBeCloseTo(result2.confidence, 6);
      });
    });
  });

  // These tests run only when HUGGINGFACE_API_KEY is set
  // If the key is not set, tests verify graceful fallback to AFINN
  describe('HuggingFace API integration (real API)', () => {
    let hfService: BertSentimentService;
    let hfModule: TestingModule;

    beforeAll(async () => {
      hfModule = await Test.createTestingModule({
        providers: [
          BertSentimentService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(HF_API_KEY),
            },
          },
        ],
      }).compile();

      hfService = hfModule.get<BertSentimentService>(BertSentimentService);
    }, 30000); // 30s timeout for setup

    afterAll(async () => {
      await hfModule.close();
    });

    it('should use HuggingFace API when key is configured, or fallback to AFINN', async () => {
      const result = await hfService.analyze('I love this product!');

      // If API key is set, should use HuggingFace, otherwise AFINN
      if (HF_API_KEY) {
        expect(result.source).toBe('huggingface');
        expect(result.label).toBe('positive');
        expect(result.confidence).toBeGreaterThan(0.8);
      } else {
        expect(result.source).toBe('afinn');
        expect(result.label).toBe('positive');
      }
    });

    it('should correctly classify clearly positive text', async () => {
      const result = await hfService.analyze(
        'This is absolutely amazing! Best purchase ever!',
      );

      if (HF_API_KEY) {
        expect(result.source).toBe('huggingface');
        expect(result.label).toBe('positive');
        expect(result.score).toBeGreaterThan(0.8);
      } else {
        expect(result.source).toBe('afinn');
        expect(result.label).toBe('positive');
      }
    });

    it('should correctly classify clearly negative text', async () => {
      const result = await hfService.analyze(
        'This is terrible. Worst product ever. Complete waste of money.',
      );

      if (HF_API_KEY) {
        expect(result.source).toBe('huggingface');
        expect(result.label).toBe('negative');
        expect(result.score).toBeLessThan(0.2);
      } else {
        expect(result.source).toBe('afinn');
        expect(result.label).toBe('negative');
      }
    });

    it('should handle negation patterns correctly (BERT understands context)', async () => {
      const result = await hfService.analyze('This is not bad at all!');

      if (HF_API_KEY) {
        expect(result.source).toBe('huggingface');
        // BERT should understand "not bad" as positive
        expect(result.label).toBe('positive');
      } else {
        expect(result.source).toBe('afinn');
        // AFINN may struggle with negation, just verify it doesn't crash
        expect(result.label).toBeDefined();
      }
    });

    it('should return results within reasonable time', async () => {
      const startTime = Date.now();
      await hfService.analyze('Performance test text.');
      const duration = Date.now() - startTime;

      // API should respond within 5 seconds, AFINN is instant
      if (HF_API_KEY) {
        expect(duration).toBeLessThan(5000);
      } else {
        expect(duration).toBeLessThan(100);
      }
    });
  });
});
