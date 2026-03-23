import { randomBytes } from 'crypto';
import { SessionClosedError } from '../errors';
import type { AgentNamespace } from './client';
import type { AgentPolicyEngine } from './policy';
import type {
  AgentContext,
  AgentDomain,
  AgentSessionConfig,
  AgentThresholds,
  AgentDecision,
  ToolResultEvaluation,
  InjectionCheckResult,
  CheckInjectionParams,
  EvaluateToolCallParams,
  EvaluateToolResultParams,
  SessionRiskSummary,
  SessionPattern,
} from './types';
import type { ComplianceFramework, EvaluationMode } from '../types';

interface ToolCallRecord {
  decision: AgentDecision;
  toolName: string;
  timestamp: string;
}

interface ToolResultRecord {
  result: ToolResultEvaluation;
  toolName: string;
  timestamp: string;
}

interface InjectionRecord {
  result: InjectionCheckResult;
  timestamp: string;
}

type SessionEvent =
  | { kind: 'tool_call'; record: ToolCallRecord }
  | { kind: 'tool_result'; record: ToolResultRecord }
  | { kind: 'injection'; record: InjectionRecord };

/**
 * Stateful client-side session across multiple agent tool calls.
 *
 * Holds no server state — all tracking is local. The session ID is a
 * client-generated UUID used only in summaries and event logs.
 *
 * @example
 * ```typescript
 * const session = new AgentSession(client.agent, 'loan-agent-1', ['eu_ai_act']);
 * const decision = await session.evaluateToolCall({
 *   toolName: 'web_search',
 *   toolParams: { query: 'applicant history' },
 * });
 * const summary = session.riskSummary();
 * session.close();
 * ```
 */
export class AgentSession {
  readonly sessionId: string;
  readonly agentId: string;

  private readonly agentNamespace: AgentNamespace;
  private readonly complianceFrameworks: ComplianceFramework[] | null;
  private readonly config: Required<AgentSessionConfig>;
  readonly metadata: Record<string, any>;
  private readonly policyEngine: AgentPolicyEngine | null;

  private status: 'active' | 'closed' = 'active';
  private events: SessionEvent[] = [];
  private startedAt: Date;
  private closedAt: Date | null = null;
  private criticalViolationOccurred = false;

  constructor(
    agentNamespace: AgentNamespace,
    agentId: string,
    complianceFrameworks: ComplianceFramework[] | null = null,
    config: AgentSessionConfig = {},
    metadata: Record<string, any> = {},
    policyEngine: AgentPolicyEngine | null = null
  ) {
    this.sessionId = `sess_${randomBytes(8).toString('hex')}`;
    this.agentId = agentId;
    this.agentNamespace = agentNamespace;
    this.complianceFrameworks = complianceFrameworks;
    this.metadata = metadata;
    this.policyEngine = policyEngine;
    this.startedAt = new Date();

    this.config = {
      deepEveryN: config.deepEveryN ?? 0,
      escalateAfterFlags: config.escalateAfterFlags ?? 3,
      autoBlockAfterCritical: config.autoBlockAfterCritical ?? true,
      maxToolCalls: config.maxToolCalls ?? 100,
      sessionTtlMinutes: config.sessionTtlMinutes ?? 720,
      trackToolResults: config.trackToolResults ?? true,
    };
  }

  private assertOpen(): void {
    if (this.status === 'closed') {
      throw new SessionClosedError();
    }
  }

  private autoCloseIfNeeded(): void {
    const toolCallCount = this.events.filter((e) => e.kind === 'tool_call').length;
    if (toolCallCount >= this.config.maxToolCalls) {
      this.close();
      return;
    }
    const elapsedMs = Date.now() - this.startedAt.getTime();
    if (elapsedMs >= this.config.sessionTtlMinutes * 60 * 1000) {
      this.close();
    }
  }

  private resolveMode(baseMode?: EvaluationMode): EvaluationMode | undefined {
    const toolCallCount = this.events.filter((e) => e.kind === 'tool_call').length;

    // Escalate after consecutive flags
    if (this.config.escalateAfterFlags > 0) {
      let consecutive = 0;
      const toolEvents = this.events
        .filter((e) => e.kind === 'tool_call')
        .map((e) => (e as { kind: 'tool_call'; record: ToolCallRecord }).record);
      for (let i = toolEvents.length - 1; i >= 0; i--) {
        if (toolEvents[i].decision.decision === 'FLAG') {
          consecutive++;
        } else {
          break;
        }
      }
      if (consecutive >= this.config.escalateAfterFlags) {
        return 'deep';
      }
    }

    // Deep every N calls
    if (this.config.deepEveryN > 0 && toolCallCount > 0 && toolCallCount % this.config.deepEveryN === 0) {
      return 'deep';
    }

    return baseMode;
  }

