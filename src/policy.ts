import type { RailScore } from './client';
import type {
  EvaluationResult,
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
 * - REGENERATE: Attempt to regenerate content that fails thresholds
 * - CUSTOM: Use a custom async callback for enforcement logic
 *
 * @example
 * ```typescript
 * const policy = new PolicyEngine(client, {
 *   mode: 'BLOCK',
 *   thresholds: { safety: 7.0, privacy: 6.0 }
 * });
 *
 * try {
 *   const result = await policy.enforce('Content to check');
 *   console.log('Content passed:', result.railScore.score);
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
  private customCallback?: (content: string, result: EvaluationResult) => Promise<string | null>;

  /**
   * Create a new policy engine
   *
   * @param client - RailScore client instance
   * @param config - Policy configuration
   */
  constructor(client: RailScore, config: PolicyConfig) {
    this.client = client;
    this.mode = config.mode;
    this.thresholds = { ...config.thresholds };
    this.customCallback = config.customCallback;
  }

  /**
   * Enforce policy on content
   *
   * Evaluates the content and applies the configured policy mode.
   *
   * @param content - The content to evaluate and enforce policy on
   * @returns Policy enforcement result containing evaluation and optionally regenerated content
   * @throws {RAILBlockedError} In BLOCK mode when content fails thresholds
   *
   * @example
   * ```typescript
   * const result = await policy.enforce('Check this content');
   * console.log(`Score: ${result.evaluation.railScore.score}`);
   * if (result.regeneratedContent) {
   *   console.log('Content was regenerated:', result.regeneratedContent);
   * }
   * ```
   */
  async enforce(content: string): Promise<{
    evaluation: EvaluationResult;
    passed: boolean;
    failedDimensions: string[];
    regeneratedContent?: string;
  }> {
    const evaluation = await this.client.evaluation.basic(content);
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
            evaluation.scores
          );
        }
        return { evaluation, passed, failedDimensions };

      case 'REGENERATE':
        if (!passed) {
          const issues = failedDimensions.map(dim => {
            const score = evaluation.scores[dim];
            return score?.explanation || `${dim} score below threshold`;
          });

          const regenerated = await this.client.evaluation.protectedRegenerate(
            content,
            issues
          );

          return {
            evaluation,
            passed: false,
            failedDimensions,
            regeneratedContent: regenerated.content,
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

  /**
   * Update the policy enforcement mode
   *
   * @param mode - New policy mode
   */
  setMode(mode: PolicyMode): void {
    this.mode = mode;
  }

  /**
   * Update score thresholds
   *
   * @param thresholds - New threshold values per dimension
   */
  setThresholds(thresholds: Record<string, number>): void {
    this.thresholds = { ...thresholds };
  }

  /**
   * Set a custom callback for CUSTOM mode
   *
   * @param callback - Async function receiving content and evaluation, returns new content or null
   */
  setCustomCallback(
    callback: (content: string, result: EvaluationResult) => Promise<string | null>
  ): void {
    this.customCallback = callback;
  }

  /**
   * Check which dimensions fail the configured thresholds
   * @internal
   */
  private getFailedDimensions(evaluation: EvaluationResult): string[] {
    const failed: string[] = [];
    for (const [dim, threshold] of Object.entries(this.thresholds)) {
      const score = evaluation.scores[dim];
      if (score && score.score < threshold) {
        failed.push(dim);
      }
    }
    return failed;
  }
}
