import type { RailScore } from '../client';
import type { EvalResult, EvaluationMode } from '../types';

/**
 * Langfuse integration for pushing RAIL scores to Langfuse traces.
 *
 * @example
 * ```typescript
 * const railLangfuse = new RAILLangfuse(client, langfuse);
 * const result = await railLangfuse.evaluateAndLog('Content to evaluate', 'trace-123');
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

  /**
   * Pushes RAIL scores for an existing evaluation result to a Langfuse trace.
   *
   * @param traceId   Langfuse trace ID
   * @param result    Evaluation result to push
   * @param options   Optional Langfuse score parameters (observationId, sessionId, comment, thresholdMet)
   */
  async scoreTrace(
    traceId: string,
    result: EvalResult,
    options?: {
      observationId?: string;
      sessionId?: string;
      comment?: string;
      thresholdMet?: boolean;
    }
  ): Promise<void> {
    const baseScore: Record<string, any> = { traceId };
    if (options?.observationId) baseScore.observationId = options.observationId;
    if (options?.sessionId) baseScore.sessionId = options.sessionId;

    this.langfuse.score({
      ...baseScore,
      name: 'rail_score',
      value: result.rail_score.score,
      comment: options?.comment,
    });

    this.langfuse.score({
      ...baseScore,
      name: 'rail_confidence',
      value: result.rail_score.confidence,
    });

    if (options?.thresholdMet !== undefined) {
      this.langfuse.score({
        ...baseScore,
        name: 'rail_threshold_met',
        value: options.thresholdMet ? 1 : 0,
      });
    }

    for (const [dimension, dimScore] of Object.entries(result.dimension_scores)) {
      this.langfuse.score({
        ...baseScore,
        name: `rail_${dimension}`,
        value: dimScore.score,
        comment: dimScore.explanation,
      });
    }
  }

  /**
   * Evaluates content and immediately logs all scores to a Langfuse trace.
   * Combines eval + scoreTrace into a single convenience call.
   *
   * @param content   Text to evaluate
   * @param traceId   Langfuse trace ID to attach scores to
   * @param options   Evaluation and Langfuse options
   * @returns         The full evaluation result
   */
  async evaluateAndLog(
    content: string,
    traceId: string,
    options?: {
      mode?: EvaluationMode;
      observationId?: string;
      sessionId?: string;
      comment?: string;
      thresholdMet?: boolean;
    }
  ): Promise<EvalResult> {
    const result = await this.client.eval({
      content,
      mode: options?.mode || 'basic',
    });

    await this.scoreTrace(traceId, result, {
      observationId: options?.observationId,
      sessionId: options?.sessionId,
      comment: options?.comment,
      thresholdMet: options?.thresholdMet,
    });

    return result;
  }
}
