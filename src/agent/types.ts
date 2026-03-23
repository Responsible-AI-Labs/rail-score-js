import type { ComplianceFramework, EvaluationMode } from '../types';

// ─── Shared Agent Types ──────────────────────────────────────────────────────

/**
 * Content domains supported by agent evaluation endpoints
 */
export type AgentDomain =
  | 'general'
  | 'finance'
  | 'hr'
  | 'healthcare'
  | 'legal'
  | 'code'
  | 'education';

/**
 * Context describing the agent and its current execution state
 */
export interface AgentContext {
  /** High-level goal of the agent */
  goal?: string;
  /** Unique identifier for the agent instance */
  agentId?: string;
  /** Which step in the plan this call represents */
  stepIndex?: number;
  /** Why this tool call is being made */
  rationale?: string;
  /** Names of tools already called in this session */
  priorToolCalls?: string[];
  /** Conversation turn counter */
  turnIndex?: number;
}

/**
 * Threshold configuration for blocking and flagging decisions
 */
export interface AgentThresholds {
  /** Block the tool call if RAIL score is below this value */
  blockBelow?: number;
  /** Flag the tool call if RAIL score is below this value */
  flagBelow?: number;
  /** Per-dimension minimum scores */
  dimensionMinimums?: Record<string, number>;
}

/**
 * A compliance framework violation returned by the API
 */
export interface ComplianceViolation {
  framework: string;
  article: string;
  title: string;
  severity: string;
  description: string;
  remediation: string;
}

/**
 * Policy rule that was applied to the evaluation
 */
export interface PolicyInfo {
  appliedRule: string;
  thresholdUsed: { blockBelow?: number; flagBelow?: number };
  violatedDimensions: string[];
  source: 'custom' | 'org_custom' | 'system_default';
}

/**
 * Contextual risk signals detected during evaluation
 */
export interface ContextSignals {
  toolRiskLevel: string;
  proxyVariablesDetected: string[];
  piiFieldsDetected: string[];
  highStakesDomain: boolean;
}

// ─── Evaluate Tool Call ──────────────────────────────────────────────────────

/**
 * Parameters for agent.evaluateToolCall()
 */
export interface EvaluateToolCallParams {
  /** Name of the tool being called */
  toolName: string;
  /** Parameters that would be passed to the tool */
  toolParams: Record<string, any>;
  /** Content domain */
  domain?: AgentDomain;
  /** Evaluation mode */
  mode?: EvaluationMode;
  /** Agent execution context */
  agentContext?: AgentContext;
  /** Compliance frameworks to check */
  complianceFrameworks?: ComplianceFramework[];
  /** Override block/flag thresholds */
  customThresholds?: AgentThresholds;
}

/**
 * ALLOW / FLAG / BLOCK result from evaluateToolCall()
 */
export interface AgentDecision {
  /** The engine's decision */
  decision: 'ALLOW' | 'FLAG' | 'BLOCK';
  /** Human-readable explanation of the decision */
  decisionReason: string;
  /** Unique event identifier for audit logs */
  eventId: string;
  /** Overall RAIL score */
  railScore: {
    score: number;
    confidence: number;
    summary: string;
  };
  /** Per-dimension breakdown */
  dimensionScores: Record<string, {
    score: number;
    confidence: number;
    explanation?: string;
    issues?: string[];
  }>;
  /** Compliance violations detected */
  complianceViolations: ComplianceViolation[];
  /** Policy rule that was applied */
  policy: PolicyInfo | null;
  /** Contextual risk signals */
  contextSignals: ContextSignals;
  /** Revised parameters that would pass (if available) */
  suggestedParams: Record<string, any> | null;
  /** Credits consumed by this evaluation */
  creditsConsumed: number;
  /** Evaluation depth used */
  evaluationDepth: string;
  /** ISO timestamp of evaluation */
  evaluatedAt: string;
}

// ─── Evaluate Tool Result ────────────────────────────────────────────────────

/**
 * Parameters for agent.evaluateToolResult()
 */
export interface EvaluateToolResultParams {
  /** Name of the tool that produced the result */
  toolName: string;
  /** The tool's output — must include at least raw or data */
  toolResult: {
    raw?: string;
    data?: any;
    format?: 'text' | 'json';
  };
  /** The params originally passed to the tool */
  toolParams?: Record<string, any>;
  /** Which checks to run */
  checks?: ('pii' | 'prompt_injection' | 'rail_score')[];
  /** Agent execution context */
  agentContext?: AgentContext;
}

/**
 * A detected PII entity within tool output
 */
export interface PiiEntity {
  /** PII type, e.g. "SSN", "EMAIL", "FULL_NAME" */
  type: string;
  /** The detected value */
  value: string;
  /** Character offset in the raw string */
  offset: number;
  /** Whether the SDK recommends redacting this entity */
  shouldRedact: boolean;
}

/**
 * Result from agent.evaluateToolResult()
 */
export interface ToolResultEvaluation {
  eventId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: 'PASS' | 'FLAG' | 'REDACT_AND_PASS' | 'REDACT_AND_FLAG' | 'BLOCK';
  piiDetected: {
    found: boolean;
    entities: PiiEntity[];
    redactedResult: string | null;
    complianceFlags: string[];
  };
  promptInjection: {
    detected: boolean;
    confidence: number;
    patternsChecked: string[];
  };
  railScore: { score: number; confidence: number } | null;
  contextSignals: ContextSignals;
  /** Whether a pre-redacted version of the result is available in piiDetected.redactedResult */
  redactedAvailable: boolean;
  creditsConsumed: number;
  evaluatedAt: string;
}

// ─── Check Prompt Injection ──────────────────────────────────────────────────

