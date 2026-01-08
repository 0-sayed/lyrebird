import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Sentiment from 'sentiment';

/**
 * Sentiment analysis result
 */
export interface SentimentResult {
  /**
   * Normalized sentiment score (0.0 = most negative, 1.0 = most positive)
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
   * Source of the analysis result ('huggingface' or 'afinn')
   */
  source?: 'huggingface' | 'afinn';
}

/**
 * Service status information
 */
export interface ServiceStatus {
  ready: boolean;
  provider: 'huggingface' | 'afinn' | 'none';
  huggingfaceConfigured: boolean;
  error?: string;
  lastErrorAt?: string;
}

/**
 * Custom HTTP error class for type-safe error handling
 * Avoids brittle type assertions when attaching statusCode to Error
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * HuggingFace text classification response
 */
interface HuggingFaceClassificationResult {
  label: 'POSITIVE' | 'NEGATIVE';
  score: number;
}

/**
 * HTTP client interface for dependency injection (testing)
 */
export interface HttpClient {
  post: (
    url: string,
    data: unknown,
    headers: Record<string, string>,
  ) => Promise<HuggingFaceClassificationResult[][]>;
}

/**
 * Injection token for HTTP client (used for testing)
 */
export const HTTP_CLIENT = 'HTTP_CLIENT';

/**
 * Injection token for AFINN sentiment analyzer (used for testing)
 */
export const AFINN_ANALYZER = 'AFINN_ANALYZER';

/**
 * Sentiment analysis service using HuggingFace Inference API with AFINN fallback
 *
 * Primary: HuggingFace Inference API (distilbert-base-uncased-finetuned-sst-2-english)
 * Fallback: AFINN-165 wordlist-based analysis (for rate limits or API failures)
 *
 */
@Injectable()
export class BertSentimentService {
  private readonly logger = new Logger(BertSentimentService.name);

  private readonly afinnAnalyzer: Sentiment;
  private readonly huggingfaceApiKey: string | undefined;
  private readonly huggingfaceApiUrl: string;

  // HuggingFace error tracking for health status reporting
  private hfLastError: string | null = null;
  private hfLastErrorAt: Date | null = null;

  private static readonly MODEL_NAME =
    'distilbert/distilbert-base-uncased-finetuned-sst-2-english';
  private static readonly HF_API_BASE =
    'https://router.huggingface.co/hf-inference/models';
  private static readonly MAX_TEXT_LENGTH = 500;
  // Predictions below 60% confidence are considered too uncertain to classify
  // as positive/negative and are labeled as neutral instead
  private static readonly NEUTRAL_THRESHOLD = 0.6;

