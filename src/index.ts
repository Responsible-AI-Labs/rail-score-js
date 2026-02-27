/**
 * RAIL Score JavaScript/TypeScript SDK
 *
 * Official SDK for the RAIL Score API - Evaluate and generate responsible AI content
 *
 * @packageDocumentation
 */

// Main client
export { RailScore } from './client';

// API modules
export { Evaluation } from './evaluation';
export { Generation } from './generation';
export { Compliance } from './compliance';

// New feature modules
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
  RailScoreValue,
  DimensionScore,
  EvaluationMetadata,
  EvaluationResult,
  EvaluationOptions,
  EvaluationMode,
  BatchEvaluationResult,
  BatchItem,
  ContextChunk,
  RagEvaluationResult,
  Dimension,
  DimensionInput,
  ScoreLabel,
  GenerationOptions,
  GenerationResult,
  ComplianceFramework,
  ComplianceCheckOptions,
  ComplianceResult,
  ComplianceRequirement,
  ComplianceViolation,
  ProtectedEvaluationResult,
  ProtectedRegenerateResult,
  CreditBalance,
  UsageRecord,
  UsageStats,
  HealthCheckResponse,
  VersionInfo,
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
