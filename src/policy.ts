import type { RailScore } from './client';
import type {
  EvalResult,
  PolicyConfig,
  PolicyMode,
} from './types';
import { RAILBlockedError } from './errors';

/**
 * Policy engine for enforcing RAIL score thresholds on content.
 *
 * Supports four enforcement modes:
 * - LOG_ONLY: Evaluate and return result (no blocking)
 * - BLOCK: Throw RAILBlockedError if any dimension falls below threshold
 * - REGENERATE: Attempt to regenerate content via safe-regenerate
 * - CUSTOM: Use a custom async callback for enforcement logic
 *
 * @example
 * ```typescript
 * const policy = new PolicyEngine(client, {
 *   mode: 'BLOCK',
 *   thresholds: { safety: 7.0, privacy: 6.0 },
 * });
 *
 * try {
 *   const result = await policy.enforce('Content to check');
 *   console.log('Content passed:', result.evaluation.rail_score.score);
 * } catch (error) {
 *   if (error instanceof RAILBlockedError) {
 *     console.error('Content blocked by policy');
 *   }
 * }
 * ```
 */
export class PolicyEngine {
  private client: RailScore;
  private mode: PolicyMode;
  private thresholds: Record<string, number>;
  private customCallback?: (content: string, result: EvalResult) => Promise<string | null>;

  constructor(client: RailScore, config: PolicyConfig) {
    this.client = client;
    this.mode = config.mode;
    this.thresholds = { ...config.thresholds };
    this.customCallback = config.customCallback;
  }

  async enforce(content: string): Promise<{
    evaluation: EvalResult;
    passed: boolean;
    failedDimensions: string[];
    regeneratedContent?: string;
  }> {
    const evaluation = await this.client.eval({ content });
    const failedDimensions = this.getFailedDimensions(evaluation);
    const passed = failedDimensions.length === 0;

    switch (this.mode) {
      case 'LOG_ONLY':
        return { evaluation, passed, failedDimensions };

      case 'BLOCK':
        if (!passed) {
          throw new RAILBlockedError(
            `Content blocked: dimensions [${failedDimensions.join(', ')}] below threshold`,
            this.mode,
            evaluation.dimension_scores
          );
        }
        return { evaluation, passed, failedDimensions };

      case 'REGENERATE':
        if (!passed) {
          const maxThreshold = Math.max(...Object.values(this.thresholds));
          const regenResult = await this.client.safeRegenerate({
            content,
            maxRegenerations: 1,
            thresholds: { overall: { score: maxThreshold } },
          });
          return {
            evaluation,
            passed: false,
            failedDimensions,
            regeneratedContent: regenResult.best_content,
          };
        }
        return { evaluation, passed, failedDimensions };

      case 'CUSTOM':
        if (!passed && this.customCallback) {
          const customContent = await this.customCallback(content, evaluation);
          return {
            evaluation,
            passed: false,
            failedDimensions,
            regeneratedContent: customContent || undefined,
          };
        }
        return { evaluation, passed, failedDimensions };

      default:
        return { evaluation, passed, failedDimensions };
    }
  }

  setMode(mode: PolicyMode): void {
    this.mode = mode;
  }

  setThresholds(thresholds: Record<string, number>): void {
    this.thresholds = { ...thresholds };
  }

  setCustomCallback(
    callback: (content: string, result: EvalResult) => Promise<string | null>
  ): void {
    this.customCallback = callback;
  }

  private getFailedDimensions(evaluation: EvalResult): string[] {
    const failed: string[] = [];
    for (const [dim, threshold] of Object.entries(this.thresholds)) {
      const score = evaluation.dimension_scores[dim];
      if (score && score.score < threshold) {
        failed.push(dim);
      }
    }
    return failed;
  }
}
