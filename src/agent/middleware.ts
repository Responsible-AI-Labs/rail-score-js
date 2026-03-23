import { AgentBlockedError } from '../errors';
import type { AgentNamespace } from './client';
import type { AgentDecision, AgentDomain, AgentThresholds, PolicyCheckResult } from './types';
import { AgentPolicyEngine } from './policy';
import type { ComplianceFramework, EvaluationMode } from '../types';

type AgentPolicyModeStr = 'block' | 'suggest_fix' | 'log_only' | 'auto_fix';

/**
 * Higher-order function wrapper that adds automatic pre-call evaluation
 * (and optional post-call result scanning) to any function that calls an external tool.
 *
 * @example
 * ```typescript
 * const middleware = new AgentMiddleware(client.agent, {
 *   policy: 'block',
 *   defaultDomain: 'finance',
 *   complianceFrameworks: ['eu_ai_act'],
 * });
 *
 * const guardedCreditApi = middleware.guard('credit_scoring_api', callCreditApi);
 * try {
 *   const result = await guardedCreditApi({ applicantId: 'u-1234', zipCode: '90210' });
 * } catch (e) {
 *   if (e instanceof AgentBlockedError && e.suggestedParams) {
 *     const result = await guardedCreditApi(e.suggestedParams);
 *   }
 * }
 * ```
 */
export class AgentMiddleware {
  private readonly agentNamespace: AgentNamespace;
  private readonly policy: AgentPolicyModeStr;
  private readonly defaultDomain: AgentDomain;
  private readonly complianceFrameworks: ComplianceFramework[] | null;
  private readonly defaultThresholds: AgentThresholds | null;

  constructor(
    agentNamespace: AgentNamespace,
    options: {
      policy?: AgentPolicyModeStr;
      defaultDomain?: AgentDomain;
      complianceFrameworks?: ComplianceFramework[];
      defaultThresholds?: AgentThresholds;
    } = {}
  ) {
    this.agentNamespace = agentNamespace;
    this.policy = options.policy ?? 'log_only';
    this.defaultDomain = options.defaultDomain ?? 'general';
    this.complianceFrameworks = options.complianceFrameworks ?? null;
    this.defaultThresholds = options.defaultThresholds ?? null;
  }

  /**
   * Wrap a tool function with automatic pre-call evaluation and optional post-call scanning.
   *
   * In Node.js, this is a higher-order function rather than a Python decorator.
   * The wrapped function receives the same arguments as the original.
   *
   * @param toolName - Name used for evaluation
   * @param fn - Async function to wrap
   * @param options - Per-call overrides
   *
   * @example
   * ```typescript
   * const guarded = middleware.guard('send_email', callSendEmail, {
   *   domain: 'general',
   *   checkResult: true,
   *   resultChecks: ['pii', 'prompt_injection'],
   * });
   * const result = await guarded({ to: 'user@example.com', body: '...' });
   * ```
   */
  guard<TParams extends Record<string, any>, TReturn>(
    toolName: string,
    fn: (params: TParams) => Promise<TReturn>,
    options: {
      domain?: AgentDomain;
      complianceFrameworks?: ComplianceFramework[];
      customThresholds?: AgentThresholds;
      mode?: EvaluationMode;
      checkResult?: boolean;
      resultChecks?: ('pii' | 'prompt_injection' | 'rail_score')[];
    } = {}
  ): (params: TParams) => Promise<TReturn> {
    const effectiveDomain = options.domain ?? this.defaultDomain;
    const effectiveFrameworks =
      options.complianceFrameworks ?? this.complianceFrameworks ?? undefined;
    const effectiveThresholds = options.customThresholds ?? this.defaultThresholds ?? undefined;

    const policyEngine = new AgentPolicyEngine({
      mode: this.policy,
      defaultThresholds: effectiveThresholds
        ? {
            blockBelow: effectiveThresholds.blockBelow,
            flagBelow: effectiveThresholds.flagBelow,
            dimensionMinimums: effectiveThresholds.dimensionMinimums,
          }
        : undefined,
    });

    const agentNamespace = this.agentNamespace;
    const checkResult = options.checkResult ?? false;
    const resultChecks = options.resultChecks ?? undefined;

    return async (params: TParams): Promise<TReturn> => {
      // Pre-call evaluation
      const decision = await agentNamespace.evaluateToolCall({
        toolName,
        toolParams: params as Record<string, any>,
        domain: effectiveDomain,
        mode: options.mode,
        complianceFrameworks: effectiveFrameworks,
        customThresholds: effectiveThresholds,
      });

      // Apply policy — may throw AgentBlockedError in 'block' mode
      const policyResult = policyEngine.check(decision, toolName);

      // In auto_fix mode with suggestedParams, swap in suggested params
      let effectiveParams = params;
      if (
        (this.policy === 'auto_fix' || this.policy === 'suggest_fix') &&
        policyResult.blocked &&
        decision.suggestedParams
      ) {
        effectiveParams = decision.suggestedParams as TParams;
      }

      // Execute the tool function
      const result = await fn(effectiveParams);

      // Post-call result scanning (optional)
      if (checkResult && result !== null && result !== undefined) {
        const rawResult = typeof result === 'string'
          ? { raw: result, format: 'text' as const }
          : { data: result, format: 'json' as const };

        await agentNamespace.evaluateToolResult({
          toolName,
          toolResult: rawResult,
          toolParams: params as Record<string, any>,
          checks: resultChecks,
        });
      }

      return result;
    };
  }
}
