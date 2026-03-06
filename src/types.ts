/**
 * Configuration options for initializing the RailScore client
 */
export interface RailScoreConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for the API (defaults to https://api.responsibleailabs.ai) */
  baseUrl?: string;
  /** Request timeout in milliseconds (defaults to 30000) */
  timeout?: number;
}

/**
 * Available evaluation dimensions
 */
export type Dimension =
  | 'safety'
  | 'privacy'
  | 'fairness'
  | 'transparency'
  | 'accountability'
  | 'reliability'
  | 'inclusivity'
  | 'user_impact';

/**
 * Input dimension type that accepts both current and deprecated names.
 * Allows 'legal_compliance' for backward compatibility (maps to 'inclusivity').
 */
export type DimensionInput = Dimension | 'legal_compliance';

/**
 * Evaluation mode
 */
export type EvaluationMode = 'basic' | 'deep';

/**
 * Available content domains
 */
export type ContentDomain = 'general' | 'healthcare' | 'finance' | 'legal' | 'education' | 'code';

/**
 * Available use cases
 */
export type UseCase = 'general' | 'chatbot' | 'content_generation' | 'summarization' | 'translation' | 'code_generation';

// ─── Eval Types ───────────────────────────────────────────────────────────────

/**
 * Parameters for POST /railscore/v1/eval
 */
export interface EvalParams {
  /** Text to evaluate (10-10,000 chars) */
  content: string;
  /** "basic" (fast) or "deep" (detailed with explanations) */
  mode?: EvaluationMode;
  /** Subset of dimensions to evaluate */
  dimensions?: Dimension[];
  /** Custom weights per dimension (must sum to 100) */
  weights?: Record<string, number>;
  /** Additional context for evaluation */
  context?: string;
  /** Content domain */
  domain?: ContentDomain;
  /** Use case */
  usecase?: UseCase;
  /** Include per-dimension explanations */
  includeExplanations?: boolean;
  /** Include per-dimension issue lists */
  includeIssues?: boolean;
  /** Include improvement suggestions */
  includeSuggestions?: boolean;
}

/**
 * Score for an individual dimension
 */
export interface DimensionScore {
  /** Score value from 0-10 */
  score: number;
  /** Confidence level from 0-1 */
  confidence: number;
  /** Explanation (deep mode or if requested) */
  explanation?: string;
  /** List of identified issues (deep mode or if requested) */
  issues?: string[];
}

/**
 * Issue identified during evaluation
 */
export interface EvalIssue {
  /** Dimension the issue relates to */
  dimension: string;
  /** Description of the issue */
  description: string;
}

/**
 * Complete evaluation result from POST /railscore/v1/eval
 */
export interface EvalResult {
  /** Overall RAIL Score */
  rail_score: {
    /** Score value from 0-10 */
    score: number;
    /** Confidence level from 0-1 */
    confidence: number;
    /** Human-readable summary */
    summary: string;
  };
  /** Overall explanation */
  explanation: string;
  /** Individual dimension scores keyed by dimension name */
  dimension_scores: Record<string, DimensionScore>;
  /** Issues found */
  issues?: EvalIssue[];
  /** Improvement suggestions */
  improvement_suggestions?: string[];
  /** Whether the result was served from cache */
  from_cache: boolean;
}

// ─── Safe Regenerate Types ────────────────────────────────────────────────────

/**
 * Regeneration model options
 */
export type RegenerationModel = 'RAIL_Safe_LLM' | 'external';

/**
 * Parameters for POST /railscore/v1/safe-regenerate
 */
export interface SafeRegenerateParams {
  /** Text to evaluate/regenerate (10-10,000 chars) */
  content: string;
  /** "basic" or "deep" */
  mode?: EvaluationMode;
  /** Max regeneration attempts (1-5) */
  maxRegenerations?: number;
  /** "RAIL_Safe_LLM" (server-side) or "external" (client-orchestrated) */
  regenerationModel?: RegenerationModel;
  /** Score/confidence thresholds, e.g. { overall: { score: 8.0, confidence: 0.5 } } */
  thresholds?: Record<string, any>;
  /** Additional context */
  context?: string;
  /** Content domain */
  domain?: ContentDomain;
  /** Use case */
  usecase?: UseCase;
  /** Original user query for context */
  userQuery?: string;
  /** Dimension weights (must sum to 100) */
  weights?: Record<string, number>;
  /** Policy hint, e.g. { on_failure: "return_best" } */
  policyHint?: Record<string, any>;
}

