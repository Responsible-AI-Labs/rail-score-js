import type { RailScore } from '../client';
import { ValidationError } from '../errors';
import type {
  AgentContext,
  AgentDomain,
  AgentThresholds,
  AgentDecision,
  ComplianceViolation,
  ContextSignals,
  PolicyInfo,
  EvaluateToolCallParams,
  EvaluateToolResultParams,
  ToolResultEvaluation,
  PiiEntity,
  CheckInjectionParams,
  InjectionCheckResult,
  EvaluatePlanParams,
  PlanEvaluation,
  PlanStepResult,
  ListToolsParams,
  ListToolsResponse,
  RegisterToolParams,
  DeleteToolResponse,
  ToolRiskProfile,
} from './types';
import type { EvaluationMode, ComplianceFramework } from '../types';

const MAX_PLAN_STEPS = 20;

// ─── Camel↔Snake conversion helpers ─────────────────────────────────────────

function toSnakeAgentContext(ctx: AgentContext): Record<string, any> {
  const out: Record<string, any> = {};
  if (ctx.goal !== undefined) out.goal = ctx.goal;
  if (ctx.agentId !== undefined) out.agent_id = ctx.agentId;
  if (ctx.stepIndex !== undefined) out.step_index = ctx.stepIndex;
  if (ctx.rationale !== undefined) out.rationale = ctx.rationale;
  if (ctx.priorToolCalls !== undefined) out.prior_tool_calls = ctx.priorToolCalls;
  if (ctx.turnIndex !== undefined) out.turn_index = ctx.turnIndex;
  return out;
}

function toSnakeThresholds(t: AgentThresholds): Record<string, any> {
  const out: Record<string, any> = {};
  if (t.blockBelow !== undefined) out.block_below = t.blockBelow;
  if (t.flagBelow !== undefined) out.flag_below = t.flagBelow;
  if (t.dimensionMinimums !== undefined) out.dimension_minimums = t.dimensionMinimums;
  return out;
}

function camelContextSignals(raw: any): ContextSignals {
  return {
    toolRiskLevel: raw.tool_risk_level ?? '',
    proxyVariablesDetected: raw.proxy_variables_detected ?? [],
    piiFieldsDetected: raw.pii_fields_detected ?? [],
    highStakesDomain: raw.high_stakes_domain ?? false,
  };
}

function camelComplianceViolation(raw: any): ComplianceViolation {
  return {
    framework: raw.framework ?? '',
    article: raw.article ?? '',
    title: raw.title ?? '',
    severity: raw.severity ?? '',
    description: raw.description ?? '',
    remediation: raw.remediation ?? '',
  };
}

function camelPolicyInfo(raw: any): PolicyInfo | null {
  if (!raw) return null;
  return {
    appliedRule: raw.applied_rule ?? '',
    thresholdUsed: {
      blockBelow: raw.threshold_used?.block_below,
      flagBelow: raw.threshold_used?.flag_below,
    },
    violatedDimensions: raw.violated_dimensions ?? [],
    source: raw.source ?? 'system_default',
  };
}

function camelAgentDecision(raw: any): AgentDecision {
  return {
    decision: raw.decision,
    decisionReason: raw.decision_reason ?? '',
    eventId: raw.event_id ?? '',
    railScore: {
      score: raw.rail_score?.score ?? 0,
      confidence: raw.rail_score?.confidence ?? 0,
      summary: raw.rail_score?.summary ?? '',
    },
    dimensionScores: raw.dimension_scores ?? {},
    complianceViolations: (raw.compliance_violations ?? []).map(camelComplianceViolation),
    policy: camelPolicyInfo(raw.policy),
    contextSignals: camelContextSignals(raw.context_signals ?? {}),
    suggestedParams: raw.suggested_params ?? null,
    creditsConsumed: raw.credits_consumed ?? 0,
    evaluationDepth: raw.evaluation_depth ?? '',
    evaluatedAt: raw.evaluated_at ?? '',
  };
}

