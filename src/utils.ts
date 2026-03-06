import type {
  Dimension,
  DimensionInput,
  DimensionScore,
  EvalResult,
  ScoreLabel,
  ComplianceFrameworkInput,
  ComplianceFramework,
} from './types';

/** Tracks whether the legal_compliance deprecation warning has been emitted */
let _legalComplianceWarned = false;

/**
 * Get a human-readable label for a score value
 *
 * @param score - Score value (0-10)
 * @returns Score label
 */
export function getScoreLabel(score: number): ScoreLabel {
  if (score >= 8.0) return 'Excellent';
  if (score >= 6.0) return 'Good';
  if (score >= 4.0) return 'Fair';
  if (score >= 2.0) return 'Poor';
  return 'Critical';
}

/**
 * Normalize a dimension name, mapping deprecated names to their current equivalents.
 * Emits a deprecation warning (once) when 'legal_compliance' is used.
 */
export function normalizeDimensionName(dim: DimensionInput): Dimension {
  if (dim === 'legal_compliance') {
    if (!_legalComplianceWarned) {
      console.warn(
        '[RAIL Score] Dimension "legal_compliance" is deprecated. Use "inclusivity" instead.'
      );
      _legalComplianceWarned = true;
    }
    return 'inclusivity';
  }
  return dim;
}

/**
 * Reset the deprecation warning state (for testing purposes)
 * @internal
 */
export function _resetDeprecationWarnings(): void {
  _legalComplianceWarned = false;
}

/**
 * Framework alias mapping
 */
const FRAMEWORK_ALIASES: Record<string, ComplianceFramework> = {
  ai_act: 'eu_ai_act',
  euaia: 'eu_ai_act',
  dpdp: 'india_dpdp',
  ai_governance: 'india_ai_gov',
  india_ai: 'india_ai_gov',
};

/**
 * Resolve a framework alias to its canonical ID.
 */
export function resolveFrameworkAlias(framework: ComplianceFrameworkInput): ComplianceFramework {
  return FRAMEWORK_ALIASES[framework] || framework as ComplianceFramework;
}

/**
 * Validate that weights sum to 100. Throws if they don't.
 */
export function validateWeightsSum100(weights: Record<string, number>): void {
  const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);
  if (Math.abs(sum - 100) > 1.0) {
    throw new Error(`Weights must sum to 100. Current sum: ${sum}`);
  }
}

/**
 * Validate dimension weights sum to 100.
 */
export function validateWeights(weights: Record<string, number>): boolean {
  const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);
  return Math.abs(sum - 100) < 1.0;
}

/**
 * Normalize weights to sum to 100.
 * If weights already sum to ~100, returns them unchanged.
 * If weights sum to ~1.0, multiplies by 100.
 */
export function normalizeWeightsTo100(weights: Record<string, number>): Record<string, number> {
  const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);

  if (Math.abs(sum - 100) < 1.0) {
    return weights;
  }

  if (Math.abs(sum - 1.0) < 0.01) {
    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(weights)) {
      normalized[key] = value * 100;
    }
    return normalized;
  }

  return weights;
}

/**
 * Normalize weights to sum to 1.0 (for client-side calculations)
 */
export function normalizeWeights(
  weights: Record<string, number>
): Record<string, number> {
  const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);

  if (sum === 0) {
    throw new Error('Weights cannot all be zero');
  }

  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(weights)) {
    normalized[key] = value / sum;
  }

  return normalized;
}

/**
 * Format a RAIL Score for display
 */
export function formatScore(score: number, decimals: number = 1): string {
  return score.toFixed(decimals);
}

/**
 * Get a color indicator based on score
 */
export function getScoreColor(score: number): 'red' | 'yellow' | 'green' {
  if (score >= 7.0) return 'green';
  if (score >= 5.0) return 'yellow';
  return 'red';
}

/**
 * Get a letter grade based on score
 */
export function getScoreGrade(score: number): string {
  if (score >= 9.0) return 'A';
  if (score >= 8.0) return 'A-';
  if (score >= 7.0) return 'B';
  if (score >= 6.0) return 'C';
  if (score >= 5.0) return 'D';
  return 'F';
}

