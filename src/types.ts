/**
 * Configuration options for initializing the RailScore client
 */
export interface RailScoreConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for the API (defaults to https://api.responsibleailabs.ai) */
  baseUrl?: string;
  /** Request timeout in milliseconds (defaults to 60000) */
  timeout?: number;
}

/**
 * RAIL Score value with confidence level
 */
export interface RailScoreValue {
  /** Score value from 0-10 */
  score: number;
  /** Confidence level from 0-1 */
  confidence: number;
}

/**
 * Score label indicating quality tier
 */
export type ScoreLabel = 'Excellent' | 'Good' | 'Needs improvement' | 'Poor' | 'Critical';

/**
 * Score for an individual dimension with explanation
 */
export interface DimensionScore extends RailScoreValue {
  /** Explanation of the score */
  explanation: string;
  /** List of identified issues (if any) */
  issues?: string[];
  /** Human-readable score label */
  label?: ScoreLabel;
}

/**
 * Metadata about the evaluation request
 */
export interface EvaluationMetadata {
  /** Request ID for tracking */
  reqId: string;
  /** Service tier used (fast, balanced, advanced) */
  tier: string;
  /** Time spent in queue (milliseconds) */
  queueWaitTimeMs: number;
  /** Processing time (milliseconds) */
  processingTimeMs: number;
  /** Credits consumed by this request */
  creditsConsumed: number;
  /** Timestamp of the evaluation */
  timestamp: string;
}

/**
 * Complete evaluation result
 */
export interface EvaluationResult {
  /** Overall RAIL Score */
  railScore: RailScoreValue;
  /** Individual dimension scores */
  scores: Record<string, DimensionScore>;
  /** Request metadata */
  metadata: EvaluationMetadata;
}

/**
 * Evaluation mode controlling depth of analysis
 */
export type EvaluationMode = 'basic' | 'deep';

/**
 * Options for evaluation requests
 */
export interface EvaluationOptions {
  /** Custom weights for dimensions */
  weights?: Record<string, number>;
  /** Service tier to use */
  tier?: 'fast' | 'balanced' | 'advanced';
  /** Specific dimensions to evaluate */
  dimensions?: Dimension[];
  /** Evaluation mode (basic or deep analysis) */
  mode?: EvaluationMode;
  /** Content domain for specialized scoring */
  domain?: string;
  /** Specific use case context */
  usecase?: string;
}

/**
 * Batch evaluation result
 */
export interface BatchEvaluationResult {
  /** Array of evaluation results */
  results: EvaluationResult[];
  /** Total number of items processed */
  totalItems: number;
  /** Number of successful evaluations */
  successful: number;
  /** Number of failed evaluations */
  failed: number;
}

/**
 * Batch evaluation item
 */
export interface BatchItem {
  /** Content to evaluate */
  content: string;
  /** Optional item ID for tracking */
  id?: string;
}

/**
 * RAG evaluation context chunk
 */
export interface ContextChunk {
  /** Content of the context chunk */
  content: string;
  /** Optional source/reference */
  source?: string;
  /** Optional relevance score */
  relevance?: number;
}

/**
 * RAG evaluation result
 */