function camelToolResultEvaluation(raw: any): ToolResultEvaluation {
  const piiRaw = raw.pii_detected ?? {};
  const injRaw = raw.prompt_injection ?? {};
  return {
    eventId: raw.event_id ?? '',
    riskLevel: raw.risk_level ?? 'low',
    recommendedAction: raw.recommended_action ?? 'PASS',
    piiDetected: {
      found: piiRaw.found ?? false,
      entities: (piiRaw.entities ?? []).map((e: any): PiiEntity => ({
        type: e.type ?? '',
        value: e.value ?? '',
        offset: e.offset ?? 0,
        shouldRedact: e.should_redact ?? false,
      })),
      redactedResult: piiRaw.redacted_result ?? null,
      complianceFlags: piiRaw.compliance_flags ?? [],
    },
    promptInjection: {
      detected: injRaw.detected ?? false,
      confidence: injRaw.confidence ?? 0,
      patternsChecked: injRaw.patterns_checked ?? [],
    },
    railScore: raw.rail_score ? { score: raw.rail_score.score, confidence: raw.rail_score.confidence } : null,
    contextSignals: camelContextSignals(raw.context_signals ?? {}),
    redactedAvailable: raw.redacted_available ?? false,
    creditsConsumed: raw.credits_consumed ?? 0,
    evaluatedAt: raw.evaluated_at ?? '',
  };
}

function camelInjectionResult(raw: any): InjectionCheckResult {
  return {
    eventId: raw.event_id ?? '',
    injectionDetected: raw.injection_detected ?? false,
    confidence: raw.confidence ?? 0,
    attackType: raw.attack_type ?? 'none',
    severity: raw.severity ?? 'none',
    payloadPreview: raw.payload_preview ?? null,
    recommendedAction: raw.recommended_action ?? 'PASS',
    creditsConsumed: raw.credits_consumed ?? 0,
    evaluatedAt: raw.evaluated_at ?? '',
  };
}

function camelPlanStepResult(raw: any): PlanStepResult {
  return {
    stepIndex: raw.step_index ?? 0,
    toolName: raw.tool_name ?? '',
    decision: raw.decision,
    railScore: raw.rail_score ?? 0,
    dimensionScores: raw.dimension_scores ?? {},
    complianceViolations: (raw.compliance_violations ?? []).map(camelComplianceViolation),
    suggestedParams: raw.suggested_params ?? null,
    contextSignals: camelContextSignals(raw.context_signals ?? {}),
  };
}

function camelToolRiskProfile(raw: any): ToolRiskProfile {
  return {
    toolName: raw.tool_name ?? '',
    riskLevel: raw.risk_level ?? 'low',
    evaluationDepth: raw.evaluation_depth,
    source: raw.source ?? 'system',
    thresholds: raw.thresholds ? {
      blockBelow: raw.thresholds.block_below,
      flagBelow: raw.thresholds.flag_below,
      dimensionMinimums: raw.thresholds.dimension_minimums,
    } : undefined,
    complianceFrameworks: raw.compliance_frameworks,
    proxyVariableWatch: raw.proxy_variable_watch,
    piiFieldsWatch: raw.pii_fields_watch,
    description: raw.description,
  };
}

// ─── ToolRegistryNamespace ───────────────────────────────────────────────────

class ToolRegistryNamespace {
  constructor(private readonly client: RailScore) {}

  /**
   * List registered tools in the tool risk registry.
   *
   * GET /railscore/v1/agent/registry/tools
   */
  async listTools(params: ListToolsParams = {}): Promise<ListToolsResponse> {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    if (params.source) qs.set('source', params.source);
    if (params.riskLevel) qs.set('risk_level', params.riskLevel);
    if (params.search) qs.set('search', params.search);

    const query = qs.toString();
    const endpoint = `/railscore/v1/agent/registry/tools${query ? `?${query}` : ''}`;
    const raw = await this.client.request<any>(endpoint, { method: 'GET' });

    return {
      tools: (raw.tools ?? []).map(camelToolRiskProfile),
      pagination: {
        total: raw.pagination?.total ?? 0,
        limit: raw.pagination?.limit ?? 50,
        offset: raw.pagination?.offset ?? 0,
        hasMore: raw.pagination?.has_more ?? false,
      },
    };
  }

