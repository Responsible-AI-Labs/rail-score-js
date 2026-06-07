/**
 * DPDP compliance namespace — available as `client.dpdp`.
 *
 * Mirrors the Python SDK's `client.dpdp` (DPDPClient / AsyncDPDPClient).
 * All methods return Promises and normalize snake_case API responses to
 * camelCase result objects.
 */

import type { RailScore } from '../client';
import { DPDPHostedOnlyError, RailScoreError, ValidationError } from '../errors';
import type {
  DPDPAuditParams,
  DPDPAuditResult,
  DPDPCondition,
  DPDPCreateSessionParams,
  DPDPDecision,
  DPDPEmitParams,
  DPDPEmitResult,
  DPDPEvaluateParams,
  DPDPEvent,
  DPDPEventResult,
  DPDPEvidenceArtefact,
  DPDPListTimersParams,
  DPDPRequiredAction,
  DPDPRequireResult,
  DPDPScanChildSignal,
  DPDPScanParams,
  DPDPScanPiiItem,
  DPDPScanResult,
  DPDPSession,
  DPDPSessionState,
  DPDPTieredRequirement,
  DPDPTimer,
  DPDPTimerList,
  DPDPViolationDetail,
} from './types';

const DPDP_BASE = '/railscore/v1/compliance/dpdp';
const COMPLIANCE_CHECK = '/railscore/v1/compliance/check';

// ─── Response mappers (snake_case → camelCase) ──────────────────────────────────

function mapSessionState(d: any): DPDPSessionState {
  return {
    consentStatus: d.consent_status ?? {},
    noticeShown: d.notice_shown ?? false,
    childSession: d.child_session ?? false,
    eventsCount: d.events_count ?? 0,
    openTimers: d.open_timers ?? [],
    fulfilledObligations: d.fulfilled_obligations ?? [],
    pendingObligations: d.pending_obligations ?? [],
  };
}

function mapViolationDetail(d: any): DPDPViolationDetail {
  return {
    rule: d.rule ?? '',
    section: d.section ?? '',
    severity: d.severity ?? 'medium',
    penaltyCrore: d.penalty_crore ?? 0,
    description: d.description ?? '',
    remediation: d.remediation ?? '',
  };
}

function mapCondition(d: any): DPDPCondition {
  return {
    type: d.type ?? '',
    reason: d.reason ?? '',
    action: d.action ?? '',
  };
}

function mapRequiredAction(d: any): DPDPRequiredAction {
  return {
    type: d.type ?? '',
    reason: d.reason ?? '',
    section: d.section ?? '',
    priority: d.priority ?? 1,
    details: d.details ?? '',
    metadata: d.metadata ?? {},
  };
}

function mapScanResult(data: any): DPDPScanResult {
  const result = data.result ?? data;
  return {
    compliant: result.compliant ?? true,
    piiFound: (result.pii_found ?? []).map(
      (p: any): DPDPScanPiiItem => ({
        type: p.type ?? '',
        original: p.original ?? '',
        masked: p.masked ?? '',
        position: p.position ?? {},
        severity: p.severity ?? 'high',
        section: p.section ?? 'S.8(5)',
        penaltyCrore: p.penalty_crore ?? 250,
      })
    ),
    childSignals: (result.child_signals ?? []).map(
      (cs: any): DPDPScanChildSignal => ({
        type: cs.type ?? '',
        text: cs.text ?? '',
        inferredAge: cs.inferred_age ?? null,
        section: cs.section ?? 'S.9',
      })
    ),
    childSession: result.child_session ?? false,
    childActionsRequired: result.child_actions_required ?? [],
    purposeDrift: result.purpose_drift ?? false,
    purposeDriftDetails: result.purpose_drift_details ?? {},
    checksRun: result.checks_run ?? [],
    latencyMs: result.latency_ms ?? 0,
    creditsConsumed: data.credits_consumed ?? 0,
    contentMasked: result.content_masked ?? null,
  };
}

