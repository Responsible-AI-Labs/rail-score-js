/**
 * RAIL Score JavaScript/TypeScript SDK v2.2.1
 *
 * Official SDK for the RAIL Score API - Evaluate and generate responsible AI content
 *
 * @packageDocumentation
 */

// Main client
export { RailScore } from './client';

// Session, Policy, Middleware
export { RAILSession } from './session';
export { PolicyEngine } from './policy';
export { RAILMiddleware } from './middleware';

// LLM provider wrappers
export { RAILOpenAI } from './providers/openai';
export type { RAILOpenAIConfig } from './providers/openai';
export { RAILAnthropic } from './providers/anthropic';
export type { RAILAnthropicConfig } from './providers/anthropic';
export { RAILGemini } from './providers/gemini';
export type { RAILGeminiConfig } from './providers/gemini';

// Observability integrations
export { RAILLangfuse } from './observability/langfuse';
export { RAILGuardrail } from './observability/guardrail';
export type { RAILGuardrailConfig, GuardResult } from './observability/guardrail';

// Types
export type {
  RailScoreConfig,
  Dimension,
  DimensionInput,
  DimensionScore,
  EvaluationMode,
  ContentDomain,
  UseCase,
  EvalParams,
  EvalIssue,
  EvalResult,
  RegenerationModel,
  SafeRegenerateParams,
  SafeRegenerateContinueParams,
  SafeRegenerateResult,
  IterationRecord,
  RailPrompt,
  ComplianceFramework,
  ComplianceFrameworkInput,
  ComplianceContext,
  ComplianceCheckSingleParams,
  ComplianceCheckMultiParams,
  ComplianceCheckParams,
  RequirementResult,
  ComplianceIssue,
  RiskClassificationDetail,
  ComplianceResult,
  MultiComplianceResult,
  HealthCheckResponse,
  ScoreLabel,
  SessionConfig,
  SessionMetrics,
  PolicyMode,
  PolicyConfig,
  MiddlewareConfig,
} from './types';

// Errors
export {
  RailScoreError,
  AuthenticationError,
  InsufficientCreditsError,
  ValidationError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  ServerError,
  ContentTooLongError,
  InsufficientTierError,
  ContentTooHarmfulError,
  EvaluationFailedError,
  ServiceUnavailableError,
  SessionExpiredError,
  NotImplementedByServerError,
  RAILBlockedError,
} from './errors';

// Utilities
export {
  formatScore,
  getScoreColor,
  getScoreGrade,
  getScoreLabel,
  validateWeights,
  normalizeWeights,
  normalizeWeightsTo100,
  normalizeDimensionName,
  resolveFrameworkAlias,
  validateWeightsSum100,
  calculateWeightedScore,
  getLowestScoringDimension,
  getHighestScoringDimension,
  getDimensionsBelowThreshold,
  formatDimensionName,
  aggregateScores,
  isPassing,
  confidenceWeightedScore,
} from './utils';

// Default export
import { RailScore } from './client';
export default RailScore;
