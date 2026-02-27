import type { RailScore } from './client';
import type {
  EvaluationResult,
  MiddlewareConfig,
} from './types';
import { RAILBlockedError } from './errors';

/**
 * Middleware that wraps async functions with RAIL score evaluation.
 *
 * Evaluates input before calling the wrapped function and output after,
 * applying thresholds and invoking callbacks at each stage.
 *
 * @example
 * ```typescript
 * const middleware = new RAILMiddleware(client, {
 *   inputThresholds: { safety: 7.0 },
 *   outputThresholds: { safety: 7.0, fairness: 6.0 },
 *   onOutputEval: (result) => {
 *     console.log('Output score:', result.railScore.score);
 *   }
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

  /**
   * Create a new middleware instance
   *
   * @param client - RailScore client instance
   * @param config - Middleware configuration with thresholds and callbacks
   */
  constructor(client: RailScore, config: MiddlewareConfig) {
    this.client = client;
    this.config = config;
  }

  /**
   * Wrap an async function with RAIL score evaluation
   *
   * The returned function will:
   * 1. Evaluate the input against inputThresholds (if configured)
   * 2. Call the onInputEval hook (if configured)
   * 3. Execute the wrapped function
   * 4. Evaluate the output against outputThresholds (if configured)
   * 5. Call the onOutputEval hook (if configured)
   * 6. Apply policy enforcement on output (if configured)
   *
   * @param fn - Async function to wrap (takes string input, returns string output)
   * @returns Wrapped function with RAIL evaluation
   *
   * @example
   * ```typescript
   * const wrapped = middleware.wrap(myAsyncFn);
   * const result = await wrapped('input text');
   * ```
   */
  wrap(fn: (input: string) => Promise<string>): (input: string) => Promise<string> {
    return async (input: string): Promise<string> => {
      // Pre-call: evaluate input
      if (this.config.inputThresholds) {
        const inputEval = await this.client.evaluation.basic(input);

        if (this.config.onInputEval) {
          this.config.onInputEval(inputEval);
        }

        this.checkThresholds(inputEval, this.config.inputThresholds, 'input');
      }

      // Execute the wrapped function
      const output = await fn(input);

      // Post-call: evaluate output
      if (this.config.outputThresholds) {
        const outputEval = await this.client.evaluation.basic(output);

        if (this.config.onOutputEval) {
          this.config.onOutputEval(outputEval);
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
                outputEval.scores
              );
            }

            if (policyMode === 'REGENERATE') {
              const issues = failedDims.map(dim => {
                const score = outputEval.scores[dim];
                return score?.explanation || `${dim} score below threshold`;
              });

              const regenerated = await this.client.evaluation.protectedRegenerate(output, issues);
              return regenerated.content;
            }

            if (policyMode === 'CUSTOM' && this.config.policy.customCallback) {
              const customResult = await this.config.policy.customCallback(output, outputEval);
              if (customResult !== null) {
                return customResult;
              }
            }
          }
        } else {
          // No policy — just check thresholds
          this.checkThresholds(outputEval, this.config.outputThresholds, 'output');
        }
      }

      return output;
    };
  }

  /**
   * Check thresholds and throw if any dimension fails
   * @internal
   */
  private checkThresholds(
    evaluation: EvaluationResult,
    thresholds: Record<string, number>,
    stage: string
  ): void {
    const failed = this.getFailedDimensions(evaluation, thresholds);
    if (failed.length > 0) {
      throw new RAILBlockedError(
        `${stage} blocked: dimensions [${failed.join(', ')}] below threshold`,
        'BLOCK',
        evaluation.scores
      );
    }
  }

  /**
   * Get dimensions that fail the given thresholds
   * @internal
   */
  private getFailedDimensions(
    evaluation: EvaluationResult,
    thresholds: Record<string, number>
  ): string[] {
    const failed: string[] = [];
    for (const [dim, threshold] of Object.entries(thresholds)) {
      const score = evaluation.scores[dim];
      if (score && score.score < threshold) {
        failed.push(dim);
      }
    }
    return failed;
  }
}