/**
 * Parameters for agent.checkInjection()
 */
export interface CheckInjectionParams {
  /** Text to check for prompt injection */
  content: string;
  /** Source of the content for context */
  contentSource?: string;
  /** Agent execution context */
  agentContext?: AgentContext;
}

/**
 * Result from agent.checkInjection()
 */
export interface InjectionCheckResult {
  eventId: string;
  injectionDetected: boolean;
  confidence: number;
  /** Attack type: "none" | "direct_instruction_override" | "role_hijack" | "jailbreak" | "data_exfiltration" | "context_manipulation" */
  attackType: string;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  payloadPreview: string | null;
  recommendedAction: 'PASS' | 'FLAG' | 'BLOCK';
  creditsConsumed: number;
  evaluatedAt: string;
}

// ─── Evaluate Plan ───────────────────────────────────────────────────────────

/**
 * A single step in an agent plan
 */
export interface PlanStep {
  stepIndex: number;
  toolName: string;
  toolParams: Record<string, any>;
  rationale?: string;
}

/**
 * Parameters for agent.evaluatePlan()
 */
export interface EvaluatePlanParams {
  /** Plan steps (max 20) */
  plan: PlanStep[];
  /** High-level goal of the plan */
  goal?: string;
  /** Agent identifier */
  agentId?: string;
  /** Content domain */
  domain?: AgentDomain;
  /** Evaluation mode */
  mode?: EvaluationMode;
  /** Compliance frameworks to check */
  complianceFrameworks?: ComplianceFramework[];
}

/**
 * Per-step result within a plan evaluation
 */
export interface PlanStepResult {
  stepIndex: number;
  toolName: string;
  decision: 'ALLOW' | 'FLAG' | 'BLOCK';
  railScore: number;
  dimensionScores: Record<string, { score: number; confidence: number; explanation?: string }>;
  complianceViolations: ComplianceViolation[];
  suggestedParams: Record<string, any> | null;
  contextSignals: ContextSignals;
}

/**
 * Overall result from agent.evaluatePlan()
 */
export interface PlanEvaluation {
  overallDecision: 'ALLOW_ALL' | 'PARTIAL_BLOCK' | 'BLOCK_ALL';
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  planSummary: string;
  stepResults: PlanStepResult[];
  creditsConsumed: number;
  evaluatedAt: string;
}

// ─── Tool Risk Registry ──────────────────────────────────────────────────────

/**
 * A registered tool risk profile
 */
export interface ToolRiskProfile {
  toolName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  evaluationDepth?: 'basic' | 'deep';
  source: 'system' | 'org_custom';
  thresholds?: AgentThresholds;
  complianceFrameworks?: string[];
  proxyVariableWatch?: string[];
  piiFieldsWatch?: string[];
  description?: string;
}

/**
 * Parameters for agent.registry.registerTool()
 */
export interface RegisterToolParams {
  toolName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  evaluationDepth?: 'basic' | 'deep';
  thresholds?: AgentThresholds;
  complianceFrameworks?: string[];
  proxyVariableWatch?: string[];
  piiFieldsWatch?: string[];
  description?: string;
}

/**
 * Parameters for agent.registry.listTools()
 */
export interface ListToolsParams {
  limit?: number;
  offset?: number;
  source?: 'all' | 'system' | 'org_custom';
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  search?: string;
}

/**
 * Response from agent.registry.listTools()
 */
export interface ListToolsResponse {
  tools: ToolRiskProfile[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Response from agent.registry.deleteTool()
 */
export interface DeleteToolResponse {
  toolName: string;
  deleted: boolean;
  fallback: string;
}

// ─── AgentSession Types ──────────────────────────────────────────────────────

/**
 * Configuration for AgentSession
 */
export interface AgentSessionConfig {
  /** Run deep mode every N tool calls (0 = disabled) */
  deepEveryN?: number;
  /** Switch to deep mode after N consecutive flags */
  escalateAfterFlags?: number;
  /** Block all calls after a critical violation */
  autoBlockAfterCritical?: boolean;
  /** Auto-close session after N tool calls */
  maxToolCalls?: number;
  /** Auto-close after this many minutes (default: 720 = 12 hours) */
  sessionTtlMinutes?: number;
  /** Include evaluateToolResult events in session tracking */
  trackToolResults?: boolean;
}

/**
 * A pattern detected across tool calls in a session
 */
export interface SessionPattern {
  pattern: string;
  description: string;
  severity: string;
  firstSeen: string;
}

/**
 * Accumulated session risk state returned by AgentSession.riskSummary()
 */
export interface SessionRiskSummary {
  sessionId: string;
  agentId: string;
  status: 'active' | 'closed';
  totalToolCalls: number;
  allowed: number;
  flagged: number;
  blocked: number;
  criticalViolations: number;
  currentRiskScore: number;
  riskTrend: 'stable' | 'improving' | 'escalating' | 'critical';
  dimensionAverages: Record<string, number>;
  patternsDetected: SessionPattern[];
  complianceExposure: Record<string, {
    violations: number;
    warnings: number;
    riskTier: string;
  }>;
  totalCreditsConsumed: number;
  durationSeconds: number;
  closedAt: string | null;
}

// ─── AgentPolicyEngine Types ─────────────────────────────────────────────────

/**
 * Policy enforcement mode for AgentPolicyEngine
 */
export type AgentPolicyMode = 'block' | 'suggest_fix' | 'log_only' | 'auto_fix';

/**
 * Result from AgentPolicyEngine.check()
 */
export interface PolicyCheckResult {
  blocked: boolean;
  flagged: boolean;
  allowed: boolean;
  score: number;
  reason: string;
  suggestedParams: Record<string, any> | null;
  violatedDimensions: string[];
}
