/**
 * Type definitions for the DPDP compliance namespace.
 *
 * Request parameters use camelCase (idiomatic TypeScript) and are mapped to the
 * snake_case API payloads internally. Response objects are likewise normalized
 * to camelCase, mirroring the `client.agent` namespace conventions.
 */

// ─── Configuration ────────────────────────────────────────────────────────────

export type DPDPEntityType = 'data_fiduciary' | 'significant_data_fiduciary';
export type DPDPSector =
  | 'fintech'
  | 'finance'
  | 'banking'
  | 'healthcare'
  | 'edtech'
  | 'e_commerce'
  | 'social_media'
  | 'other';
export type DPDPPiiAction = 'detect' | 'mask' | 'block' | 'warn' | 'log';
export type DPDPChildAction = 'block' | 'warn' | 'log';
export type DPDPDriftAction = 'block' | 'warn' | 'log';

/**
 * Configuration for client-side DPDP scanning and as defaults for sessions.
 * Mirrors the Python `DPDPConfig` dataclass.
 */
export interface DPDPConfigInput {
  entityType?: DPDPEntityType;
  sector?: DPDPSector;
  purpose?: string;
  piiAction?: DPDPPiiAction;
  childContentAction?: DPDPChildAction;
  purposeDriftAction?: DPDPDriftAction;
  processesChildren?: boolean;
  crossBorderTransfers?: boolean;
  indianUsers?: number;
  piiPatterns?: string[];
  dsrSlaDays?: number;
  preErasureNoticeHours?: number;
  breachDpbiHours?: number;
  breachCertinHours?: number;
}

/** Fully resolved DPDP configuration (all fields populated with defaults). */
export interface DPDPConfigResolved extends Required<DPDPConfigInput> {}

// ─── Local scanner models ──────────────────────────────────────────────────────

export interface DPDPPiiMatch {
  type: string;
  value: string;
  start: number;
  end: number;
  maskedValue: string;
  severity: string;
  section: string;
  penaltyCrore: number;
}

export interface DPDPChildSignal {
  signalType: string;
  evidence: string;
  detectedAge: number | null;
  section: string;
}

export interface DPDPViolation {
  check: string;
  section: string;
  reason: string;
  action: string;
  found: string | null;
  severity: string;
}

export interface DPDPContentResult {
  compliant: boolean;
  violations: DPDPViolation[];
  piiFound: DPDPPiiMatch[];
  childSignals: DPDPChildSignal[];
  sessionFlags: string[];
  maskedContent: string | null;
  originalContent: string | null;
}

// ─── Server-side /scan models ───────────────────────────────────────────────────

export interface DPDPScanPiiItem {
  type: string;
  original: string;
  masked: string;
  position: { start?: number; end?: number };
  severity: string;
  section: string;
  penaltyCrore: number;
}

export interface DPDPScanChildSignal {
  type: string;
  text: string;
  inferredAge: number | null;
  section: string;
}

export interface DPDPScanResult {
  compliant: boolean;
  piiFound: DPDPScanPiiItem[];
  childSignals: DPDPScanChildSignal[];
  childSession: boolean;
  childActionsRequired: string[];
  purposeDrift: boolean;
  purposeDriftDetails: Record<string, any>;
  checksRun: string[];
  latencyMs: number;
  creditsConsumed: number;
  contentMasked: string | null;
}

// ─── Session models ─────────────────────────────────────────────────────────────

export interface DPDPSessionState {
  consentStatus: Record<string, any>;
  noticeShown: boolean;
  childSession: boolean;
  eventsCount: number;
  openTimers: Array<Record<string, any>>;
  fulfilledObligations: string[];
  pendingObligations: string[];
}

export interface DPDPSession {
  sessionId: string;
  createdAt: string;
  config: Record<string, any>;
  state: DPDPSessionState | null;
  creditsConsumed: number;
}

// ─── /evaluate models ───────────────────────────────────────────────────────────

export interface DPDPViolationDetail {
  rule: string;
  section: string;
  severity: string;
  penaltyCrore: number;
  description: string;
  remediation: string;
}

export interface DPDPCondition {
  type: string;
  reason: string;
  action: string;
}

export interface DPDPRequiredAction {
  type: string;
  reason: string;
  section: string;
  priority: number;
  details: string;
  metadata: Record<string, any>;
}