  // AFINN score range is approximately -5 to +5 per word
  // We normalize based on typical sentence lengths
  private static readonly AFINN_MAX_SCORE = 10;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(HTTP_CLIENT)
    private readonly httpClient?: HttpClient,
    @Optional()
    @Inject(AFINN_ANALYZER)
    afinnAnalyzer?: Sentiment,
  ) {
    this.afinnAnalyzer = afinnAnalyzer ?? new Sentiment();
    this.huggingfaceApiKey = this.configService.get<string>(
      'HUGGINGFACE_API_KEY',
    );
    this.huggingfaceApiUrl = `${BertSentimentService.HF_API_BASE}/${BertSentimentService.MODEL_NAME}`;

    if (!this.huggingfaceApiKey) {
      this.logger.warn(
        'HUGGINGFACE_API_KEY not configured - will use AFINN fallback only',
      );
    }
  }

  /**
   * Check if the service is ready for inference
   * Always returns true since AFINN fallback is always available
   */
  isReady(): boolean {
    return true;
  }

  /**
   * Get service status information
   *
   * A HuggingFace API key being present is not sufficient to consider the service "ready":
   * if recent HuggingFace calls have been failing, the status will reflect that by
   * surfacing the last error and flipping `ready` to false for the HuggingFace provider.
   */
  getStatus(): ServiceStatus {
    const hasApiKey = !!this.huggingfaceApiKey;

    if (!hasApiKey) {
      return {
        ready: true,
        provider: 'afinn',
        huggingfaceConfigured: false,
        error: 'HUGGINGFACE_API_KEY not configured - using AFINN fallback only',
      };
    }

    const hasRecentHfError = !!this.hfLastError;
    return {
      ready: !hasRecentHfError,
      provider: 'huggingface',
      huggingfaceConfigured: true,
      error: this.hfLastError ?? undefined,
      lastErrorAt: this.hfLastErrorAt?.toISOString() ?? undefined,
    };
  }

  /**
   * Analyze text sentiment using HuggingFace API with AFINN fallback
   *
   * @param text - The text to analyze
   * @returns SentimentResult with score, label, confidence, and source
   */
  async analyze(text: string): Promise<SentimentResult> {
    const processedText = this.truncateText(text);

    // Try HuggingFace API first if configured
    if (this.huggingfaceApiKey) {
      try {
        return await this.analyzeWithHuggingFace(processedText);
      } catch (error) {
        // Check if it's a rate limit error (429)
        if (this.isRateLimitError(error)) {
          this.logger.warn(
            'HuggingFace API rate limited, falling back to AFINN',
          );
          return this.analyzeWithAfinn(processedText);
        }

        // For other errors, log and fallback
        this.logger.error(
          'HuggingFace API error, falling back to AFINN',
          error instanceof Error ? error.message : String(error),
        );
        return this.analyzeWithAfinn(processedText);
      }
    }

    // No API key configured, use AFINN directly
    return this.analyzeWithAfinn(processedText);
  }

  /**
   * Analyze sentiment using HuggingFace Inference API
   */
  private async analyzeWithHuggingFace(text: string): Promise<SentimentResult> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.huggingfaceApiKey}`,
      'Content-Type': 'application/json',
    };

    const payload = { inputs: text };

    let response: HuggingFaceClassificationResult[][];

    if (this.httpClient) {
      // Use injected HTTP client (for testing)
      response = await this.httpClient.post(
        this.huggingfaceApiUrl,
        payload,
        headers,
      );
    } else {
      // Use native fetch with timeout and error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const fetchResponse = await fetch(this.huggingfaceApiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!fetchResponse.ok) {
          throw new HttpError(
            `HuggingFace API error: ${fetchResponse.status}`,
            fetchResponse.status,
          );
        }

        // Handle JSON parsing errors
        try {
          response =
            (await fetchResponse.json()) as HuggingFaceClassificationResult[][];
        } catch (jsonError) {
          throw new Error(
            `Failed to parse HuggingFace API response: ${jsonError instanceof Error ? jsonError.message : 'Invalid JSON'}`,
          );
        }

        // Clear any previous error on successful request
        this.hfLastError = null;
        this.hfLastErrorAt = null;
      } catch (fetchError) {
        // Track the error for health status reporting
        this.hfLastError =
          fetchError instanceof Error
            ? fetchError.message
            : 'Unknown HuggingFace error';
        this.hfLastErrorAt = new Date();

        // Handle network errors and timeouts
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('HuggingFace API request timed out after 10 seconds');
        }
        throw fetchError;
      } finally {
        // Ensure timeout is always cleared, even if JSON parsing fails
        clearTimeout(timeoutId);
      }
    }

    // HuggingFace returns [[{label, score}, ...]]
    if (!response || !response[0] || response[0].length === 0) {
      throw new Error('Empty response from HuggingFace API');
    }

    // Get the highest scoring result
    const results = response[0];
    const topResult = results.reduce((prev, curr) =>
      curr.score > prev.score ? curr : prev,
    );

    return this.mapHuggingFaceResult(topResult);
  }

  /**
   * Analyze sentiment using AFINN-165 wordlist
   */
  private analyzeWithAfinn(text: string): SentimentResult {
    const result = this.afinnAnalyzer.analyze(text) as {
      score: number;
      comparative: number;
      positive: string[];
      negative: string[];
      tokens: string[];
    };

    // AFINN returns:
    // - score: sum of word scores (can be any integer)
    // - comparative: score normalized by word count

    // Normalize to 0-1 range
    // comparative typically ranges from -5 to +5
    const normalizedScore = Math.max(
      0,
      Math.min(
        1,
        (result.comparative + BertSentimentService.AFINN_MAX_SCORE / 2) /
          BertSentimentService.AFINN_MAX_SCORE,
      ),
    );

    // Calculate confidence based on how many words were scored
    // More scored words = higher confidence
    const scoredWordRatio =
      (result.positive.length + result.negative.length) /
      Math.max(1, result.tokens.length);
    // Cap AFINN confidence below 1.0 because it is a simple lexicon-based model
    // and generally less reliable than the HuggingFace/BERT classifier; this keeps
    // its reported confidence conservative and comparable across models.
    const confidence = Math.min(0.85, 0.4 + scoredWordRatio * 0.5);

    // Determine label based on normalized score thresholds
    const label: 'positive' | 'negative' | 'neutral' =
      normalizedScore > 0.55
        ? 'positive'
        : normalizedScore < 0.45
          ? 'negative'
          : 'neutral';

    return {
      score: normalizedScore,
      label,
      confidence,
      source: 'afinn',
    };
  }

  /**
   * Map HuggingFace API result to our SentimentResult format
   */
  private mapHuggingFaceResult(
    result: HuggingFaceClassificationResult,
  ): SentimentResult {
    const { label, score } = result;
    const confidence = score;

    // Calculate normalized score (0 = negative, 1 = positive)
    let normalizedScore: number;
    if (label === 'POSITIVE') {
      normalizedScore = 0.5 + score * 0.5;
    } else {
      normalizedScore = 0.5 - score * 0.5;
    }

    // Determine label (neutral for low confidence predictions)
    const sentimentLabel: 'positive' | 'negative' | 'neutral' =
      confidence < BertSentimentService.NEUTRAL_THRESHOLD
        ? 'neutral'
        : label === 'POSITIVE'
          ? 'positive'
          : 'negative';

    return {
      score: normalizedScore,
      label: sentimentLabel,
      confidence,
      source: 'huggingface',
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

  /**
   * Check if an error is a rate limit error (HTTP 429)
   */
  private isRateLimitError(error: unknown): boolean {
    return error instanceof HttpError && error.statusCode === 429;
  }
}