  /**
   * Evaluate a tool call in this session context.
   * Internally calls the agent namespace, records the event, and runs pattern detection.
   */
  async evaluateToolCall(params: EvaluateToolCallParams): Promise<AgentDecision> {
    this.assertOpen();
    this.autoCloseIfNeeded();
    this.assertOpen();

    if (this.config.autoBlockAfterCritical && this.criticalViolationOccurred) {
      throw new SessionClosedError('Session auto-blocked after critical violation');
    }

    // Inject session context
    const enrichedParams: EvaluateToolCallParams = {
      ...params,
      mode: this.resolveMode(params.mode),
      complianceFrameworks: params.complianceFrameworks ?? this.complianceFrameworks ?? undefined,
      agentContext: {
        ...params.agentContext,
        agentId: params.agentContext?.agentId ?? this.agentId,
      },
    };

    const decision = await this.agentNamespace.evaluateToolCall(enrichedParams);

    this.events.push({
      kind: 'tool_call',
      record: { decision, toolName: params.toolName, timestamp: new Date().toISOString() },
    });

    // Track critical violations
    if (decision.complianceViolations.some((v) => v.severity === 'critical')) {
      this.criticalViolationOccurred = true;
    }

    // Apply policy engine if configured
    if (this.policyEngine) {
      this.policyEngine.check(decision);
    }

    return decision;
  }

  /**
   * Evaluate a tool result in this session context.
   */
  async evaluateToolResult(params: EvaluateToolResultParams): Promise<ToolResultEvaluation> {
    this.assertOpen();

    const result = await this.agentNamespace.evaluateToolResult(params);

    if (this.config.trackToolResults) {
      this.events.push({
        kind: 'tool_result',
        record: { result, toolName: params.toolName, timestamp: new Date().toISOString() },
      });
    }

    return result;
  }

  /**
   * Check for prompt injection in this session context.
   */
  async checkInjection(params: CheckInjectionParams): Promise<InjectionCheckResult> {
    this.assertOpen();

    const result = await this.agentNamespace.checkInjection(params);

    this.events.push({
      kind: 'injection',
      record: { result, timestamp: new Date().toISOString() },
    });

    return result;
  }

  /**
   * Return the current accumulated session risk state. No API call is made.
   */
  riskSummary(): SessionRiskSummary {
    const toolCallEvents = this.events
      .filter((e) => e.kind === 'tool_call')
      .map((e) => (e as { kind: 'tool_call'; record: ToolCallRecord }).record);

    const allowed = toolCallEvents.filter((r) => r.decision.decision === 'ALLOW').length;
    const flagged = toolCallEvents.filter((r) => r.decision.decision === 'FLAG').length;
    const blocked = toolCallEvents.filter((r) => r.decision.decision === 'BLOCK').length;

    // Aggregate dimension scores
    const dimensionSums: Record<string, number> = {};
    const dimensionCounts: Record<string, number> = {};
    for (const record of toolCallEvents) {
      for (const [dim, val] of Object.entries(record.decision.dimensionScores)) {
        dimensionSums[dim] = (dimensionSums[dim] ?? 0) + (val as any).score;
        dimensionCounts[dim] = (dimensionCounts[dim] ?? 0) + 1;
      }
    }
    const dimensionAverages: Record<string, number> = {};
    for (const dim of Object.keys(dimensionSums)) {
      dimensionAverages[dim] = dimensionSums[dim] / dimensionCounts[dim];
    }

    // Current risk score = average of last rail_score values
    const recentScores = toolCallEvents.slice(-5).map((r) => r.decision.railScore.score);
    const currentRiskScore =
      recentScores.length > 0
        ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
        : 0;

    // Risk trend
    const riskTrend = this.computeRiskTrend(toolCallEvents);

    // Patterns
    const patternsDetected = this.detectPatterns(toolCallEvents);

    // Compliance exposure
    const complianceExposure: Record<string, { violations: number; warnings: number; riskTier: string }> = {};
    for (const record of toolCallEvents) {
      for (const v of record.decision.complianceViolations) {
        if (!complianceExposure[v.framework]) {
          complianceExposure[v.framework] = { violations: 0, warnings: 0, riskTier: 'low' };
        }
        if (v.severity === 'high' || v.severity === 'critical') {
          complianceExposure[v.framework].violations++;
        } else {
          complianceExposure[v.framework].warnings++;
        }
        const total = complianceExposure[v.framework].violations + complianceExposure[v.framework].warnings;
        complianceExposure[v.framework].riskTier =
          complianceExposure[v.framework].violations >= 3 ? 'high' :
          total >= 3 ? 'medium' : 'low';
      }
    }

    // Credits consumed
    const totalCreditsConsumed = toolCallEvents.reduce(
      (sum, r) => sum + r.decision.creditsConsumed,
      0
    );

    const criticalViolations = toolCallEvents.reduce(
      (sum, r) =>
        sum + r.decision.complianceViolations.filter((v) => v.severity === 'critical').length,
      0
    );

    const nowMs = this.closedAt ? this.closedAt.getTime() : Date.now();
    const durationSeconds = Math.floor((nowMs - this.startedAt.getTime()) / 1000);

    return {
      sessionId: this.sessionId,
      agentId: this.agentId,
      status: this.status,
      totalToolCalls: toolCallEvents.length,
      allowed,
      flagged,
      blocked,
      criticalViolations,
      currentRiskScore,
      riskTrend,
      dimensionAverages,
      patternsDetected,
      complianceExposure,
      totalCreditsConsumed,
      durationSeconds,
      closedAt: this.closedAt ? this.closedAt.toISOString() : null,
    };
  }

