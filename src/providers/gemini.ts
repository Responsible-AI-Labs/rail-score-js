import type { RailScore } from '../client';
import type { EvaluationResult } from '../types';
import { RAILBlockedError } from '../errors';

/**
 * Configuration for the RAIL Gemini wrapper
 */
export interface RAILGeminiConfig {
  /** Score thresholds per dimension - responses below trigger RAILBlockedError */
  thresholds?: Record<string, number>;
}

/**
 * Wrapper around Google Generative AI client that automatically evaluates responses with RAIL Score.
 *
 * Intercepts `generateContent` calls, evaluates the response, and
 * attaches the RAIL score to the result. Optionally enforces score thresholds.
 *
 * @example
 * ```typescript
 * import { GoogleGenerativeAI } from '@google/generative-ai';
 * import { RailScore, RAILGemini } from '@responsible-ai-labs/rail-score';
 *
 * const client = new RailScore({ apiKey: 'rail-key' });
 * const genAI = new GoogleGenerativeAI('gemini-key');
 * const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
 *
 * const railGemini = new RAILGemini(client, model, {
 *   thresholds: { safety: 7.0 }
 * });
 *
 * const result = await railGemini.generate('Tell me about AI safety');
 * console.log('RAIL Score:', result.railScore.score);
 * ```
 */
export class RAILGemini {
  private client: RailScore;
  private model: any;
  private config: RAILGeminiConfig;

  /**
   * Create a RAIL-wrapped Gemini model
   *
   * @param client - RailScore client instance
   * @param modelInstance - Google Generative AI model instance
   * @param config - Optional configuration with thresholds
   */
  constructor(client: RailScore, modelInstance: any, config?: RAILGeminiConfig) {
    this.client = client;
    this.model = modelInstance;
    this.config = config || {};
  }

  /**
   * Generate content and evaluate the response
   *
   * Calls the Gemini generateContent API, evaluates the response content,
   * and returns both the original response and the RAIL score.
   *
   * @param params - Content string or parameters for generateContent
   * @returns Response with attached railScore and evaluation
   * @throws {RAILBlockedError} If thresholds are configured and any dimension fails
   */
  async generate(params: any): Promise<{
    response: any;
    content: string;
    railScore: EvaluationResult['railScore'];
    evaluation: EvaluationResult;
  }> {
    const response = await this.model.generateContent(params);

    // Extract text from Gemini response
    let content = '';
    try {
      const result = response.response || response;
      content = result.text?.() || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch {
      content = '';
    }

    if (!content) {
      return {
        response,
        content: '',
        railScore: { score: 0, confidence: 0 },
        evaluation: {
          railScore: { score: 0, confidence: 0 },
          scores: {},
          metadata: {
            reqId: '',
            tier: 'balanced',
            queueWaitTimeMs: 0,
            processingTimeMs: 0,
            creditsConsumed: 0,
            timestamp: new Date().toISOString(),
          },
        },
      };
    }

    const evaluation = await this.client.evaluation.basic(content);

    // Check thresholds if configured
    if (this.config.thresholds) {
      const failed: string[] = [];
      for (const [dim, threshold] of Object.entries(this.config.thresholds)) {
        const score = evaluation.scores[dim];
        if (score && score.score < threshold) {
          failed.push(dim);
        }
      }

      if (failed.length > 0) {
        throw new RAILBlockedError(
          `Gemini response blocked: dimensions [${failed.join(', ')}] below threshold`,
          'BLOCK',
          evaluation.scores
        );
      }
    }

    return {
      response,
      content,
      railScore: evaluation.railScore,
      evaluation,
    };
  }
}
