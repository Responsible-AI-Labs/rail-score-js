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
 * Score for an individual dimension with explanation
 */
export interface DimensionScore extends RailScoreValue {
  /** Explanation of the score */
  explanation: string;
  /** List of identified issues (if any) */
  issues?: string[];
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
 * Options for evaluation requests
 */
export interface EvaluationOptions {
  /** Custom weights for dimensions */
  weights?: Record<string, number>;
  /** Service tier to use */
  tier?: 'fast' | 'balanced' | 'advanced';
  /** Specific dimensions to evaluate */
  dimensions?: Dimension[];
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
  | 'legal_compliance'
  | 'user_impact';

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
  | 'nist';

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
