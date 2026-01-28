import {
  Injectable,
  Logger,
  Inject,
  Optional,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sentiment analysis result
 */
export interface SentimentResult {
  /**
   * Normalized sentiment score (-1.0 = most negative, +1.0 = most positive)
   * This follows the industry standard used by VADER, TextBlob, and HuggingFace.
   * 0.0 represents neutral sentiment.
   */
  score: number;

  /**
   * Categorical label: 'positive', 'negative', or 'neutral'
   */
  label: 'positive' | 'negative' | 'neutral';

  /**
   * Model's confidence in its prediction (0.0-1.0)
   */
  confidence: number;

  /**
   * Source of the analysis result
   */
  source: 'local-onnx';
}

/**
 * Service status information
 */
export interface ServiceStatus {
  ready: boolean;
  provider: 'local-onnx';
  modelLoaded: boolean;
  modelName: string;
  quantization: string;
  error?: string;
}

/**
 * Quantization type matching @huggingface/transformers options
 */
export type QuantizationType =
  | 'auto'
  | 'fp32'
  | 'fp16'
  | 'q8'
  | 'int8'
  | 'uint8'
  | 'q4'
  | 'bnb4'
  | 'q4f16';

/**
 * Pipeline factory type for dependency injection (testing)
 */
export type PipelineFactory = (
  task: string,
  model: string,
  options: { dtype: QuantizationType; cache_dir?: string },
) => Promise<SentimentPipeline>;

/**
 * Sentiment pipeline interface matching @huggingface/transformers
 */
export interface SentimentPipeline {
  (
    text: string,
    options?: { topk?: number },
  ): Promise<Array<{ label: string; score: number }>>;
}

/**
 * Injection token for pipeline factory (used for testing)
 */
export const PIPELINE_FACTORY = 'PIPELINE_FACTORY';

/**
 * Sentiment analysis service using local ONNX inference
 *
 * Uses @huggingface/transformers with distilbert-base-uncased-finetuned-sst-2-english
 * for fast, offline sentiment analysis without API dependencies.
 */
@Injectable()
export class BertSentimentService implements OnModuleInit {
  private readonly logger = new Logger(BertSentimentService.name);

  private pipeline: SentimentPipeline | null = null;
  private initializationPromise: Promise<void> | null = null;
  private initError: string | null = null;

  private static readonly MODEL_NAME =
    'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
  private static readonly MAX_TEXT_LENGTH = 500;
  // Predictions below 60% confidence are considered too uncertain to classify
  // as positive/negative and are labeled as neutral instead
  private static readonly NEUTRAL_THRESHOLD = 0.6;

  private readonly cacheDir: string;
  private readonly quantization: QuantizationType;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(PIPELINE_FACTORY)
    private readonly pipelineFactory?: PipelineFactory,
  ) {
    this.cacheDir =
      this.configService.get<string>('ML_MODEL_CACHE_DIR') || './models-cache';
    const configQuantization =
      this.configService.get<string>('ML_QUANTIZATION');
    this.quantization = this.isValidQuantization(configQuantization)
      ? configQuantization
      : 'q8';
  }

  /**
   * Type guard to validate quantization value
   */
  private isValidQuantization(value: unknown): value is QuantizationType {
    const validTypes: QuantizationType[] = [
      'auto',
      'fp32',
      'fp16',
      'q8',
      'int8',
      'uint8',
      'q4',
      'bnb4',
      'q4f16',
    ];
    return (
      typeof value === 'string' &&
      validTypes.includes(value as QuantizationType)
    );
  }

  /**
   * Initialize the sentiment analysis pipeline on module startup
   */
  async onModuleInit(): Promise<void> {
    await this.ensureInitialized();
  }

  /**
   * Ensure the pipeline is initialized (lazy loading with singleton pattern)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.pipeline) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.initializePipeline();
    await this.initializationPromise;
  }

  /**
   * Initialize the ONNX sentiment analysis pipeline
   */
  private async initializePipeline(): Promise<void> {
    try {
      this.logger.log(
        `Loading sentiment model: ${BertSentimentService.MODEL_NAME} (${this.quantization})`,
      );

      const startTime = Date.now();

      if (this.pipelineFactory) {
        // Use injected factory (for testing)
        this.pipeline = await this.pipelineFactory(
          'sentiment-analysis',
          BertSentimentService.MODEL_NAME,
          { dtype: this.quantization, cache_dir: this.cacheDir },
        );
      } else {
        // Dynamic import for ESM compatibility

        const { pipeline } = await import('@huggingface/transformers');

        this.pipeline = (await pipeline(
          'sentiment-analysis',
          BertSentimentService.MODEL_NAME,
          {
            dtype: this.quantization,
            cache_dir: this.cacheDir,
          },
        )) as unknown as SentimentPipeline;
      }

      const loadTime = Date.now() - startTime;
      this.logger.log(`Sentiment analysis pipeline ready (${loadTime}ms)`);
      this.initError = null;
    } catch (error) {
      this.initError =
        error instanceof Error ? error.message : 'Failed to load model';
      this.logger.error(
        'Failed to initialize sentiment pipeline',
        this.initError,
      );
      throw error;
    }
  }

  /**
   * Check if the service is ready for inference
   */
  isReady(): boolean {
    return this.pipeline !== null;
  }

  /**
   * Get service status information
   */
  getStatus(): ServiceStatus {
    return {
      ready: this.pipeline !== null,
      provider: 'local-onnx',
      modelLoaded: this.pipeline !== null,
      modelName: BertSentimentService.MODEL_NAME,
      quantization: this.quantization,
      error: this.initError ?? undefined,
    };
  }

  /**
   * Analyze text sentiment using local ONNX inference
   *
   * @param text - The text to analyze
   * @returns SentimentResult with score, label, confidence, and source
   */
  async analyze(text: string): Promise<SentimentResult> {
    await this.ensureInitialized();

    if (!this.pipeline) {
      throw new Error('Sentiment pipeline not initialized');
    }

    const processedText = this.truncateText(text);

    // Handle empty text
    if (!processedText.trim()) {
      return {
        score: 0,
        label: 'neutral',
        confidence: 0.5,
        source: 'local-onnx',
      };
    }

    const results = await this.pipeline(processedText, { topk: 2 });

    // Get the highest scoring result
    const topResult = results.reduce((prev, curr) =>
      curr.score > prev.score ? curr : prev,
    );

    return this.mapResult(topResult);
  }

  /**
   * Clamp a value to the specified range
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Map pipeline result to our SentimentResult format
   */
  private mapResult(result: { label: string; score: number }): SentimentResult {
    const { label, score } = result;

    // Clamp confidence to 0-1 range (should already be, but safety first)
    const confidence = this.clamp(score, 0, 1);

    // Calculate normalized score (-1 = negative, +1 = positive)
    // Industry standard: -1 to +1 scale with 0 as neutral
    let normalizedScore: number;
    const isPositive = label.toUpperCase() === 'POSITIVE';

    if (isPositive) {
      // Map confidence (0-1) to positive range (0 to +1)
      normalizedScore = confidence;
    } else {
      // Map confidence (0-1) to negative range (0 to -1)
      normalizedScore = -confidence;
    }

    // Clamp final score to -1 to +1 range (defensive programming)
    normalizedScore = this.clamp(normalizedScore, -1, 1);

    // Determine label (neutral for low confidence predictions)
    const sentimentLabel: 'positive' | 'negative' | 'neutral' =
      confidence < BertSentimentService.NEUTRAL_THRESHOLD
        ? 'neutral'
        : isPositive
          ? 'positive'
          : 'negative';

    return {
      score: normalizedScore,
      label: sentimentLabel,
      confidence,
      source: 'local-onnx',
    };
  }

  /**
   * Truncate text to maximum allowed length
   */
  private truncateText(text: string): string {
    if (text.length <= BertSentimentService.MAX_TEXT_LENGTH) {
      return text;
    }
    return text.substring(0, BertSentimentService.MAX_TEXT_LENGTH) + '...';
  }
}
