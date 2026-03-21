import type { RailScore } from './client';
import type {
  EvalResult,
  MiddlewareConfig,
} from './types';
import { RAILBlockedError } from './errors';

/**
 * Middleware that wraps async functions with RAIL score evaluation.
 *
 * @example
 * ```typescript
 * const middleware = new RAILMiddleware(client, {
 *   inputThresholds: { safety: 7.0 },
 *   outputThresholds: { safety: 7.0, fairness: 6.0 },
 *   onOutputEval: (result) => {
 *     console.log('Output score:', result.rail_score.score);
 *   },
 * });
 *
 * const safeLLMCall = middleware.wrap(async (input: string) => {
 *   return await callLLM(input);
 * });
 *
 * const output = await safeLLMCall('User prompt');
 * ```
 */
export class RAILMiddleware {
  private client: RailScore;
  private config: MiddlewareConfig;

  constructor(client: RailScore, config: MiddlewareConfig) {
    this.client = client;
    this.config = config;
  }

  wrap(fn: (input: string) => Promise<string>): (input: string) => Promise<string> {
    return async (input: string): Promise<string> => {
      // Pre-hook: called before any evaluation or execution
      if (this.config.preHook) {
        await this.config.preHook(input);
      }

      // Pre-call: evaluate input
      if (this.config.inputThresholds) {
        const inputEval = await this.client.eval({ content: input });

        if (this.config.onInputEval) {
          this.config.onInputEval(inputEval);
        }

        this.checkThresholds(inputEval, this.config.inputThresholds, 'input');
      }

      // Execute the wrapped function
      const output = await fn(input);

      // Post-call: evaluate output
      if (this.config.outputThresholds) {
        let outputEval = await this.client.eval({ content: output });

        // Upgrade to deep mode if output confidence is low
        if (this.config.upgradeOnLowConfidence) {
          const confidenceThreshold = this.config.lowConfidenceThreshold ?? 0.6;
          if (outputEval.rail_score.confidence < confidenceThreshold) {
            outputEval = await this.client.eval({ content: output, mode: 'deep' });
          }
        }

        if (this.config.onOutputEval) {
          this.config.onOutputEval(outputEval);
        }

        // Post-hook: called after output eval
        if (this.config.postHook) {
          await this.config.postHook(output, outputEval);
        }

        // Apply policy if configured
        if (this.config.policy) {
          const failedDims = this.getFailedDimensions(outputEval, this.config.outputThresholds);

          if (failedDims.length > 0) {
            const policyMode = this.config.policy.mode;

            if (policyMode === 'BLOCK') {
              throw new RAILBlockedError(
                `Output blocked: dimensions [${failedDims.join(', ')}] below threshold`,
                policyMode,
                outputEval.dimension_scores
              );
            }

            if (policyMode === 'REGENERATE') {
              const maxThreshold = Math.max(...Object.values(this.config.outputThresholds));
              const regenResult = await this.client.safeRegenerate({
                content: output,
                maxRegenerations: 1,
                thresholds: { overall: { score: maxThreshold } },
              });
              return regenResult.best_content || output;
            }

            if (policyMode === 'CUSTOM' && this.config.policy.customCallback) {
              const customResult = await this.config.policy.customCallback(output, outputEval);
              if (customResult !== null) {
                return customResult;
              }
            }
          }
        } else {
          this.checkThresholds(outputEval, this.config.outputThresholds, 'output');
        }
      return output;
    };
  }

  private checkThresholds(
    evaluation: EvalResult,
    thresholds: Record<string, number>,
    stage: string
  ): void {
    const failed = this.getFailedDimensions(evaluation, thresholds);
    if (failed.length > 0) {
      throw new RAILBlockedError(
        `${stage} blocked: dimensions [${failed.join(', ')}] below threshold`,
        'BLOCK',
        evaluation.dimension_scores
      );
    }
  }

  private getFailedDimensions(
    evaluation: EvalResult,
    thresholds: Record<string, number>
  ): string[] {
    const failed: string[] = [];
    for (const [dim, threshold] of Object.entries(thresholds)) {
      const score = evaluation.dimension_scores[dim];
      if (score && score.score < threshold) {
        failed.push(dim);
      }
    }
    return failed;
  }
}
