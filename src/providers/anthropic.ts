import type { RailScore } from '../client';
import type { EvalResult, EvaluationMode } from '../types';
import { RAILBlockedError } from '../errors';

export interface RAILAnthropicConfig {
  thresholds?: Record<string, number>;
}

export interface RAILAnthropicResponse {
  response: any;
  content: string;
  railScore: EvalResult['rail_score'];
  evaluation: EvalResult;
  /** Whether the content was regenerated to meet thresholds */
  wasRegenerated: boolean;
  /** The original pre-regeneration content (undefined if not regenerated) */
  originalContent?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
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

  async message(
    params: any & { system?: string; railMode?: EvaluationMode; railSkip?: boolean }
  ): Promise<RAILAnthropicResponse> {
    const { railMode, railSkip, ...anthropicParams } = params;

    const response = await this.anthropic.messages.create(anthropicParams);

    let content = '';
    if (response.content && Array.isArray(response.content)) {
      content = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');
    }

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const usage = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    };

    if (railSkip || !content) {
      const emptyEval: EvalResult = {
        rail_score: { score: 0, confidence: 0, summary: '' },
        explanation: '',
        dimension_scores: {},
        from_cache: false,
      };
      return {
        response,
        content: content || '',
        railScore: emptyEval.rail_score,
        evaluation: emptyEval,
        wasRegenerated: false,
        originalContent: undefined,
        usage,
      };
    }

    const evaluation = await this.client.eval({
      content,
      ...(railMode && { mode: railMode }),
    });

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

    return {
      response,
      content,
      railScore: evaluation.rail_score,
      evaluation,
      wasRegenerated: false,
      originalContent: undefined,
      usage,
    };
  }
}