  /**
   * Register a custom tool risk profile.
   *
   * POST /railscore/v1/agent/registry/tools
   */
  async registerTool(params: RegisterToolParams): Promise<ToolRiskProfile> {
    if (!params.toolName) {
      throw new ValidationError('toolName is required');
    }

    const body: Record<string, any> = {
      tool_name: params.toolName,
      risk_level: params.riskLevel,
    };
    if (params.evaluationDepth) body.evaluation_depth = params.evaluationDepth;
    if (params.thresholds) body.thresholds = toSnakeThresholds(params.thresholds);
    if (params.complianceFrameworks) body.compliance_frameworks = params.complianceFrameworks;
    if (params.proxyVariableWatch) body.proxy_variable_watch = params.proxyVariableWatch;
    if (params.piiFieldsWatch) body.pii_fields_watch = params.piiFieldsWatch;
    if (params.description) body.description = params.description;

    const raw = await this.client.request<any>('/railscore/v1/agent/registry/tools', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return camelToolRiskProfile(raw);
  }

  /**
   * Delete a custom tool risk profile.
   *
   * DELETE /railscore/v1/agent/registry/tools/{tool_name}
   */
  async deleteTool(toolName: string): Promise<DeleteToolResponse> {
    if (!toolName) {
      throw new ValidationError('toolName is required');
    }

    const raw = await this.client.request<any>(
      `/railscore/v1/agent/registry/tools/${encodeURIComponent(toolName)}`,
      { method: 'DELETE' }
    );

    return {
      toolName: raw.tool_name ?? toolName,
      deleted: raw.deleted ?? true,
      fallback: raw.fallback ?? 'generic',
    };
  }
}

// ─── AgentNamespace ──────────────────────────────────────────────────────────

/**
 * Agent evaluation namespace attached to the main RailScore client as `client.agent`.
 *
 * Provides four evaluation methods plus a tool risk registry:
 *
 * - `evaluateToolCall()` — risk-assess a tool call before it executes
 * - `evaluateToolResult()` — scan a tool's output after it returns
 * - `checkInjection()` — standalone prompt injection classifier
 * - `evaluatePlan()` — pre-flight evaluation of all steps in an agent plan
 * - `registry.*` — manage custom tool risk profiles
 *
 * @example
 * ```typescript
 * const decision = await client.agent.evaluateToolCall({
 *   toolName: 'credit_scoring_api',
 *   toolParams: { zipCode: '90210', loanAmount: 50000 },
 *   domain: 'finance',
 *   complianceFrameworks: ['eu_ai_act', 'gdpr'],
 * });
 * if (decision.decision === 'BLOCK') {
 *   // handle block
 * }
 * ```
 */
export class AgentNamespace {
  /** Tool risk registry management */
  readonly registry: ToolRegistryNamespace;

  constructor(private readonly client: RailScore) {
    this.registry = new ToolRegistryNamespace(client);
  }