/**
 * Parameters for POST /railscore/v1/safe-regenerate/continue
 */
export interface SafeRegenerateContinueParams {
  /** Session ID from initial response (starts with "sr_") */
  sessionId: string;
  /** Your regenerated content (10-10,000 chars) */
  regeneratedContent: string;
}

/**
 * Iteration record in safe-regenerate history
 */
export interface IterationRecord {
  iteration: number;
  content: string;
  scores: any;
  thresholds_met: boolean;
  failing_dimensions: string[];
  improvement_from_previous: number | null;
  latency_ms: number;
}

/**
 * RAIL prompt for external mode regeneration
 */
export interface RailPrompt {
  system_prompt: string;
  user_prompt: string;
  temperature?: number;
}

/**
 * Result from POST /railscore/v1/safe-regenerate and /safe-regenerate/continue
 */
export interface SafeRegenerateResult {
  /** "passed" | "max_iterations_reached" | "awaiting_regeneration" */
  status: 'passed' | 'max_iterations_reached' | 'awaiting_regeneration';
  /** Original content that was submitted */
  original_content: string;
  /** Credits consumed */
  credits_consumed: number;
  /** Request metadata */
  metadata: {
    req_id: string;
    mode: string;
    total_iterations?: number;
    total_latency_ms?: number;
  };
  /** Credits breakdown */
  credits_breakdown?: {
    evaluations: number;
    regenerations: number;
    total: number;
  };
  /** Best content found (when status is "passed" or "max_iterations_reached") */
  best_content?: string;
  /** Best iteration number */
  best_iteration?: number;
  /** Best scores achieved */
  best_scores?: {
    rail_score: { score: number; confidence?: number; summary?: string };
    dimension_scores: Record<string, { score: number; confidence: number }>;
  };
  /** History of all iterations */
  iteration_history?: IterationRecord[];
  /** Session ID for external mode (starts with "sr_") */
  session_id?: string;
  /** Current iteration number (external mode) */
  iteration?: number;
  /** Remaining iterations (external mode) */
  iterations_remaining?: number;
  /** Current scores (external mode) */
  current_scores?: any;
  /** Prompt for external regeneration */
  rail_prompt?: RailPrompt;
}

// ─── Compliance Types ─────────────────────────────────────────────────────────

/**
 * Supported compliance frameworks (canonical IDs)
 */
export type ComplianceFramework =
  | 'gdpr'
  | 'ccpa'
  | 'hipaa'
  | 'eu_ai_act'
  | 'india_dpdp'
  | 'india_ai_gov';

/**
 * Framework input type including aliases
 */
export type ComplianceFrameworkInput =
  | ComplianceFramework
  | 'ai_act'
  | 'euaia'
  | 'dpdp'
  | 'ai_governance'
  | 'india_ai';

/**
 * Compliance check context
 */
export interface ComplianceContext {
  domain?: string;
  system_type?: string;
  jurisdiction?: string;
  data_subjects?: string;
  decision_type?: string;
  data_types?: string[];
  processing_purpose?: string;
  risk_indicators?: string[];
  cross_border?: boolean;
}

/**
 * Parameters for single-framework compliance check
 */
export interface ComplianceCheckSingleParams {
  /** Text to evaluate (max 50,000 chars) */
  content: string;
  /** Single framework ID */
  framework: ComplianceFrameworkInput;
  /** Context for compliance evaluation */
  context?: ComplianceContext;
  /** Use strict mode (8.5 threshold instead of 7.0) */
  strictMode?: boolean;
  /** Include per-dimension explanations */
  includeExplanations?: boolean;
}

/**
 * Parameters for multi-framework compliance check
 */
export interface ComplianceCheckMultiParams {
  /** Text to evaluate (max 50,000 chars) */
  content: string;
  /** List of framework IDs (max 5) */
  frameworks: ComplianceFrameworkInput[];
  /** Context for compliance evaluation */
  context?: ComplianceContext;
  /** Use strict mode (8.5 threshold instead of 7.0) */
  strictMode?: boolean;
  /** Include per-dimension explanations */
  includeExplanations?: boolean;
}

/**
 * Union type for compliance check parameters
 */
