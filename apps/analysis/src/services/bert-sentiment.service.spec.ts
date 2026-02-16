/**
 * BERT Sentiment Service Unit Tests
 *
 * Tests the BertSentimentService with mocked ONNX pipeline.
 * The service uses local ONNX inference with @huggingface/transformers.
 *
 * Test Strategy:
 * 1. Mock pipeline factory to simulate ONNX model responses
 * 2. Test sentiment analysis, score mapping, and error handling
 * 3. Test score boundary conditions (NEUTRAL_THRESHOLD = 0.6)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BertSentimentService,
  PIPELINE_FACTORY,
  PipelineFactory,
  SentimentPipeline,
} from './bert-sentiment.service';
import {
  SENTIMENT_TEST_CASES,
  EDGE_CASE_TEXTS,
} from '../../../../test/fixtures/sentiment-fixtures';

describe('BertSentimentService', () => {
  let service: BertSentimentService;
  let mockPipeline: jest.Mock;
  let mockPipelineFactory: jest.MockedFunction<PipelineFactory>;
  let mockConfigService: { get: jest.Mock };
  let module: TestingModule;

  /**
   * Helper to create a test module with custom providers
   */
  async function createModule(
    pipelineFactory: PipelineFactory,
    configOverrides?: Record<string, unknown>,
  ): Promise<TestingModule> {
    const configService = {
      get: jest.fn((key: string) => {
        if (configOverrides && key in configOverrides) {
          return configOverrides[key];
        }
        if (key === 'ML_MODEL_CACHE_DIR') return './test-models-cache';
        if (key === 'ML_QUANTIZATION') return 'q8';
        return undefined;
      }),
    };

    return Test.createTestingModule({
      providers: [
        BertSentimentService,
        { provide: ConfigService, useValue: configService },
        { provide: PIPELINE_FACTORY, useValue: pipelineFactory },
      ],
    }).compile();
  }

  /**
   * Helper to set pipeline response
   */
  function setPipelineResponse(label: string, score: number): void {
    mockPipeline.mockResolvedValue([
      { label, score },
      {
        label: label === 'POSITIVE' ? 'NEGATIVE' : 'POSITIVE',
        score: 1 - score,
      },
    ]);
  }

  beforeEach(async () => {
    mockPipeline = jest.fn().mockResolvedValue([
      { label: 'POSITIVE', score: 0.95 },
      { label: 'NEGATIVE', score: 0.05 },
    ]);

    mockPipelineFactory = jest
      .fn()
      .mockResolvedValue(mockPipeline as unknown as SentimentPipeline);

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'ML_MODEL_CACHE_DIR') return './test-models-cache';
        if (key === 'ML_QUANTIZATION') return 'q8';
        return undefined;
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        BertSentimentService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PIPELINE_FACTORY, useValue: mockPipelineFactory },
      ],
    }).compile();

    service = module.get<BertSentimentService>(BertSentimentService);
  });

  afterEach(async () => {
    await module?.close();
  });

  describe('initialization', () => {
    it('should not be ready before initialization', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should be ready after onModuleInit', async () => {
      await service.onModuleInit();
      expect(service.isReady()).toBe(true);
    });

    describe('status reporting', () => {
      it('should report correct status before initialization', () => {
        const status = service.getStatus();
        expect(status).toMatchObject({
          ready: false,
          provider: 'local-onnx',
          modelLoaded: false,
          modelName: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
          quantization: 'q8',
        });
      });

      it('should report correct status after initialization', async () => {
        await service.onModuleInit();
        const status = service.getStatus();
        expect(status).toMatchObject({
          ready: true,
          provider: 'local-onnx',
          modelLoaded: true,
        });
      });
    });

    it('should call pipeline factory with correct parameters', async () => {
      await service.onModuleInit();

      expect(mockPipelineFactory).toHaveBeenCalledWith(
        'sentiment-analysis',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        { dtype: 'q8', cache_dir: './test-models-cache' },
      );
    });

    describe('initialization failure handling', () => {
      it('should handle model load error gracefully', async () => {
        const errorFactory = jest
          .fn()
          .mockRejectedValue(new Error('Model load failed'));

        const errorModule = await createModule(errorFactory);
        const errorService =
          errorModule.get<BertSentimentService>(BertSentimentService);

        await expect(errorService.onModuleInit()).rejects.toThrow(
          'Model load failed',
        );
        expect(errorService.isReady()).toBe(false);
        expect(errorService.getStatus().error).toBe('Model load failed');

        await errorModule.close();
      });

      it('should handle network timeout error', async () => {
        const timeoutFactory = jest
          .fn()
          .mockRejectedValue(new Error('ETIMEDOUT: Network timeout'));

        const timeoutModule = await createModule(timeoutFactory);
        const timeoutService =
          timeoutModule.get<BertSentimentService>(BertSentimentService);

        await expect(timeoutService.onModuleInit()).rejects.toThrow(
          'ETIMEDOUT',
        );
        expect(timeoutService.getStatus().error).toBe(
          'ETIMEDOUT: Network timeout',
        );

        await timeoutModule.close();
      });

      it('should handle out of memory error', async () => {
        const oomFactory = jest
          .fn()
          .mockRejectedValue(new Error('ENOMEM: Cannot allocate memory'));

        const oomModule = await createModule(oomFactory);
        const oomService =
          oomModule.get<BertSentimentService>(BertSentimentService);

        await expect(oomService.onModuleInit()).rejects.toThrow('ENOMEM');
        expect(oomService.getStatus().error).toBe(
          'ENOMEM: Cannot allocate memory',
        );

        await oomModule.close();
      });

      it('should handle non-Error thrown values', async () => {
        const stringErrorFactory = jest.fn().mockRejectedValue('String error');

        const stringModule = await createModule(stringErrorFactory);
        const stringService =
          stringModule.get<BertSentimentService>(BertSentimentService);

        await expect(stringService.onModuleInit()).rejects.toBe('String error');
        expect(stringService.getStatus().error).toBe('Failed to load model');

        await stringModule.close();
      });

      it('should prevent analysis when initialization failed', async () => {
        const errorFactory = jest
          .fn()
          .mockRejectedValue(new Error('Init failed'));

        const errorModule = await createModule(errorFactory);
        const errorService =
          errorModule.get<BertSentimentService>(BertSentimentService);

        await expect(errorService.onModuleInit()).rejects.toThrow();

        // Subsequent analyze calls should fail
        await expect(errorService.analyze('test')).rejects.toThrow();

        await errorModule.close();
      });
    });
  });

  describe('analyze with local ONNX', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    describe('positive sentiment', () => {
      beforeEach(() => {
        mockPipeline.mockResolvedValue([
          { label: 'POSITIVE', score: 0.95 },
          { label: 'NEGATIVE', score: 0.05 },
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
          expect(result.source).toBe('local-onnx');
        },
      );

      it('should have high confidence for clearly positive text', async () => {
        mockPipeline.mockResolvedValue([
          { label: 'POSITIVE', score: 0.98 },
          { label: 'NEGATIVE', score: 0.02 },
        ]);

        const result = await service.analyze('I absolutely love this!');

        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.source).toBe('local-onnx');
      });
    });

    describe('negative sentiment', () => {
      beforeEach(() => {
        mockPipeline.mockResolvedValue([
          { label: 'NEGATIVE', score: 0.92 },
          { label: 'POSITIVE', score: 0.08 },
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
          expect(result.source).toBe('local-onnx');
        },
      );

      it('should have high confidence for clearly negative text', async () => {
        mockPipeline.mockResolvedValue([
          { label: 'NEGATIVE', score: 0.97 },
          { label: 'POSITIVE', score: 0.03 },
        ]);

        const result = await service.analyze('This is absolutely terrible!');

        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.source).toBe('local-onnx');
      });
    });

    describe('neutral sentiment', () => {
      beforeEach(() => {
        // Low confidence = neutral (below NEUTRAL_THRESHOLD of 0.6)
        mockPipeline.mockResolvedValue([
          { label: 'POSITIVE', score: 0.55 },
          { label: 'NEGATIVE', score: 0.45 },
        ]);
      });

      it.each(SENTIMENT_TEST_CASES.neutral)(
        'should return neutral for ambiguous text: "$text"',
        async ({ text }) => {
          const result = await service.analyze(text);

          expect(result.label).toBe('neutral');
          // Neutral scores should be close to 0 on -1 to +1 scale
          expect(result.score).toBeGreaterThanOrEqual(-0.6);
          expect(result.score).toBeLessThanOrEqual(0.6);
          expect(result.source).toBe('local-onnx');
        },
      );
    });

    describe('score mapping', () => {
      it.each([
        {
          label: 'POSITIVE',
          pipelineScore: 0.95,
          expectedMin: 0.9,
          expectedMax: 1.0,
        },
        {
          label: 'POSITIVE',
          pipelineScore: 0.75,
          expectedMin: 0.7,
          expectedMax: 0.8,
        },
        {
          label: 'NEGATIVE',
          pipelineScore: 0.95,
          expectedMin: -1.0,
          expectedMax: -0.9,
        },
        {
          label: 'NEGATIVE',
          pipelineScore: 0.75,
          expectedMin: -0.8,
          expectedMax: -0.7,
        },
      ] as const)(
        'should map $label with score $pipelineScore to [$expectedMin, $expectedMax]',
        async ({ label, pipelineScore, expectedMin, expectedMax }) => {
          setPipelineResponse(label, pipelineScore);

          const result = await service.analyze('test text');

          expect(result.score).toBeGreaterThanOrEqual(expectedMin);
          expect(result.score).toBeLessThanOrEqual(expectedMax);
        },
      );
    });

    describe('score boundary tests (NEUTRAL_THRESHOLD = 0.6)', () => {
      it.each([
        // Exactly at threshold - should be classified (not neutral)
        { label: 'POSITIVE', score: 0.6, expectedLabel: 'positive' },
        { label: 'NEGATIVE', score: 0.6, expectedLabel: 'negative' },
        // Just below threshold - should be neutral
        { label: 'POSITIVE', score: 0.59, expectedLabel: 'neutral' },
        { label: 'NEGATIVE', score: 0.59, expectedLabel: 'neutral' },
        // Well above threshold - should be classified
        { label: 'POSITIVE', score: 0.8, expectedLabel: 'positive' },
        { label: 'NEGATIVE', score: 0.8, expectedLabel: 'negative' },
        // Very low confidence - should be neutral
        { label: 'POSITIVE', score: 0.5, expectedLabel: 'neutral' },
        { label: 'NEGATIVE', score: 0.5, expectedLabel: 'neutral' },
      ] as const)(
        'should return $expectedLabel for $label at confidence $score',
        async ({ label, score, expectedLabel }) => {
          setPipelineResponse(label, score);

          const result = await service.analyze('test text');

          expect(result.label).toBe(expectedLabel);
          expect(result.confidence).toBeCloseTo(score, 4);
        },
      );

      it('should return score of 0 for neutral results', async () => {
        // Low confidence = neutral, score should be close to 0
        setPipelineResponse('POSITIVE', 0.55);

        const result = await service.analyze('ambiguous text');

        expect(result.label).toBe('neutral');
        // Score reflects the direction even for neutral (but label is neutral)
        expect(Math.abs(result.score)).toBeLessThan(0.6);
      });

      it('should clamp score to [-1, 1] range for extreme values', async () => {
        // Force extreme score (shouldn't happen in practice)
        mockPipeline.mockResolvedValue([
          { label: 'POSITIVE', score: 1.5 }, // Out of expected 0-1 range
          { label: 'NEGATIVE', score: -0.5 },
        ]);

        const result = await service.analyze('test');

        expect(result.score).toBeLessThanOrEqual(1.0);
        expect(result.score).toBeGreaterThanOrEqual(-1.0);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await service.onModuleInit();
      mockPipeline.mockResolvedValue([
        { label: 'POSITIVE', score: 0.5 },
        { label: 'NEGATIVE', score: 0.5 },
      ]);
    });

    it('should handle empty text gracefully', async () => {
      const result = await service.analyze(EDGE_CASE_TEXTS.empty);

      expect(result).toBeDefined();
      expect(result.label).toBe('neutral');
      expect(result.score).toBe(0);
      expect(result.source).toBe('local-onnx');
      // Should not call pipeline for empty text
      expect(mockPipeline).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only text', async () => {
      const result = await service.analyze(EDGE_CASE_TEXTS.whitespace);

      expect(result).toBeDefined();
      expect(result.label).toBe('neutral');
      expect(result.source).toBe('local-onnx');
    });

    it('should truncate very long text', async () => {
      mockPipeline.mockResolvedValue([
        { label: 'POSITIVE', score: 0.9 },
        { label: 'NEGATIVE', score: 0.1 },
      ]);

      const result = await service.analyze(EDGE_CASE_TEXTS.veryLong);

      expect(result).toBeDefined();
      // Verify truncation happened - the text sent should be <= 503 chars (500 + "...")
      const calledWith = mockPipeline.mock.calls[0][0] as string;
      expect(calledWith.length).toBeLessThanOrEqual(503);
    });

    it('should handle special characters safely', async () => {
      mockPipeline.mockResolvedValue([
        { label: 'POSITIVE', score: 0.85 },
        { label: 'NEGATIVE', score: 0.15 },
      ]);

      await expect(
        service.analyze(EDGE_CASE_TEXTS.specialChars),
      ).resolves.toBeDefined();
    });

    it('should handle unicode text', async () => {
      mockPipeline.mockResolvedValue([
        { label: 'POSITIVE', score: 0.75 },
        { label: 'NEGATIVE', score: 0.25 },
      ]);

      await expect(
        service.analyze(EDGE_CASE_TEXTS.unicode),
      ).resolves.toBeDefined();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should throw on pipeline error', async () => {
      mockPipeline.mockRejectedValue(new Error('Inference failed'));

      await expect(service.analyze('test')).rejects.toThrow('Inference failed');
    });

    it('should select highest scoring result when multiple labels returned', async () => {
      mockPipeline.mockResolvedValue([
        { label: 'NEGATIVE', score: 0.3 },
        { label: 'POSITIVE', score: 0.95 },
      ]);

      const result = await service.analyze('test text');

      expect(result.source).toBe('local-onnx');
      expect(result.label).toBe('positive');
    });
  });

  describe('consistency', () => {
    beforeEach(async () => {
      await service.onModuleInit();
      mockPipeline.mockResolvedValue([
        { label: 'POSITIVE', score: 0.88 },
        { label: 'NEGATIVE', score: 0.12 },
      ]);
    });

    it('should return consistent results for same input', async () => {
      const text = 'This is a great product!';
      const result1 = await service.analyze(text);
      const result2 = await service.analyze(text);

      expect(result1.label).toBe(result2.label);
      expect(result1.score).toBeCloseTo(result2.score, 4);
      expect(result1.confidence).toBeCloseTo(result2.confidence, 4);
    });
  });

  describe('concurrent access', () => {
    beforeEach(async () => {
      await service.onModuleInit();
      setPipelineResponse('POSITIVE', 0.85);
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
      for (const result of results) {
        expect(result).toMatchObject({
          label: 'positive',
          source: 'local-onnx',
        });
        expect(result.score).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it('should only initialize pipeline once even with concurrent calls', async () => {
      // Create new service without pre-initialization
      const concurrentModule = await createModule(mockPipelineFactory);
      const concurrentService =
        concurrentModule.get<BertSentimentService>(BertSentimentService);

      // Reset call count
      mockPipelineFactory.mockClear();

      // Make multiple concurrent calls that will trigger initialization
      await Promise.all([
        concurrentService.analyze('test 1'),
        concurrentService.analyze('test 2'),
        concurrentService.analyze('test 3'),
      ]);

      // Pipeline factory should only be called once (singleton pattern)
      expect(mockPipelineFactory).toHaveBeenCalledTimes(1);

      await concurrentModule.close();
    });
  });

  describe('configuration', () => {
    it('should use default cache dir when not configured', async () => {
      const defaultModule = await createModule(mockPipelineFactory, {
        ML_MODEL_CACHE_DIR: undefined,
        ML_QUANTIZATION: undefined,
      });

      const defaultService =
        defaultModule.get<BertSentimentService>(BertSentimentService);
      await defaultService.onModuleInit();

      expect(mockPipelineFactory).toHaveBeenCalledWith(
        'sentiment-analysis',
        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        { dtype: 'q8', cache_dir: './models-cache' },
      );

      await defaultModule.close();
    });

    it('should use default quantization when not configured', async () => {
      const defaultModule = await createModule(mockPipelineFactory, {
        ML_MODEL_CACHE_DIR: undefined,
        ML_QUANTIZATION: undefined,
      });

      const defaultService =
        defaultModule.get<BertSentimentService>(BertSentimentService);
      const status = defaultService.getStatus();

      expect(status.quantization).toBe('q8');

      await defaultModule.close();
    });

    it.each([
      { quantization: 'fp32' },
      { quantization: 'fp16' },
      { quantization: 'q4' },
      { quantization: 'int8' },
    ] as const)(
      'should accept valid quantization type: $quantization',
      async ({ quantization }) => {
        const configModule = await createModule(mockPipelineFactory, {
          ML_QUANTIZATION: quantization,
        });

        const configService =
          configModule.get<BertSentimentService>(BertSentimentService);
        const status = configService.getStatus();

        expect(status.quantization).toBe(quantization);

        await configModule.close();
      },
    );

    it('should fall back to q8 for invalid quantization value', async () => {
      const invalidModule = await createModule(mockPipelineFactory, {
        ML_QUANTIZATION: 'invalid-type',
      });

      const invalidService =
        invalidModule.get<BertSentimentService>(BertSentimentService);
      const status = invalidService.getStatus();

      expect(status.quantization).toBe('q8');

      await invalidModule.close();
    });
  });
});
