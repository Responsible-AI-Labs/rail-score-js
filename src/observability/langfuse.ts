import type { RailScore } from '../client';
import type { EvaluationResult, EvaluationMode } from '../types';

/**
 * Langfuse integration for pushing RAIL scores to Langfuse traces.
 *
 * Allows automatic evaluation and scoring of Langfuse traces with
 * the full RAIL dimension scores.
 *
 * @example
 * ```typescript
 * import { RailScore, RAILLangfuse } from '@responsible-ai-labs/rail-score';
 * import Langfuse from 'langfuse';
 *
 * const client = new RailScore({ apiKey: 'rail-key' });
 * const langfuse = new Langfuse({ publicKey: '...', secretKey: '...' });
 *
 * const railLangfuse = new RAILLangfuse(client, langfuse);
 *
 * // Evaluate content and push scores to a Langfuse trace
 * const result = await railLangfuse.traceEvaluation('trace-123', 'Content to evaluate');
 * ```
 */
export class RAILLangfuse {
  private client: RailScore;
  private langfuse: any;

  /**
   * Create a RAIL Langfuse integration
   *
   * @param client - RailScore client instance
   * @param langfuseClient - Langfuse client instance
   */
  constructor(client: RailScore, langfuseClient: any) {
    this.client = client;
    this.langfuse = langfuseClient;
  }

  /**
   * Evaluate content and push scores to a Langfuse trace
   *
   * Evaluates the content using RAIL Score and attaches all dimension
   * scores to the specified Langfuse trace.
   *
   * @param traceId - Langfuse trace ID to attach scores to
   * @param content - Content to evaluate
   * @param mode - Optional evaluation mode
   * @returns The evaluation result
   */
  async traceEvaluation(
    traceId: string,
    content: string,
    mode?: EvaluationMode
  ): Promise<EvaluationResult> {
    const result = await this.client.evaluation.basic(content, undefined, {
      mode: mode || 'basic',
    });

    await this.scoreTrace(traceId, result);

    return result;
  }

  /**
   * Push an existing evaluation result to a Langfuse trace
   *
   * Attaches RAIL dimension scores to a Langfuse trace without
   * re-evaluating the content.
   *
   * @param traceId - Langfuse trace ID
   * @param result - Existing evaluation result to push
   */
  async scoreTrace(traceId: string, result: EvaluationResult): Promise<void> {
    // Push overall RAIL score
    this.langfuse.score({
      traceId,
      name: 'rail_score',
      value: result.railScore.score,
    });

    // Push per-dimension scores
    for (const [dimension, dimScore] of Object.entries(result.scores)) {
      this.langfuse.score({
        traceId,
        name: `rail_${dimension}`,
        value: dimScore.score,
        comment: dimScore.explanation,
      });
    }
  }
}