export type ComplianceCheckParams = ComplianceCheckSingleParams | ComplianceCheckMultiParams;

/**
 * Requirement evaluation result
 */
export interface RequirementResult {
  requirement_id: string;
  requirement: string;
  article: string;
  reference_url: string;
  status: string;
  score: number;
  confidence: number;
  threshold: number;
  ai_specific: boolean;
  dimension_sources: string[];
  evaluation_method: string;
  issue?: string;
  penalty_exposure?: string;
}

/**
 * Compliance issue
 */
export interface ComplianceIssue {
  id: string;
  description: string;
  dimension: string;
  severity: string;
  requirement: string;
  article: string;
  reference_url: string;
  remediation_effort: string;
  remediation_deadline_days?: number;
}

/**
 * Risk classification detail (EU AI Act only)
 */
export interface RiskClassificationDetail {
  tier: string;
  basis: string;
  obligations?: string[];
}

/**
 * Single-framework compliance result
 */
export interface ComplianceResult {
  framework: string;
  framework_version: string;
  framework_url: string;
  evaluated_at: string;
  compliance_score: {
    score: number;
    confidence: number;
    /** "Critical" | "Poor" | "Fair" | "Good" | "Excellent" */
    label: string;
    summary: string;
  };
  dimension_scores: Record<string, DimensionScore>;
  requirements_checked: number;
  requirements_passed: number;
  requirements_failed: number;
  requirements_warned: number;
  requirements: RequirementResult[];
  issues: ComplianceIssue[];
  improvement_suggestions: string[];
  risk_classification_detail?: RiskClassificationDetail;
  from_cache: boolean;
  credits?: number;
}

/**
 * Multi-framework compliance result
 */
export interface MultiComplianceResult {
  results: Record<string, ComplianceResult>;
  cross_framework_summary: {
    frameworks_evaluated: number;
    average_score: number;
    weakest_framework: string;
    weakest_score: number;
    credits?: number;
  };
}

// ─── Health Types ─────────────────────────────────────────────────────────────

/**
 * Health check response from GET /health
 */
export interface HealthCheckResponse {
  /** Service status, e.g. "healthy" */
  status: string;
  /** Service name, e.g. "rail-score-engine" */
  service: string;
}

// ─── Utility Types ────────────────────────────────────────────────────────────

/**
 * Score label indicating quality tier
 */
export type ScoreLabel = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';

// ─── Secondary Module Types ──────────────────────────────────────────────────

/**
 * Configuration for multi-turn sessions
 */
export interface SessionConfig {
  /** How often to use deep evaluation (every N turns) */
  deepEvalFrequency?: number;
  /** Number of recent turns to keep in context */
  contextWindow?: number;
  /** Minimum quality threshold - triggers deep eval when score dips below */
  qualityThreshold?: number;
}

/**
 * Metrics for a multi-turn session
 */
export interface SessionMetrics {
  /** Average score across all turns */
  averageScore: number;
  /** Minimum score observed */
  minScore: number;
  /** Maximum score observed */
  maxScore: number;
  /** Total number of turns */
  turnCount: number;
  /** Average score per dimension across all turns */
  dimensionAverages: Record<string, number>;
  /** Percentage of turns that passed the quality threshold */
  passingRate: number;
}

/**
 * Policy enforcement mode
 */
export type PolicyMode = 'LOG_ONLY' | 'BLOCK' | 'REGENERATE' | 'CUSTOM';

/**
 * Configuration for the policy engine
 */
export interface PolicyConfig {
  /** Enforcement mode */
  mode: PolicyMode;
  /** Score thresholds per dimension (scores below trigger policy action) */
  thresholds: Record<string, number>;
  /** Custom callback for CUSTOM mode */
  customCallback?: (content: string, result: EvalResult) => Promise<string | null>;
}

/**
 * Configuration for middleware wrapping
 */
export interface MiddlewareConfig {
  /** Thresholds for input content evaluation */
  inputThresholds?: Record<string, number>;
  /** Thresholds for output content evaluation */
  outputThresholds?: Record<string, number>;
  /** Callback when input is evaluated */
  onInputEval?: (result: EvalResult) => void;
  /** Callback when output is evaluated */
  onOutputEval?: (result: EvalResult) => void;
  /** Policy enforcement config for output */
  policy?: PolicyConfig;
}