function mapDecision(data: any): DPDPDecision {
  const result = data.result ?? data;
  const stateData = result.session_state;
  return {
    verdict: result.verdict ?? '',
    violations: (result.violations ?? []).map(mapViolationDetail),
    conditions: (result.conditions ?? []).map(mapCondition),
    requiredActions: (result.required_actions ?? []).map(mapRequiredAction),
    requiredBeforeProceed: (result.required_before_proceed ?? []).map(mapRequiredAction),
    sessionState: stateData ? mapSessionState(stateData) : null,
    creditsConsumed: data.credits_consumed ?? 0,
  };
}

function mapEmitResult(data: any): DPDPEmitResult {
  const result = data.result ?? data;
  return {
    accepted: result.accepted ?? 0,
    rejected: result.rejected ?? 0,
    events: (result.events ?? []).map(
      (e: any): DPDPEventResult => ({
        eventId: e.event_id ?? '',
        type: e.type ?? '',
        status: e.status ?? 'recorded',
        timersStarted: e.timers_started ?? [],
        stateChanges: e.state_changes ?? [],
      })
    ),
    creditsConsumed: data.credits_consumed ?? 0,
  };
}

function mapRequireResult(data: any): DPDPRequireResult {
  const result = data.result ?? data;
  const stateData = result.session_state;
  return {
    requiredActions: (result.required_actions ?? []).map(mapRequiredAction),
    sessionState: stateData ? mapSessionState(stateData) : null,
    creditsConsumed: data.credits_consumed ?? 0,
  };
}

function mapEvidence(data: any): DPDPEvidenceArtefact {
  const result = data.result ?? data;
  const reserved = new Set(['evidence_id', 'type', 'generated_at']);
  const extra: Record<string, any> = {};
  for (const [k, v] of Object.entries(result)) {
    if (!reserved.has(k)) extra[k] = v;
  }
  return {
    evidenceId: result.evidence_id ?? '',
    type: result.type ?? '',
    generatedAt: result.generated_at ?? '',
    data: extra,
    creditsConsumed: data.credits_consumed ?? 0,
  };
}

function mapSession(data: any): DPDPSession {
  const result = data.result ?? data;
  const stateData = result.state;
  return {
    sessionId: result.session_id ?? '',
    createdAt: result.created_at ?? '',
    config: result.config ?? {},
    state: stateData ? mapSessionState(stateData) : null,
    creditsConsumed: data.credits_consumed ?? 0,
  };
}

function mapTimer(d: any): DPDPTimer {
  return {
    timerId: d.timer_id ?? '',
    type: d.type ?? '',
    startedAt: d.started_at ?? '',
    deadline: d.deadline ?? '',
    status: d.status ?? 'active',
    daysRemaining: d.days_remaining ?? null,
    requestId: d.request_id ?? null,
    userId: d.user_id ?? null,
    orgId: d.org_id ?? null,
    breachId: d.breach_id ?? null,
    alertAt: d.alert_at ?? null,
  };
}

function mapTimerList(data: any): DPDPTimerList {
  const result = data.result ?? data;
  const summaryData = result.summary;
  return {
    timers: (result.timers ?? []).map(mapTimer),
    summary: summaryData
      ? {
          totalActive: summaryData.total_active ?? 0,
          overdue: summaryData.overdue ?? 0,
          approachingDays:
            summaryData.approaching_7_days ?? summaryData.approaching_15_days ?? 0,
        }
      : null,
    creditsConsumed: data.credits_consumed ?? 0,
  };
}

