import {
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
} from '../src/utils';
import type { EvaluationResult, DimensionScore } from '../src/types';

describe('Utility Functions', () => {
  describe('formatScore', () => {
    it('should format score with default decimals', () => {
      expect(formatScore(8.567)).toBe('8.6');
    });

    it('should format score with custom decimals', () => {
      expect(formatScore(8.567, 2)).toBe('8.57');
      expect(formatScore(8.567, 0)).toBe('9');
    });
  });

  describe('getScoreColor', () => {
    it('should return green for high scores (>= 7.0)', () => {
      expect(getScoreColor(9.0)).toBe('green');
      expect(getScoreColor(7.0)).toBe('green');
    });

    it('should return yellow for medium scores (5.0-6.9)', () => {
      expect(getScoreColor(6.5)).toBe('yellow');
      expect(getScoreColor(5.0)).toBe('yellow');
    });

    it('should return red for low scores (< 5.0)', () => {
      expect(getScoreColor(4.9)).toBe('red');
      expect(getScoreColor(3.0)).toBe('red');
    });
  });

  describe('getScoreGrade', () => {
    it('should return A for scores >= 9.0', () => {
      expect(getScoreGrade(9.5)).toBe('A');
      expect(getScoreGrade(9.0)).toBe('A');
    });

    it('should return A- for scores 8.0-8.9', () => {
      expect(getScoreGrade(8.5)).toBe('A-');
      expect(getScoreGrade(8.0)).toBe('A-');
    });

    it('should return B for scores 7.0-7.9', () => {
      expect(getScoreGrade(7.5)).toBe('B');
      expect(getScoreGrade(7.0)).toBe('B');
    });

    it('should return C for scores 6.0-6.9', () => {
      expect(getScoreGrade(6.5)).toBe('C');
    });

    it('should return D for scores 5.0-5.9', () => {
      expect(getScoreGrade(5.5)).toBe('D');
    });

    it('should return F for scores < 5.0', () => {
      expect(getScoreGrade(4.0)).toBe('F');
    });
  });

  describe('validateWeights', () => {
    it('should return true for valid weights', () => {
      expect(validateWeights({ safety: 0.5, privacy: 0.5 })).toBe(true);
      expect(validateWeights({ a: 0.3, b: 0.3, c: 0.4 })).toBe(true);
    });

    it('should return false for invalid weights', () => {
      expect(validateWeights({ safety: 0.6, privacy: 0.5 })).toBe(false);
      expect(validateWeights({ a: 0.2, b: 0.2 })).toBe(false);
    });

    it('should handle floating point precision', () => {
      expect(validateWeights({ a: 0.1, b: 0.2, c: 0.7 })).toBe(true);
    });
  });

  describe('normalizeWeights', () => {
    it('should normalize weights to sum to 1.0', () => {
      const result = normalizeWeights({ safety: 2, privacy: 1 });
      expect(result.safety).toBeCloseTo(0.667, 2);
      expect(result.privacy).toBeCloseTo(0.333, 2);
    });

    it('should handle equal weights', () => {
      const result = normalizeWeights({ a: 1, b: 1, c: 1 });
      expect(result.a).toBeCloseTo(0.333, 2);
      expect(result.b).toBeCloseTo(0.333, 2);
      expect(result.c).toBeCloseTo(0.333, 2);
    });

    it('should throw error for all-zero weights', () => {
      expect(() => normalizeWeights({ a: 0, b: 0 })).toThrow();
    });
  });

  describe('calculateWeightedScore', () => {
    const scores: Record<string, DimensionScore> = {
      safety: { score: 8.0, confidence: 0.9, explanation: 'Safe', issues: [] },
      privacy: { score: 7.0, confidence: 0.85, explanation: 'Good privacy', issues: [] },
    };

    it('should calculate weighted score with custom weights', () => {
      const result = calculateWeightedScore(scores, { safety: 0.6, privacy: 0.4 });
      expect(result).toBeCloseTo(7.6, 1);
    });

    it('should use equal weights when not provided', () => {
      const result = calculateWeightedScore(scores);
      expect(result).toBeCloseTo(7.5, 1);
    });
  });

  describe('getLowestScoringDimension', () => {
    const mockResult: EvaluationResult = {
      railScore: { score: 8.0, confidence: 0.9 },
      scores: {
        safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
        privacy: { score: 6.5, confidence: 0.85, explanation: 'Needs work', issues: [] },
        fairness: { score: 8.0, confidence: 0.90, explanation: 'Fair', issues: [] },
      },
      metadata: {
        reqId: 'req-1',
        tier: 'balanced',
        queueWaitTimeMs: 10,
        processingTimeMs: 500,
        creditsConsumed: 1,
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    it('should find the lowest scoring dimension', () => {
      const result = getLowestScoringDimension(mockResult);
      expect(result.dimension).toBe('privacy');
      expect(result.score.score).toBe(6.5);
    });
  });

  describe('getHighestScoringDimension', () => {
    const mockResult: EvaluationResult = {
      railScore: { score: 8.0, confidence: 0.9 },
      scores: {
        safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
        privacy: { score: 6.5, confidence: 0.85, explanation: 'Needs work', issues: [] },
        fairness: { score: 8.0, confidence: 0.90, explanation: 'Fair', issues: [] },
      },
      metadata: {
        reqId: 'req-1',
        tier: 'balanced',
        queueWaitTimeMs: 10,
        processingTimeMs: 500,
        creditsConsumed: 1,
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    it('should find the highest scoring dimension', () => {
      const result = getHighestScoringDimension(mockResult);
      expect(result.dimension).toBe('safety');
      expect(result.score.score).toBe(9.0);
    });
  });

  describe('getDimensionsBelowThreshold', () => {
    const mockResult: EvaluationResult = {
      railScore: { score: 7.5, confidence: 0.9 },
      scores: {
        safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
        privacy: { score: 6.5, confidence: 0.85, explanation: 'Needs work', issues: [] },
        fairness: { score: 6.0, confidence: 0.80, explanation: 'Needs improvement', issues: [] },
        transparency: { score: 7.8, confidence: 0.90, explanation: 'Transparent', issues: [] },
      },
      metadata: {
        reqId: 'req-1',
        tier: 'balanced',
        queueWaitTimeMs: 10,
        processingTimeMs: 500,
        creditsConsumed: 1,
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    it('should find dimensions below default threshold (7.0)', () => {
      const result = getDimensionsBelowThreshold(mockResult);
      expect(result).toHaveLength(2);
      expect(result[0].dimension).toBe('fairness'); // Lowest first
      expect(result[1].dimension).toBe('privacy');
    });

    it('should find dimensions below custom threshold', () => {
      const result = getDimensionsBelowThreshold(mockResult, 8.0);
      expect(result).toHaveLength(3);
    });

    it('should return empty array if all above threshold', () => {
      const result = getDimensionsBelowThreshold(mockResult, 5.0);
      expect(result).toHaveLength(0);
    });
  });

  describe('formatDimensionName', () => {
    it('should format single word dimensions', () => {
      expect(formatDimensionName('safety')).toBe('Safety');
      expect(formatDimensionName('privacy')).toBe('Privacy');
    });

    it('should format multi-word dimensions', () => {
      expect(formatDimensionName('legal_compliance')).toBe('Legal Compliance');
      expect(formatDimensionName('user_impact')).toBe('User Impact');
    });
  });

  describe('aggregateScores', () => {
    const mockResults: EvaluationResult[] = [
      {
        railScore: { score: 8.0, confidence: 0.9 },
        scores: {
          safety: { score: 8.5, confidence: 0.95, explanation: 'Safe', issues: [] },
          privacy: { score: 7.5, confidence: 0.85, explanation: 'Good', issues: [] },
        },
        metadata: {
          reqId: 'req-1',
          tier: 'balanced',
          queueWaitTimeMs: 10,
          processingTimeMs: 500,
          creditsConsumed: 1,
          timestamp: '2024-01-01T00:00:00Z',
        },
      },
      {
        railScore: { score: 7.0, confidence: 0.85 },
        scores: {
          safety: { score: 7.5, confidence: 0.90, explanation: 'Safe', issues: [] },
          privacy: { score: 6.5, confidence: 0.80, explanation: 'Needs work', issues: [] },
        },
        metadata: {
          reqId: 'req-2',
          tier: 'balanced',
          queueWaitTimeMs: 10,
          processingTimeMs: 500,
          creditsConsumed: 1,
          timestamp: '2024-01-01T00:00:00Z',
        },
      },
    ];

    it('should aggregate scores correctly', () => {
      const stats = aggregateScores(mockResults);

      expect(stats.totalEvaluations).toBe(2);
      expect(stats.averageScore).toBe(7.5);
      expect(stats.minScore).toBe(7.0);
      expect(stats.maxScore).toBe(8.0);
      expect(stats.averageDimensionScores.safety).toBe(8.0);
      expect(stats.averageDimensionScores.privacy).toBe(7.0);
    });

    it('should throw error on empty results array', () => {
      expect(() => aggregateScores([])).toThrow();
    });
  });

  describe('isPassing', () => {
    it('should return true for passing scores with default threshold', () => {
      expect(isPassing(8.0)).toBe(true);
      expect(isPassing(7.0)).toBe(true);
    });

    it('should return false for failing scores with default threshold', () => {
      expect(isPassing(6.9)).toBe(false);
      expect(isPassing(5.0)).toBe(false);
    });

    it('should use custom threshold', () => {
      expect(isPassing(8.0, 8.5)).toBe(false);
      expect(isPassing(9.0, 8.5)).toBe(true);
    });

    it('should handle exact threshold match', () => {
      expect(isPassing(7.0, 7.0)).toBe(true);
    });
  });

  describe('confidenceWeightedScore', () => {
    it('should calculate confidence-weighted score', () => {
      expect(confidenceWeightedScore(9.0, 0.9)).toBeCloseTo(8.1, 1);
      expect(confidenceWeightedScore(8.0, 0.5)).toBeCloseTo(4.0, 1);
    });

    it('should return 0 for zero confidence', () => {
      expect(confidenceWeightedScore(10.0, 0)).toBe(0);
    });

    it('should return full score for confidence of 1', () => {
      expect(confidenceWeightedScore(8.5, 1.0)).toBe(8.5);
    });
  });
});
