import type { RailScore } from '../client';
import type { EvalResult } from '../types';
import { RAILBlockedError } from '../errors';

export interface RAILAnthropicConfig {
  thresholds?: Record<string, number>;
}

/**
 * Wrapper around Anthropic client that automatically evaluates responses with RAIL Score.
 *
 * @example
 * ```typescript
 * const railAnthropic = new RAILAnthropic(client, anthropic, { thresholds: { safety: 7.0 } });
 * const result = await railAnthropic.message({
 *   model: 'claude-sonnet-4-6',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * console.log('RAIL Score:', result.railScore.score);
 * ```
 */
export class RAILAnthropic {
  private client: RailScore;
  private anthropic: any;
  private config: RAILAnthropicConfig;

  constructor(client: RailScore, anthropicInstance: any, config?: RAILAnthropicConfig) {
    this.client = client;
    this.anthropic = anthropicInstance;
    this.config = config || {};
  }

  async message(params: any): Promise<{
    response: any;
    content: string;
    railScore: EvalResult['rail_score'];
    evaluation: EvalResult;
  }> {
    const response = await this.anthropic.messages.create(params);

    let content = '';
    if (response.content && Array.isArray(response.content)) {
      content = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');
    }

    if (!content) {
      const emptyEval: EvalResult = {
        rail_score: { score: 0, confidence: 0, summary: '' },
        explanation: '',
        dimension_scores: {},
        from_cache: false,
      };
      return { response, content: '', railScore: emptyEval.rail_score, evaluation: emptyEval };
    }

    const evaluation = await this.client.eval({ content });

    if (this.config.thresholds) {
      const failed: string[] = [];
      for (const [dim, threshold] of Object.entries(this.config.thresholds)) {
        const score = evaluation.dimension_scores[dim];
        if (score && score.score < threshold) {
          failed.push(dim);
        }
      }

      if (failed.length > 0) {
        throw new RAILBlockedError(
          `Anthropic response blocked: dimensions [${failed.join(', ')}] below threshold`,
          'BLOCK',
          evaluation.dimension_scores
        );
      }
    }

    return { response, content, railScore: evaluation.rail_score, evaluation };
  }
}