/**
 * Calculate weighted average of dimension scores
 */
export function calculateWeightedScore(
  scores: Record<string, DimensionScore>,
  weights?: Record<string, number>
): number {
  const dimensions = Object.keys(scores);
  const actualWeights = weights ||
    Object.fromEntries(dimensions.map(d => [d, 1 / dimensions.length]));

  let totalScore = 0;
  for (const [dimension, score] of Object.entries(scores)) {
    const weight = actualWeights[dimension] || 0;
    totalScore += score.score * weight;
  }

  return totalScore;
}

/**
 * Get the lowest scoring dimension from an eval result
 */
export function getLowestScoringDimension(
  result: EvalResult
): { dimension: string; score: DimensionScore } {
  let lowestDimension = '';
  let lowestScore: DimensionScore | null = null;

  for (const [dimension, score] of Object.entries(result.dimension_scores)) {
    if (!lowestScore || score.score < lowestScore.score) {
      lowestDimension = dimension;
      lowestScore = score;
    }
  }

  return {
    dimension: lowestDimension,
    score: lowestScore!,
  };
}

/**
 * Get the highest scoring dimension from an eval result
 */
export function getHighestScoringDimension(
  result: EvalResult
): { dimension: string; score: DimensionScore } {
  let highestDimension = '';
  let highestScore: DimensionScore | null = null;

  for (const [dimension, score] of Object.entries(result.dimension_scores)) {
    if (!highestScore || score.score > highestScore.score) {
      highestDimension = dimension;
      highestScore = score;
    }
  }

  return {
    dimension: highestDimension,
    score: highestScore!,
  };
}

/**
 * Filter dimensions below a threshold score
 */
export function getDimensionsBelowThreshold(
  result: EvalResult,
  threshold: number = 7.0
): Array<{ dimension: string; score: DimensionScore }> {
  const belowThreshold: Array<{ dimension: string; score: DimensionScore }> = [];

  for (const [dimension, score] of Object.entries(result.dimension_scores)) {
    if (score.score < threshold) {
      belowThreshold.push({ dimension, score });
    }
  }

  belowThreshold.sort((a, b) => a.score.score - b.score.score);

  return belowThreshold;
}

/**
 * Format dimension name for display
 */
export function formatDimensionName(dimension: string): string {
  return dimension
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Aggregate scores from multiple evaluation results
 */
export function aggregateScores(results: EvalResult[]): {
  averageScore: number;
  minScore: number;
  maxScore: number;
  totalEvaluations: number;
  averageDimensionScores: Record<string, number>;
} {
  if (results.length === 0) {
    throw new Error('Cannot aggregate empty results array');
  }

  let totalScore = 0;
  let minScore = Infinity;
  let maxScore = -Infinity;
  const dimensionTotals: Record<string, { total: number; count: number }> = {};

  for (const result of results) {
    const score = result.rail_score.score;
    totalScore += score;
    minScore = Math.min(minScore, score);
    maxScore = Math.max(maxScore, score);

    for (const [dimension, dimScore] of Object.entries(result.dimension_scores)) {
      if (!dimensionTotals[dimension]) {
        dimensionTotals[dimension] = { total: 0, count: 0 };
      }
      dimensionTotals[dimension].total += dimScore.score;
      dimensionTotals[dimension].count += 1;
    }
  }

  const averageDimensionScores: Record<string, number> = {};
  for (const [dimension, data] of Object.entries(dimensionTotals)) {
    averageDimensionScores[dimension] = data.total / data.count;
  }

  return {
    averageScore: totalScore / results.length,
    minScore,
    maxScore,
    totalEvaluations: results.length,
    averageDimensionScores,
  };
}

/**
 * Check if a score indicates passing threshold
 */
export function isPassing(score: number, threshold: number = 7.0): boolean {
  return score >= threshold;
}

/**
 * Calculate confidence-weighted score
 */
export function confidenceWeightedScore(
  score: number,
  confidence: number
): number {
  return score * confidence;
}
