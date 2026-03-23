import { AgentBlockedError } from '../errors';
import type {
  AgentDecision,
  AgentPolicyMode,
  AgentThresholds,
  PolicyCheckResult,
} from './types';

/**
 * Applies threshold rules locally on top of the engine's ALLOW/FLAG/BLOCK signal.
 *
 * Decision logic (per spec):
 * - `blocked` = engine returned BLOCK **or** score < blockBelow **or** a dimension is below its minimum
 * - `flagged` = not blocked **and** (engine returned FLAG **or** score < flagBelow)
 * - `allowed` = not blocked and not flagged
 *
 * @example
 * ```typescript
 * const policy = new AgentPolicyEngine({
 *   mode: 'block',
 *   defaultThresholds: { blockBelow: 3.0, flagBelow: 6.0 },
 *   perToolThresholds: {
 *     credit_scoring_api: { blockBelow: 8.0, flagBelow: 9.0 },
 *   },
 *   onBlock: (result) => console.warn('Blocked:', result.decisionReason),
 * });
 *
 * try {
 *   policy.check(decision);
 * } catch (e) {
 *   if (e instanceof AgentBlockedError) {
 *     console.log(e.railScore, e.violatedDimensions);
 *   }
 * }
 * ```
 */
export class AgentPolicyEngine {
  private readonly mode: AgentPolicyMode;
  private readonly defaultThresholds: AgentThresholds;
  private readonly perToolThresholds: Record<string, AgentThresholds>;
  private readonly onBlock?: (result: PolicyCheckResult) => void;
  private readonly onFlag?: (result: PolicyCheckResult) => void;
  private readonly onAllow?: (result: PolicyCheckResult) => void;

  constructor(options: {
    mode: AgentPolicyMode;
    defaultThresholds?: AgentThresholds;
    perToolThresholds?: Record<string, AgentThresholds>;
    onBlock?: (result: PolicyCheckResult) => void;
    onFlag?: (result: PolicyCheckResult) => void;
    onAllow?: (result: PolicyCheckResult) => void;
  }) {
    this.mode = options.mode;
    this.defaultThresholds = options.defaultThresholds ?? {};
    this.perToolThresholds = options.perToolThresholds ?? {};
    this.onBlock = options.onBlock;
    this.onFlag = options.onFlag;
    this.onAllow = options.onAllow;
  }

  /**
   * Evaluate an AgentDecision against the configured policy thresholds.
   *
   * - In `"block"` mode, throws `AgentBlockedError` when blocked.
   * - In `"suggest_fix"` / `"auto_fix"` mode, returns the result with `suggestedParams`.
   * - In `"log_only"` mode, invokes `onBlock` callback but does not throw.
   */
  check(result: AgentDecision, toolName?: string): PolicyCheckResult {
    const thresholds = this.resolveThresholds(toolName);
    const score = result.railScore.score;

    // Check local dimension minimums
    const violatedDimensions: string[] = [];
    if (thresholds.dimensionMinimums) {
      for (const [dim, min] of Object.entries(thresholds.dimensionMinimums) as [string, number][]) {
        const dimScore = result.dimensionScores[dim]?.score;
        if (dimScore !== undefined && dimScore < min) {
          violatedDimensions.push(dim);
        }
      }
    }

    const localBlock =
      (thresholds.blockBelow !== undefined && score < thresholds.blockBelow) ||
      violatedDimensions.length > 0;

    const localFlag =
      thresholds.flagBelow !== undefined && score < thresholds.flagBelow;

    const blocked = result.decision === 'BLOCK' || localBlock;
    const flagged = !blocked && (result.decision === 'FLAG' || localFlag);
    const allowed = !blocked && !flagged;

    let reason = '';
    if (blocked) {
      if (result.decision === 'BLOCK') {
        reason = result.decisionReason;
      } else if (violatedDimensions.length > 0) {
        reason = `Dimension minimum violated: [${violatedDimensions.join(', ')}]`;
      } else {
        reason = `Score ${score} is below block threshold ${thresholds.blockBelow}`;
      }
    } else if (flagged) {
      reason =
        result.decision === 'FLAG'
          ? result.decisionReason
          : `Score ${score} is below flag threshold ${thresholds.flagBelow}`;
    }

    const policyResult: PolicyCheckResult = {
      blocked,
      flagged,
      allowed,
      score,
      reason,
      suggestedParams: result.suggestedParams,
      violatedDimensions,
    };

    if (blocked) {
      this.onBlock?.(policyResult);

      if (this.mode === 'block') {
        throw new AgentBlockedError(
          reason,
          score,
          violatedDimensions,
          result.suggestedParams,
          result.complianceViolations,
          result.eventId
        );
      }
    } else if (flagged) {
      this.onFlag?.(policyResult);
    } else {
      this.onAllow?.(policyResult);
    }

    return policyResult;
  }

  private resolveThresholds(toolName?: string): AgentThresholds {
    if (toolName && this.perToolThresholds[toolName]) {
      return { ...this.defaultThresholds, ...this.perToolThresholds[toolName] };
    }
    return this.defaultThresholds;
  }
}
