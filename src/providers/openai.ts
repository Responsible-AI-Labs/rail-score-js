import type { RailScore } from '../client';
import type { EvaluationResult } from '../types';
import { RAILBlockedError } from '../errors';

/**
 * Configuration for the RAIL OpenAI wrapper
 */
export interface RAILOpenAIConfig {
  /** Score thresholds per dimension - responses below trigger RAILBlockedError */
  thresholds?: Record<string, number>;
}

/**
 * Wrapper around OpenAI client that automatically evaluates responses with RAIL Score.
 *
 * Intercepts `chat.completions.create` calls, evaluates the response, and
 * attaches the RAIL score to the result. Optionally enforces score thresholds.
 *
 * @example
 * ```typescript
 * import OpenAI from 'openai';
 * import { RailScore, RAILOpenAI } from '@responsible-ai-labs/rail-score';
 *
 * const client = new RailScore({ apiKey: 'rail-key' });
 * const openai = new OpenAI({ apiKey: 'openai-key' });
 *
 * const railOpenAI = new RAILOpenAI(client, openai, {
 *   thresholds: { safety: 7.0 }
 * });
 *
 * const result = await railOpenAI.chat('Hello, help me with...');
 * console.log('Response:', result.content);
 * console.log('RAIL Score:', result.railScore.score);
 * ```
 */
export class RAILOpenAI {
  private client: RailScore;
  private openai: any;
  private config: RAILOpenAIConfig;

  /**
   * Create a RAIL-wrapped OpenAI client
   *
   * @param client - RailScore client instance
   * @param openaiInstance - OpenAI client instance
   * @param config - Optional configuration with thresholds
   */
  constructor(client: RailScore, openaiInstance: any, config?: RAILOpenAIConfig) {
    this.client = client;
    this.openai = openaiInstance;
    this.config = config || {};
  }

  /**
   * Create a chat completion and evaluate the response
   *
   * Calls the OpenAI chat completions API, evaluates the response content,
   * and returns both the original response and the RAIL score.
   *
   * @param params - Parameters to pass to chat.completions.create
   * @returns Response with attached railScore and evaluation
   * @throws {RAILBlockedError} If thresholds are configured and any dimension fails
   */
  async chat(params: any): Promise<{
    response: any;
    content: string;
    railScore: EvaluationResult['railScore'];
    evaluation: EvaluationResult;
  }> {
    const response = await this.openai.chat.completions.create(params);

    const content = response.choices?.[0]?.message?.content || '';

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
          `OpenAI response blocked: dimensions [${failed.join(', ')}] below threshold`,
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
