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

// Types
export type {
  RailScoreConfig,
  RailScoreValue,
  DimensionScore,
  EvaluationMetadata,
  EvaluationResult,
  EvaluationOptions,
  BatchEvaluationResult,
  BatchItem,
  ContextChunk,
  RagEvaluationResult,
  Dimension,
  GenerationOptions,
  GenerationResult,
  ComplianceFramework,
  ComplianceResult,
  ComplianceRequirement,
  ComplianceViolation,
  CreditBalance,
  UsageRecord,
  UsageStats,
  HealthCheckResponse,
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
} from './errors';

// Utilities
export {
  formatScore,
  getScoreColor,
  getScoreGrade,
  validateWeights,
  normalizeWeights,
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
