import type { Dimension, DimensionScore, EvaluationResult } from './types';

/**
 * Utility functions for working with RAIL Score data
 */

/**
 * Format a RAIL Score for display
 *
 * @param score - Score value (0-10)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted score string
 *
 * @example
 * ```typescript
 * formatScore(8.567, 2); // "8.57"
 * formatScore(7.5); // "7.5"
 * ```
 */
export function formatScore(score: number, decimals: number = 1): string {
  return score.toFixed(decimals);
}

/**
 * Get a color indicator based on score
 *
 * @param score - Score value (0-10)
 * @returns Color name (red, yellow, green)
 *
 * @example
 * ```typescript
 * getScoreColor(9.0); // "green"
 * getScoreColor(5.5); // "yellow"
 * getScoreColor(3.0); // "red"
 * ```
 */
export function getScoreColor(score: number): 'red' | 'yellow' | 'green' {
  if (score >= 7.0) return 'green';
  if (score >= 5.0) return 'yellow';
  return 'red';
}

/**
 * Get a letter grade based on score
 *
 * @param score - Score value (0-10)
 * @returns Letter grade (A-F)
 *
 * @example
 * ```typescript
 * getScoreGrade(9.5); // "A"
 * getScoreGrade(7.0); // "B"
 * getScoreGrade(4.0); // "D"
 * ```
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
 * Validate dimension weights sum to 1.0
 *
 * @param weights - Dimension weights object
 * @returns True if weights are valid
 *
 * @example
 * ```typescript
 * validateWeights({ safety: 0.5, privacy: 0.5 }); // true
 * validateWeights({ safety: 0.6, privacy: 0.5 }); // false
 * ```
 */
export function validateWeights(weights: Record<string, number>): boolean {
  const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);
  return Math.abs(sum - 1.0) < 0.0001; // Allow for floating point precision
}

/**
 * Normalize weights to sum to 1.0
 *
 * @param weights - Dimension weights object
 * @returns Normalized weights
 *
 * @example
 * ```typescript
 * normalizeWeights({ safety: 2, privacy: 1 }); // { safety: 0.667, privacy: 0.333 }
 * ```
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
 * Calculate weighted average of dimension scores
 *
 * @param scores - Dimension scores
 * @param weights - Optional weights (defaults to equal weights)
 * @returns Weighted average score
 *
 * @example
 * ```typescript
 * calculateWeightedScore(
 *   { safety: { score: 8, confidence: 0.9 }, privacy: { score: 7, confidence: 0.85 } },
 *   { safety: 0.6, privacy: 0.4 }
 * ); // 7.6
 * ```
 */
export function calculateWeightedScore(
  scores: Record<string, DimensionScore>,
  weights?: Record<string, number>
): number {
  const dimensions = Object.keys(scores);

  // Use equal weights if not provided
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
 * Get the lowest scoring dimension
 *
 * @param result - Evaluation result
 * @returns Dimension name and score of the lowest scoring dimension
 *
 * @example
 * ```typescript
 * const lowest = getLowestScoringDimension(evaluationResult);
 * console.log(`Weakest area: ${lowest.dimension} (${lowest.score}/10)`);
 * ```
 */
export function getLowestScoringDimension(
  result: EvaluationResult
): { dimension: string; score: DimensionScore } {
  let lowestDimension = '';
  let lowestScore: DimensionScore | null = null;

  for (const [dimension, score] of Object.entries(result.scores)) {
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
 * Get the highest scoring dimension
 *
 * @param result - Evaluation result
 * @returns Dimension name and score of the highest scoring dimension
 *
 * @example
 * ```typescript
 * const highest = getHighestScoringDimension(evaluationResult);
 * console.log(`Strongest area: ${highest.dimension} (${highest.score}/10)`);
 * ```
 */
export function getHighestScoringDimension(
  result: EvaluationResult
): { dimension: string; score: DimensionScore } {
  let highestDimension = '';
  let highestScore: DimensionScore | null = null;

  for (const [dimension, score] of Object.entries(result.scores)) {
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
 *
 * @param result - Evaluation result
 * @param threshold - Minimum acceptable score (default: 7.0)
 * @returns Array of dimensions below threshold with their scores
 *
 * @example
 * ```typescript
 * const failing = getDimensionsBelowThreshold(result, 7.0);
 * failing.forEach(({ dimension, score }) => {
 *   console.log(`${dimension} needs improvement: ${score.score}/10`);
 * });
 * ```
 */
export function getDimensionsBelowThreshold(
  result: EvaluationResult,
  threshold: number = 7.0
): Array<{ dimension: string; score: DimensionScore }> {
  const belowThreshold: Array<{ dimension: string; score: DimensionScore }> = [];

  for (const [dimension, score] of Object.entries(result.scores)) {
    if (score.score < threshold) {
      belowThreshold.push({ dimension, score });
    }
  }

  // Sort by score (lowest first)
  belowThreshold.sort((a, b) => a.score.score - b.score.score);

  return belowThreshold;
}

/**
 * Format dimension name for display
 *
 * @param dimension - Dimension identifier
 * @returns Human-readable dimension name
 *
 * @example
 * ```typescript
 * formatDimensionName('legal_compliance'); // "Legal Compliance"
 * formatDimensionName('safety'); // "Safety"
 * ```
 */
export function formatDimensionName(dimension: string): string {
  return dimension
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Aggregate scores from multiple evaluation results
 *
 * @param results - Array of evaluation results
 * @returns Aggregated statistics
 *
 * @example
 * ```typescript
 * const stats = aggregateScores([result1, result2, result3]);
 * console.log(`Average score: ${stats.averageScore}`);
 * console.log(`Score range: ${stats.minScore} - ${stats.maxScore}`);
 * ```
 */
export function aggregateScores(results: EvaluationResult[]): {
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
    const score = result.railScore.score;
    totalScore += score;
    minScore = Math.min(minScore, score);
    maxScore = Math.max(maxScore, score);

    // Aggregate dimension scores
    for (const [dimension, dimScore] of Object.entries(result.scores)) {
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
 *
 * @param score - Score value
 * @param threshold - Passing threshold (default: 7.0)
 * @returns True if score meets or exceeds threshold
 *
 * @example
 * ```typescript
 * isPassing(8.5); // true
 * isPassing(6.0); // false
 * isPassing(7.0, 7.0); // true
 * ```
 */
export function isPassing(score: number, threshold: number = 7.0): boolean {
  return score >= threshold;
}

/**
 * Calculate confidence-weighted score
 *
 * Adjusts score based on confidence level
 *
 * @param score - Score value
 * @param confidence - Confidence value (0-1)
 * @returns Confidence-weighted score
 *
 * @example
 * ```typescript
 * confidenceWeightedScore(9.0, 0.9); // ~8.1
 * confidenceWeightedScore(9.0, 0.5); // ~4.5
 * ```
 */
export function confidenceWeightedScore(
  score: number,
  confidence: number
): number {
  return score * confidence;
}
