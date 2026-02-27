import type { RailScore } from '../client';
import type { EvaluationResult } from '../types';
import { RAILBlockedError } from '../errors';

/**
 * Configuration for the RAIL Anthropic wrapper
 */
export interface RAILAnthropicConfig {
  /** Score thresholds per dimension - responses below trigger RAILBlockedError */
  thresholds?: Record<string, number>;
}

/**
 * Wrapper around Anthropic client that automatically evaluates responses with RAIL Score.
 *
 * Intercepts `messages.create` calls, evaluates the response, and
 * attaches the RAIL score to the result. Optionally enforces score thresholds.
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { RailScore, RAILAnthropic } from '@responsible-ai-labs/rail-score';
 *
 * const client = new RailScore({ apiKey: 'rail-key' });
 * const anthropic = new Anthropic({ apiKey: 'anthropic-key' });
 *
 * const railAnthropic = new RAILAnthropic(client, anthropic, {
 *   thresholds: { safety: 7.0 }
 * });
 *
 * const result = await railAnthropic.message({
 *   model: 'claude-sonnet-4-6',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello' }]
 * });
 * console.log('RAIL Score:', result.railScore.score);
 * ```
 */
export class RAILAnthropic {
  private client: RailScore;
  private anthropic: any;
  private config: RAILAnthropicConfig;

  /**
   * Create a RAIL-wrapped Anthropic client
   *
   * @param client - RailScore client instance
   * @param anthropicInstance - Anthropic client instance
   * @param config - Optional configuration with thresholds
   */
  constructor(client: RailScore, anthropicInstance: any, config?: RAILAnthropicConfig) {
    this.client = client;
    this.anthropic = anthropicInstance;
    this.config = config || {};
  }

  /**
   * Create a message and evaluate the response
   *
   * Calls the Anthropic messages API, evaluates the response content,
   * and returns both the original response and the RAIL score.
   *
   * @param params - Parameters to pass to messages.create
   * @returns Response with attached railScore and evaluation
   * @throws {RAILBlockedError} If thresholds are configured and any dimension fails
   */
  async message(params: any): Promise<{
    response: any;
    content: string;
    railScore: EvaluationResult['railScore'];
    evaluation: EvaluationResult;
  }> {
    const response = await this.anthropic.messages.create(params);

    // Extract text content from Anthropic response format
    let content = '';
    if (response.content && Array.isArray(response.content)) {
      content = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');
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
          `Anthropic response blocked: dimensions [${failed.join(', ')}] below threshold`,
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