function mapAuditResult(data: any): DPDPAuditResult {
  const result = data.result ?? data;
  const complianceScore = result.compliance_score ?? {};
  return {
    framework: result.framework ?? 'india_dpdp',
    frameworkVersion: result.framework_version ?? '',
    frameworkUrl: result.framework_url ?? '',
    evaluatedAt: result.evaluated_at ?? '',
    complianceScore,
    dimensionScores: result.dimension_scores ?? {},
    requirementsChecked: result.requirements_checked ?? 0,
    requirementsPassed: result.requirements_passed ?? 0,
    requirementsFailed: result.requirements_failed ?? 0,
    requirementsWarned: result.requirements_warned ?? 0,
    requirements: (result.requirements ?? []).map(
      (r: any): DPDPTieredRequirement => ({
        requirementId: r.requirement_id ?? '',
        requirement: r.requirement ?? '',
        article: r.article ?? '',
        referenceUrl: r.reference_url ?? '',
        status: r.status ?? '',
        score: r.score ?? 0,
        confidence: r.confidence ?? 0,
        threshold: r.threshold ?? 0,
        tier: r.tier ?? '',
        penaltyCeilingCrore: r.penalty_ceiling_crore ?? null,
        enforcementPhase: r.enforcement_phase ?? null,
        chatbotExplanation: r.chatbot_explanation ?? null,
        checklist: r.checklist ?? null,
        issue: r.issue ?? null,
      })
    ),
    issues: result.issues ?? [],
    improvementSuggestions: result.improvement_suggestions ?? [],
    tier1Score: result.tier_1_score ?? null,
    tier2Score: result.tier_2_score ?? null,
    tier3Score: result.tier_3_score ?? null,
    totalPenaltyExposureCrore: result.total_penalty_exposure_crore ?? 0,
    entityContext: result.entity_context ?? {},
    enforcementTimeline: result.enforcement_timeline ?? {},
    partialResult: result.partial_result ?? false,
    fromCache: result.from_cache ?? false,
    credits: result._credits ?? null,
    overallScore: complianceScore.score ?? 0,
    overallLabel: complianceScore.label ?? '',
  };
}

// ─── Namespace ─────────────────────────────────────────────────────────────────

/**
 * DPDP (India Digital Personal Data Protection Act, 2023) compliance namespace.
 *
 * Combines server-side content scanning, an event-driven behavioral compliance
 * engine, and a tiered system audit. Attached to the client as `client.dpdp`.
 *
 * @example
 * ```typescript
 * const scan = await client.dpdp.scan('Call me at +91 9876543210', { piiAction: 'mask' });
 * if (!scan.compliant) {
 *   console.log(scan.piiFound.map((p) => p.type));
 * }
 * ```
 */
export class DPDPNamespace {
  constructor(private readonly client: RailScore) {}

  /**
   * Scan text for Indian PII, child signals, and purpose drift.
   *
   * POST /railscore/v1/compliance/dpdp/scan
   */
  async scan(content: string, params: DPDPScanParams = {}): Promise<DPDPScanResult> {
    const config: Record<string, any> = {
      pii_action: params.piiAction ?? 'detect',
      child_detection: params.childDetection ?? true,
    };
    if (params.purpose) config.purpose = params.purpose;
    if (params.sessionId) config.session_id = params.sessionId;

    const raw = await this.client.request<any>(`${DPDP_BASE}/scan`, {
      method: 'POST',
      body: JSON.stringify({ content, config }),
    });
    return mapScanResult(raw);
  }