export interface DPDPDecision {
  verdict: string;
  violations: DPDPViolationDetail[];
  conditions: DPDPCondition[];
  requiredActions: DPDPRequiredAction[];
  requiredBeforeProceed: DPDPRequiredAction[];
  sessionState: DPDPSessionState | null;
  creditsConsumed: number;
}

// ─── /emit models ───────────────────────────────────────────────────────────────

export interface DPDPEventResult {
  eventId: string;
  type: string;
  status: string;
  timersStarted: string[];
  stateChanges: string[];
}

export interface DPDPEmitResult {
  accepted: number;
  rejected: number;
  events: DPDPEventResult[];
  creditsConsumed: number;
}

// ─── /require model ─────────────────────────────────────────────────────────────

export interface DPDPRequireResult {
  requiredActions: DPDPRequiredAction[];
  sessionState: DPDPSessionState | null;
  creditsConsumed: number;
}

// ─── /evidence model ────────────────────────────────────────────────────────────

export interface DPDPEvidenceArtefact {
  evidenceId: string;
  type: string;
  generatedAt: string;
  data: Record<string, any>;
  creditsConsumed: number;
}

// ─── /timers models ─────────────────────────────────────────────────────────────

export interface DPDPTimer {
  timerId: string;
  type: string;
  startedAt: string;
  deadline: string;
  status: string;
  daysRemaining: number | null;
  requestId: string | null;
  userId: string | null;
  orgId: string | null;
  breachId: string | null;
  alertAt: string | null;
}

export interface DPDPTimerSummary {
  totalActive: number;
  overdue: number;
  approachingDays: number;
}

export interface DPDPTimerList {
  timers: DPDPTimer[];
  summary: DPDPTimerSummary | null;
  creditsConsumed: number;
}

// ─── /compliance/check (audit) models ────────────────────────────────────────────

export interface DPDPTieredRequirement {
  requirementId: string;
  requirement: string;
  article: string;
  referenceUrl: string;
  status: string;
  score: number;
  confidence: number;
  threshold: number;
  tier: string;
  penaltyCeilingCrore: number | null;
  enforcementPhase: string | null;
  chatbotExplanation: string | null;
  checklist: string[] | null;
  issue: string | null;
}

export interface DPDPAuditResult {
  framework: string;
  frameworkVersion: string;
  frameworkUrl: string;
  evaluatedAt: string;
  complianceScore: Record<string, any>;
  dimensionScores: Record<string, any>;
  requirementsChecked: number;
  requirementsPassed: number;
  requirementsFailed: number;
  requirementsWarned: number;
  requirements: DPDPTieredRequirement[];
  issues: Array<Record<string, any>>;
  improvementSuggestions: string[];
  tier1Score: number | null;
  tier2Score: number | null;
  tier3Score: number | null;
  totalPenaltyExposureCrore: number;
  entityContext: Record<string, any>;
  enforcementTimeline: Record<string, string>;
  partialResult: boolean;
  fromCache: boolean;
  credits: number | null;
  /** Convenience: compliance_score.score, or 0. */
  overallScore: number;
  /** Convenience: compliance_score.label, or ''. */
  overallLabel: string;
}

// ─── Method parameter shapes ──────────────────────────────────────────────────────

export interface DPDPScanParams {
  piiAction?: DPDPPiiAction;
  childDetection?: boolean;
  purpose?: string;
  sessionId?: string;
}

export interface DPDPEvaluateParams {
  sessionId?: string;
}

export interface DPDPEmitParams {
  sessionId?: string;
}

export interface DPDPEvent {
  type: string;
  data?: Record<string, any>;
  [key: string]: any;
}

export interface DPDPCreateSessionParams {
  entityType?: DPDPEntityType;
  purpose: string;
  sector?: DPDPSector;
  processesChildren?: boolean;
  ttlHours?: number;
}

export interface DPDPListTimersParams {
  status?: string;
  timerType?: string;
  approachingDays?: number;
}

export interface DPDPAuditParams {
  entityType?: DPDPEntityType;
  sector?: DPDPSector;
  processesChildren?: boolean;
  crossBorderTransfers?: boolean;
  strictMode?: boolean;
  includeExplanations?: boolean;
}
