import type { RailScore } from '../client';
import type { EvaluationResult } from '../types';

/**
 * Configuration for the RAIL Guardrail
 */
export interface RAILGuardrailConfig {
  /** Score thresholds per dimension for pre-call checks */
  inputThresholds?: Record<string, number>;
  /** Score thresholds per dimension for post-call checks */
  outputThresholds?: Record<string, number>;
}

/**
 * Guard result indicating whether content is allowed
 */
export interface GuardResult {
  /** Whether the content passed all threshold checks */
  allowed: boolean;
  /** The full evaluation result */
  result: EvaluationResult;
  /** Dimensions that failed threshold checks (empty if allowed) */
  failedDimensions?: string[];
}

/**
 * Guardrail integration for pre/post-call content evaluation.
 *
 * Provides a standard interface for integrating RAIL scores as guardrails
 * in LLM pipelines (compatible with LiteLLM and similar frameworks).
 *
 * @example
 * ```typescript
 * const guardrail = new RAILGuardrail(client, {
 *   inputThresholds: { safety: 7.0 },
 *   outputThresholds: { safety: 7.0, fairness: 6.0 }
 * });
 *
 * // Use pre/post call handlers
 * const inputResult = await guardrail.preCall('User input');
 * if (!inputResult.allowed) {
 *   console.log('Input blocked');
 * }
 *
 * // Or get a handler object for LiteLLM integration
 * const handler = guardrail.getHandler();
 * ```
 */
export class RAILGuardrail {
  private client: RailScore;
  private config: RAILGuardrailConfig;

  /**
   * Create a RAIL Guardrail
   *
   * @param client - RailScore client instance
   * @param config - Guardrail configuration with thresholds
   */
  constructor(client: RailScore, config: RAILGuardrailConfig) {
    this.client = client;
    this.config = config;
  }

  /**
   * Evaluate input content before an LLM call
   *
   * @param input - Input content to evaluate
   * @returns Guard result indicating if content is allowed
   */
  async preCall(input: string): Promise<GuardResult> {
    const result = await this.client.evaluation.basic(input);

    if (!this.config.inputThresholds) {
      return { allowed: true, result };
    }

    const failedDimensions = this.checkThresholds(result, this.config.inputThresholds);

    return {
      allowed: failedDimensions.length === 0,
      result,
      failedDimensions: failedDimensions.length > 0 ? failedDimensions : undefined,
    };
  }

  /**
   * Evaluate output content after an LLM call
   *
   * @param output - Output content to evaluate
   * @returns Guard result indicating if content is allowed
   */
  async postCall(output: string): Promise<GuardResult> {
    const result = await this.client.evaluation.basic(output);

    if (!this.config.outputThresholds) {
      return { allowed: true, result };
    }

    const failedDimensions = this.checkThresholds(result, this.config.outputThresholds);

    return {
      allowed: failedDimensions.length === 0,
      result,
      failedDimensions: failedDimensions.length > 0 ? failedDimensions : undefined,
    };
  }

  /**
   * Get a handler object compatible with LiteLLM integration
   *
   * @returns Object with preCall and postCall methods
   */
  getHandler(): { preCall: (input: string) => Promise<GuardResult>; postCall: (output: string) => Promise<GuardResult> } {
    return {
      preCall: (input: string) => this.preCall(input),
      postCall: (output: string) => this.postCall(output),
    };
  }

  /**
   * Check which dimensions fail the given thresholds
   * @internal
   */
  private checkThresholds(
    result: EvaluationResult,
    thresholds: Record<string, number>
  ): string[] {
    const failed: string[] = [];
    for (const [dim, threshold] of Object.entries(thresholds)) {
      const score = result.scores[dim];
      if (score && score.score < threshold) {
        failed.push(dim);
      }
    }
    return failed;
  }
}