  /**
   * Close the session and return the final risk summary.
   */
  close(): SessionRiskSummary {
    this.status = 'closed';
    this.closedAt = new Date();
    return this.riskSummary();
  }

  private computeRiskTrend(
    records: ToolCallRecord[]
  ): 'stable' | 'improving' | 'escalating' | 'critical' {
    if (records.length < 3) return 'stable';

    const scores = records.map((r) => r.decision.railScore.score);
    const recentThree = scores.slice(-3);
    const [a, b, c] = recentThree;

    if (c <= 3.0) return 'critical';
    if (c < b && b < a) return 'escalating';
    if (c > b && b > a) return 'improving';
    return 'stable';
  }

  private detectPatterns(records: ToolCallRecord[]): SessionPattern[] {
    const patterns: SessionPattern[] = [];
    const now = new Date().toISOString();

    // repeated_pii_access: PII detected in ≥ 3 tool calls
    const piiCount = records.filter((r) =>
      r.decision.contextSignals.piiFieldsDetected.length > 0
    ).length;
    if (piiCount >= 3) {
      patterns.push({
        pattern: 'repeated_pii_access',
        description: `Tool accessed PII fields in ${piiCount} of ${records.length} calls`,
        severity: 'high',
        firstSeen: records.find((r) => r.decision.contextSignals.piiFieldsDetected.length > 0)?.timestamp ?? now,
      });
    }

    // escalating_risk_scores: RAIL score drops in 3+ consecutive calls
    if (records.length >= 3) {
      let drops = 0;
      for (let i = 1; i < records.length; i++) {
        if (records[i].decision.railScore.score < records[i - 1].decision.railScore.score) {
          drops++;
        }
      }
      if (drops >= 3) {
        patterns.push({
          pattern: 'escalating_risk_scores',
          description: `RAIL score dropped in ${drops} consecutive calls`,
          severity: 'high',
          firstSeen: records[1].timestamp,
        });
      }
    }

    // blocked_retry: same tool blocked and called again
    const blockedTools = new Set(
      records.filter((r) => r.decision.decision === 'BLOCK').map((r) => r.toolName)
    );
    for (const toolName of blockedTools) {
      const callsForTool = records.filter((r) => r.toolName === toolName);
      const firstBlock = callsForTool.findIndex((r) => r.decision.decision === 'BLOCK');
      if (firstBlock >= 0 && callsForTool.length > firstBlock + 1) {
        patterns.push({
          pattern: 'blocked_retry',
          description: `Tool "${toolName}" was blocked and called again`,
          severity: 'medium',
          firstSeen: callsForTool[firstBlock + 1].timestamp,
        });
      }
    }

    // compliance_accumulation: more than 3 distinct compliance violations
    const allViolationIds = new Set<string>();
    for (const r of records) {
      for (const v of r.decision.complianceViolations) {
        allViolationIds.add(`${v.framework}:${v.article}`);
      }
    }
    if (allViolationIds.size > 3) {
      patterns.push({
        pattern: 'compliance_accumulation',
        description: `${allViolationIds.size} distinct compliance violations accumulated across the session`,
        severity: 'high',
        firstSeen: now,
      });
    }

    // dimension_degradation: average score for any single dimension drops ≥ 2.0 points
    if (records.length >= 4) {
      const half = Math.floor(records.length / 2);
      const firstHalf = records.slice(0, half);
      const secondHalf = records.slice(half);

      const avgDim = (recs: ToolCallRecord[], dim: string): number => {
        const scores = recs
          .map((r) => (r.decision.dimensionScores[dim] as any)?.score)
          .filter((s): s is number => s !== undefined);
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : -1;
      };

      const dims = Object.keys(records[0]?.decision.dimensionScores ?? {});
      for (const dim of dims) {
        const earlyAvg = avgDim(firstHalf, dim);
        const lateAvg = avgDim(secondHalf, dim);
        if (earlyAvg >= 0 && lateAvg >= 0 && earlyAvg - lateAvg >= 2.0) {
          patterns.push({
            pattern: 'dimension_degradation',
            description: `Average ${dim} score dropped ${(earlyAvg - lateAvg).toFixed(1)} points over the session`,
            severity: 'medium',
            firstSeen: secondHalf[0].timestamp,
          });
        }
      }
    }

    return patterns;
  }
}
