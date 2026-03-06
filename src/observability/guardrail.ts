import type { RailScore } from '../client';
import type { EvalResult } from '../types';

export interface RAILGuardrailConfig {
  inputThresholds?: Record<string, number>;
  outputThresholds?: Record<string, number>;
}

export interface GuardResult {
  allowed: boolean;
  result: EvalResult;
  failedDimensions?: string[];
}

/**
 * Guardrail integration for pre/post-call content evaluation.
 *
 * @example
 * ```typescript
 * const guardrail = new RAILGuardrail(client, {
 *   inputThresholds: { safety: 7.0 },
 *   outputThresholds: { safety: 7.0, fairness: 6.0 },
 * });
 *
 * const inputResult = await guardrail.preCall('User input');
 * if (!inputResult.allowed) {
 *   console.log('Input blocked');
 * }
 * ```
 */
export class RAILGuardrail {
  private client: RailScore;
  private config: RAILGuardrailConfig;

  constructor(client: RailScore, config: RAILGuardrailConfig) {
    this.client = client;
    this.config = config;
  }

  async preCall(input: string): Promise<GuardResult> {
    const result = await this.client.eval({ content: input });

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

  async postCall(output: string): Promise<GuardResult> {
    const result = await this.client.eval({ content: output });

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

  getHandler(): {
    preCall: (input: string) => Promise<GuardResult>;
    postCall: (output: string) => Promise<GuardResult>;
  } {
    return {
      preCall: (input: string) => this.preCall(input),
      postCall: (output: string) => this.postCall(output),
    };
  }

  private checkThresholds(
    result: EvalResult,
    thresholds: Record<string, number>
  ): string[] {
    const failed: string[] = [];
    for (const [dim, threshold] of Object.entries(thresholds)) {
      const score = result.dimension_scores[dim];
      if (score && score.score < threshold) {
        failed.push(dim);
      }
    }
    return failed;
  }
}
