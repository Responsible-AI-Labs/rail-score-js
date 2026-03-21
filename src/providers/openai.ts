import type { RailScore } from '../client';
import type { EvalResult, EvaluationMode } from '../types';
import { RAILBlockedError } from '../errors';

export interface RAILOpenAIConfig {
  thresholds?: Record<string, number>;
}

export interface RAILOpenAIResponse {
  response: any;
  content: string;
  railScore: EvalResult['rail_score'];
  evaluation: EvalResult;
  /** Whether the content was regenerated to meet thresholds */
  wasRegenerated: boolean;
  /** The original pre-regeneration content (undefined if not regenerated) */
  originalContent?: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Wrapper around OpenAI client that automatically evaluates responses with RAIL Score.
 *
 * @example
 * ```typescript
 * const railOpenAI = new RAILOpenAI(client, openai, { thresholds: { safety: 7.0 } });
 * const result = await railOpenAI.chat({
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * console.log('RAIL Score:', result.railScore.score);
 * ```
 */
export class RAILOpenAI {
  private client: RailScore;
  private openai: any;
  private config: RAILOpenAIConfig;

  constructor(client: RailScore, openaiInstance: any, config?: RAILOpenAIConfig) {
    this.client = client;
    this.openai = openaiInstance;
    this.config = config || {};
  }

  async chat(
    params: any & { railMode?: EvaluationMode; railSkip?: boolean }
  ): Promise<RAILOpenAIResponse> {
    const { railMode, railSkip, ...openaiParams } = params;

    const response = await this.openai.chat.completions.create(openaiParams);
    const content = response.choices?.[0]?.message?.content || '';

    const usage = {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
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
          `OpenAI response blocked: dimensions [${failed.join(', ')}] below threshold`,
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
