import type { RailScore } from '../client';
import type { EvalResult, EvaluationMode } from '../types';

/**
 * Langfuse integration for pushing RAIL scores to Langfuse traces.
 *
 * @example
 * ```typescript
 * const railLangfuse = new RAILLangfuse(client, langfuse);
 * const result = await railLangfuse.traceEvaluation('trace-123', 'Content to evaluate');
 * ```
 */
export class RAILLangfuse {
  private client: RailScore;
  private langfuse: any;

  constructor(client: RailScore, langfuseClient: any) {
    this.client = client;
    this.langfuse = langfuseClient;
  }

  async traceEvaluation(
    traceId: string,
    content: string,
    mode?: EvaluationMode
  ): Promise<EvalResult> {
    const result = await this.client.eval({ content, mode: mode || 'basic' });
    await this.scoreTrace(traceId, result);
    return result;
  }

  async scoreTrace(traceId: string, result: EvalResult): Promise<void> {
    this.langfuse.score({
      traceId,
      name: 'rail_score',
      value: result.rail_score.score,
    });

    for (const [dimension, dimScore] of Object.entries(result.dimension_scores)) {
      this.langfuse.score({
        traceId,
        name: `rail_${dimension}`,
        value: dimScore.score,
        comment: dimScore.explanation,
      });
    }
  }
}