  /**
   * Synchronous allow / block / require_action gate for a proposed action.
   *
   * POST /railscore/v1/compliance/dpdp/evaluate
   */
  async evaluate(
    action: string,
    context: Record<string, any>,
    params: DPDPEvaluateParams = {}
  ): Promise<DPDPDecision> {
    const payload: Record<string, any> = { action, context };
    if (params.sessionId) payload.session_id = params.sessionId;

    const raw = await this.client.request<any>(`${DPDP_BASE}/evaluate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return mapDecision(raw);
  }

  /**
   * Record behavioral events for compliance evidence (1 event or up to 50).
   *
   * POST /railscore/v1/compliance/dpdp/emit
   */
  async emit(
    events: DPDPEvent | DPDPEvent[],
    params: DPDPEmitParams = {}
  ): Promise<DPDPEmitResult> {
    const eventList = Array.isArray(events) ? events : [events];
    const payload: Record<string, any> = { events: eventList };
    if (params.sessionId) payload.session_id = params.sessionId;

    const raw = await this.client.request<any>(`${DPDP_BASE}/emit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return mapEmitResult(raw);
  }

  /**
   * Get required actions for the current workflow state.
   *
   * POST /railscore/v1/compliance/dpdp/require
   */
  async require(
    sessionId: string,
    workflowStep: string,
    context?: Record<string, any>
  ): Promise<DPDPRequireResult> {
    const payload: Record<string, any> = {
      session_id: sessionId,
      workflow_step: workflowStep,
    };
    if (context) payload.context = context;

    const raw = await this.client.request<any>(`${DPDP_BASE}/require`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return mapRequireResult(raw);
  }

  /**
   * Generate audit-grade evidence packets (Pro+ tier).
   *
   * POST /railscore/v1/compliance/dpdp/evidence
   */
  async evidence(
    evidenceType: string,
    params: Record<string, any>
  ): Promise<DPDPEvidenceArtefact> {
    const raw = await this.client.request<any>(`${DPDP_BASE}/evidence`, {
      method: 'POST',
      body: JSON.stringify({ type: evidenceType, params }),
    });
    return mapEvidence(raw);
  }

  /**
   * Create a new compliance session.
   *
   * POST /railscore/v1/compliance/dpdp/session
   *
   * @throws {ValidationError} when `purpose` is empty (DPDP S.4 requires a
   *   declared processing purpose).
   */
  async createSession(params: DPDPCreateSessionParams): Promise<DPDPSession> {
    const purpose = params.purpose;
    if (!purpose || purpose.trim().length === 0) {
      // Mirror the Python ValueError; in TS this is a ValidationError.
      throw new ValidationError(
        'purpose is required: the RAIL Score API rejects compliance sessions ' +
          'without a declared processing purpose (DPDP S.4). Pass purpose to ' +
          'describe why the data is processed.',
        'purpose'
      );
    }
    const payload = {
      action: 'create',
      config: {
        entity_type: params.entityType ?? 'data_fiduciary',
        purpose,
        sector: params.sector ?? 'other',
        processes_children: params.processesChildren ?? false,
        ttl_hours: params.ttlHours ?? 24,
      },
    };

    const raw = await this.client.request<any>(`${DPDP_BASE}/session`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return mapSession(raw);
  }

  /**
   * Retrieve an existing compliance session.
   *
   * POST /railscore/v1/compliance/dpdp/session
   */
  async getSession(sessionId: string): Promise<DPDPSession> {
    const raw = await this.client.request<any>(`${DPDP_BASE}/session`, {
      method: 'POST',
      body: JSON.stringify({ action: 'get', session_id: sessionId }),
    });
    return mapSession(raw);
  }

  /**
   * List active compliance timers.
   *
   * GET /railscore/v1/compliance/dpdp/timers
   */
  async listTimers(params: DPDPListTimersParams = {}): Promise<DPDPTimerList> {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.timerType) qs.set('type', params.timerType);
    if (params.approachingDays !== undefined) {
      qs.set('approaching_days', String(params.approachingDays));
    }
    const query = qs.toString();
    const endpoint = `${DPDP_BASE}/timers${query ? `?${query}` : ''}`;

    const raw = await this.client.request<any>(endpoint, { method: 'GET' });
    return mapTimerList(raw);
  }

  /**
   * Run a DPDP system audit with tiered requirement scoring.
   *
   * POST /railscore/v1/compliance/check (framework="india_dpdp")
   *
   * @throws {DPDPHostedOnlyError} when the audit endpoint returns 404 or 501.
   */
  async dpdpAudit(content: string, params: DPDPAuditParams = {}): Promise<DPDPAuditResult> {
    const payload = {
      content,
      framework: 'india_dpdp',
      strict_mode: params.strictMode ?? false,
      include_explanations: params.includeExplanations ?? true,
      context: {
        entity_type: params.entityType ?? 'data_fiduciary',
        sector: params.sector ?? 'other',
        processes_children: params.processesChildren ?? false,
        cross_border_transfers: params.crossBorderTransfers ?? false,
      },
    };

    let raw: any;
    try {
      raw = await this.client.request<any>(COMPLIANCE_CHECK, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (err instanceof RailScoreError && (err.statusCode === 404 || err.statusCode === 501)) {
        throw new DPDPHostedOnlyError();
      }
      throw err;
    }
    return mapAuditResult(raw);
  }
}