export interface RagEvaluationResult {
  /** Overall RAG quality score */
  ragScore: RailScoreValue;
  /** Individual metric scores */
  metrics: {
    /** Context relevance score */
    contextRelevance: RailScoreValue;
    /** Answer faithfulness score */
    faithfulness: RailScoreValue;
    /** Answer relevance score */
    answerRelevance: RailScoreValue;
  };
  /** Detailed analysis */
  analysis: {
    /** Issues found in the RAG response */
    issues: string[];
    /** Suggestions for improvement */
    suggestions: string[];
  };
  /** Request metadata */
  metadata: EvaluationMetadata;
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
 * Input dimension type that accepts both current and deprecated names
 * Allows 'legal_compliance' for backward compatibility (maps to 'inclusivity')
 */
export type DimensionInput = Dimension | 'legal_compliance';

/**
 * Generation options
 */
export interface GenerationOptions {
  /** Target RAIL Score (0-10) */
  targetScore?: number;
  /** Dimensions to optimize for */
  dimensions?: Dimension[];
  /** Maximum number of iterations */
  maxIterations?: number;
  /** Temperature for generation */
  temperature?: number;
}

/**
 * Generation result
 */
export interface GenerationResult {
  /** Generated content */
  content: string;
  /** RAIL Score of generated content */
  railScore: RailScoreValue;
  /** Dimension scores */
  scores: Record<string, DimensionScore>;
  /** Number of iterations used */
  iterations: number;
  /** Request metadata */
  metadata: EvaluationMetadata;
}

/**
 * Compliance framework types
 */
export type ComplianceFramework =
  | 'gdpr'
  | 'hipaa'
  | 'ccpa'
  | 'sox'
  | 'pci_dss'
  | 'iso27001'
  | 'nist'
  | 'eu_ai_act'
  | 'india_dpdp'
  | 'india_ai_governance';

/**
 * Options for compliance check operations
 */
export interface ComplianceCheckOptions {
  /** Additional context for compliance evaluation */
  context?: string;
  /** Enable strict mode for more rigorous checking */
  strict_mode?: boolean;
}

/**
 * Compliance check result
 */
export interface ComplianceResult {
  /** Framework checked */
  framework: ComplianceFramework;
  /** Overall compliance status */
  compliant: boolean;
  /** Compliance score (0-10) */
  score: number;
  /** Individual requirement results */
  requirements: ComplianceRequirement[];
  /** Violations found */
  violations: ComplianceViolation[];
  /** Recommendations */
  recommendations: string[];
  /** Request metadata */
  metadata: EvaluationMetadata;
}

/**
 * Individual compliance requirement
 */
export interface ComplianceRequirement {
  /** Requirement ID */
  id: string;
  /** Requirement name */
  name: string;
  /** Compliance status */
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
  /** Score for this requirement */
  score: number;
  /** Description */
  description: string;
}

/**
 * Compliance violation
 */
export interface ComplianceViolation {
  /** Violation severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Requirement violated */
  requirement: string;
  /** Description of the violation */
  description: string;
  /** Location in content (if applicable) */
  location?: string;
  /** Remediation suggestion */
  remediation: string;
}

/**
 * Protected evaluation result - extends EvaluationResult with pass/fail info
 */
export interface ProtectedEvaluationResult extends EvaluationResult {
  /** Whether the content passed the protection threshold */
  passed: boolean;
  /** Dimensions that failed the threshold */
  failedDimensions: string[];
}

/**
 * Result from protected content regeneration
 */
export interface ProtectedRegenerateResult {
  /** Regenerated content */
  content: string;
  /** RAIL Score of the regenerated content */
  railScore: RailScoreValue;
  /** Issues that were fixed during regeneration */
  fixedIssues: string[];
}

/**
 * Credit balance information
 */
export interface CreditBalance {
  /** Current balance */
  balance: number;
  /** Total allocated credits */
  totalAllocated: number;
  /** Credits used */
  used: number;
  /** Plan tier */
  tier: string;
  /** Next renewal date */
  renewalDate?: string;
}

/**
 * Usage record
 */
export interface UsageRecord {
  /** Timestamp */
  timestamp: string;
  /** Endpoint used */
  endpoint: string;
  /** Credits consumed */
  creditsConsumed: number;
  /** Request ID */
  reqId: string;
  /** Status */
  status: 'success' | 'failed';
}

/**
 * Usage statistics
 */
export interface UsageStats {
  /** Total records returned */
  total: number;
  /** Usage records */
  records: UsageRecord[];
  /** Date range */
  dateRange: {
    from: string;
    to: string;
  };
  /** Summary statistics */
  summary: {
    totalCredits: number;
    totalRequests: number;
    successRate: number;
  };
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  /** Service status */
  ok: boolean;
  /** API version */
  version: string;
  /** Additional status info */
  status?: string;
}

/**
 * Version information from the API
 */
export interface VersionInfo {
  /** API version string */
  version: string;
  /** Minimum supported SDK version */
  minSdkVersion?: string;
  /** Available features */
  features?: string[];
}

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
  customCallback?: (content: string, result: EvaluationResult) => Promise<string | null>;
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
  onInputEval?: (result: EvaluationResult) => void;
  /** Callback when output is evaluated */
  onOutputEval?: (result: EvaluationResult) => void;
  /** Policy enforcement config for output */
  policy?: PolicyConfig;
}