  /**
   * Risk-assess a tool call **before** it executes.
   *
   * POST /railscore/v1/agent/tool-call
   *
   * The API returns HTTP 403 for BLOCK decisions. This method parses the 403 body
   * and returns it as a normal `AgentDecision` with `decision === "BLOCK"` rather
   * than throwing an AuthenticationError.
   *
   * @example
   * ```typescript
   * const decision = await client.agent.evaluateToolCall({
   *   toolName: 'send_email',
   *   toolParams: { to: 'user@example.com', body: '...' },
   *   domain: 'general',
   * });
   * if (decision.decision === 'ALLOW') {
   *   await sendEmail(decision.toolParams);
   * }
   * ```
   */
  async evaluateToolCall(params: EvaluateToolCallParams): Promise<AgentDecision> {
    if (!params.toolName) {
      throw new ValidationError('toolName is required');
    }
    if (!params.toolParams || typeof params.toolParams !== 'object') {
      throw new ValidationError('toolParams must be an object');
    }

    const body: Record<string, any> = {
      tool_name: params.toolName,
      tool_params: params.toolParams,
    };
    if (params.domain) body.domain = params.domain;
    if (params.mode) body.mode = params.mode;
    if (params.agentContext) body.agent_context = toSnakeAgentContext(params.agentContext);
    if (params.complianceFrameworks) body.compliance_frameworks = params.complianceFrameworks;
    if (params.customThresholds) body.custom_thresholds = toSnakeThresholds(params.customThresholds);

    // The API returns HTTP 403 for BLOCK decisions — handled in the client's
    // requestAgentToolCall() path which intercepts 403 from this endpoint.
    const raw = await this.client.requestAgentToolCall('/railscore/v1/agent/tool-call', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return camelAgentDecision(raw);
  }

  /**
   * Scan a tool's output **after** it returns.
   *
   * POST /railscore/v1/agent/tool-result
   *
   * Checks for PII exposure, embedded prompt injection, and overall RAIL risk.
   *
   * @example
   * ```typescript
   * const result = await client.agent.evaluateToolResult({
   *   toolName: 'database_query',
   *   toolResult: { data: rows, format: 'json' },
   *   checks: ['pii', 'prompt_injection'],
   * });
   * if (result.recommendedAction === 'REDACT_AND_FLAG') {
   *   // use result.piiDetected.redactedResult instead of raw rows
   * }
   * ```
   */
  async evaluateToolResult(params: EvaluateToolResultParams): Promise<ToolResultEvaluation> {
    if (!params.toolName) {
      throw new ValidationError('toolName is required');
    }
    if (!params.toolResult || (!('raw' in params.toolResult) && !('data' in params.toolResult))) {
      throw new ValidationError('toolResult must include at least one of: raw, data');
    }

    const body: Record<string, any> = {
      tool_name: params.toolName,
      tool_result: params.toolResult,
    };
    if (params.toolParams) body.tool_params = params.toolParams;
    if (params.checks) body.checks = params.checks;
    if (params.agentContext) body.agent_context = toSnakeAgentContext(params.agentContext);

    const raw = await this.client.request<any>('/railscore/v1/agent/tool-result', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return camelToolResultEvaluation(raw);
  }

  /**
   * Standalone prompt injection classifier.
   *
   * POST /railscore/v1/agent/prompt-injection
   *
   * Fast, 0.5-credit check. Use for user input, web search results, or any
   * external string before passing it into an agent's context.
   *
   * @example
   * ```typescript
   * const check = await client.agent.checkInjection({
   *   content: userInput,
   *   contentSource: 'user_input',
   * });
   * if (check.injectionDetected) {
   *   // block or sanitise the input
   * }
   * ```
   */
  async checkInjection(params: CheckInjectionParams): Promise<InjectionCheckResult> {
    if (!params.content || params.content.trim().length === 0) {
      throw new ValidationError('content is required');
    }

    const body: Record<string, any> = { content: params.content };
    if (params.contentSource) body.content_source = params.contentSource;
    if (params.agentContext) body.agent_context = toSnakeAgentContext(params.agentContext);

    const raw = await this.client.request<any>('/railscore/v1/agent/prompt-injection', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return camelInjectionResult(raw);
  }

  /**
   * Pre-flight evaluation of all steps in an agent plan.
   *
   * This is a **client-side loop** — it calls POST /railscore/v1/agent/tool-call
   * once per step with `X-RAIL-Plan-Batch: true`, then computes the overall
   * verdict locally.
   *
   * Maximum 20 steps per plan. A ValidationError is raised client-side if
   * exceeded without calling the API.
   *
   * @example
   * ```typescript
   * const evaluation = await client.agent.evaluatePlan({
   *   plan: [
   *     { stepIndex: 0, toolName: 'web_search', toolParams: { query: 'rates' } },
   *     { stepIndex: 1, toolName: 'send_email', toolParams: { to: 'user@example.com' } },
   *   ],
   *   goal: 'Send daily rate summary',
   *   domain: 'finance',
   * });
   * if (evaluation.overallDecision === 'ALLOW_ALL') {
   *   // proceed with plan
   * }
   * ```
   */
  async evaluatePlan(params: EvaluatePlanParams): Promise<PlanEvaluation> {
    if (!params.plan || params.plan.length === 0) {
      throw new ValidationError('plan must contain at least one step');
    }
    if (params.plan.length > MAX_PLAN_STEPS) {
      throw new ValidationError(`Plan exceeds maximum of ${MAX_PLAN_STEPS} steps`);
    }

    const startedAt = new Date();
    const stepResults: PlanStepResult[] = [];
    let totalCredits = 0;

    for (const step of params.plan) {
      const body: Record<string, any> = {
        tool_name: step.toolName,
        tool_params: step.toolParams,
        agent_context: {
          ...(params.goal && { goal: params.goal }),
          ...(params.agentId && { agent_id: params.agentId }),
          step_index: step.stepIndex,
          ...(step.rationale && { rationale: step.rationale }),
        },
      };
      if (params.domain) body.domain = params.domain;
      if (params.mode) body.mode = params.mode;
      if (params.complianceFrameworks) body.compliance_frameworks = params.complianceFrameworks;

      const raw = await this.client.requestAgentToolCall<any>('/railscore/v1/agent/tool-call', {
        method: 'POST',
        headers: { 'X-RAIL-Plan-Batch': 'true' },
        body: JSON.stringify(body),
      });

      totalCredits += raw.credits_consumed ?? 0;

      stepResults.push({
        stepIndex: step.stepIndex,
        toolName: step.toolName,
        decision: raw.decision,
        railScore: raw.rail_score?.score ?? 0,
        dimensionScores: raw.dimension_scores ?? {},
        complianceViolations: (raw.compliance_violations ?? []).map(camelComplianceViolation),
        suggestedParams: raw.suggested_params ?? null,
        contextSignals: camelContextSignals(raw.context_signals ?? {}),
      });
    }

    // Compute overall verdict client-side
    const decisions = stepResults.map((s) => s.decision);
    const allBlocked = decisions.every((d) => d === 'BLOCK');
    const anyBlocked = decisions.some((d) => d === 'BLOCK');

    let overallDecision: 'ALLOW_ALL' | 'PARTIAL_BLOCK' | 'BLOCK_ALL';
    if (allBlocked) {
      overallDecision = 'BLOCK_ALL';
    } else if (anyBlocked) {
      overallDecision = 'PARTIAL_BLOCK';
    } else {
      overallDecision = 'ALLOW_ALL';
    }

    const avgScore =
      stepResults.reduce((sum, s) => sum + s.railScore, 0) / stepResults.length;

    let overallRisk: 'low' | 'medium' | 'high' | 'critical';
    if (avgScore >= 7.0) overallRisk = 'low';
    else if (avgScore >= 5.0) overallRisk = 'medium';
    else if (avgScore >= 3.0) overallRisk = 'high';
    else overallRisk = 'critical';

    const blockedIndices = stepResults
      .filter((s) => s.decision === 'BLOCK')
      .map((s) => s.stepIndex);

    let planSummary: string;
    if (overallDecision === 'ALLOW_ALL') {
      planSummary = `All ${stepResults.length} steps can proceed.`;
    } else if (overallDecision === 'BLOCK_ALL') {
      planSummary = `All ${stepResults.length} steps are blocked.`;
    } else {
      const blocked = blockedIndices.length;
      const allowed = stepResults.length - blocked;
      planSummary = `${allowed} of ${stepResults.length} steps can proceed. Blocked steps: [${blockedIndices.join(', ')}].`;
    }

    return {
      overallDecision,
      overallRisk,
      planSummary,
      stepResults,
      creditsConsumed: totalCredits,
      evaluatedAt: startedAt.toISOString(),
    };
  }
}
