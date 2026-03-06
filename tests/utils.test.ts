import {
  formatScore,
  getScoreColor,
  getScoreGrade,
  getScoreLabel,
  validateWeights,
  normalizeWeights,
  normalizeWeightsTo100,
  normalizeDimensionName,
  _resetDeprecationWarnings,
  calculateWeightedScore,
  getLowestScoringDimension,
  getHighestScoringDimension,
  getDimensionsBelowThreshold,
  formatDimensionName,
  aggregateScores,
  isPassing,
  confidenceWeightedScore,
  resolveFrameworkAlias,
  validateWeightsSum100,
} from '../src/utils';
import type { EvalResult, DimensionScore } from '../src/types';

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

  describe('getScoreLabel', () => {
    it('should return Excellent for scores >= 8', () => {
      expect(getScoreLabel(10.0)).toBe('Excellent');
      expect(getScoreLabel(8.0)).toBe('Excellent');
      expect(getScoreLabel(9.5)).toBe('Excellent');
    });

    it('should return Good for scores >= 6 and < 8', () => {
      expect(getScoreLabel(7.9)).toBe('Good');
      expect(getScoreLabel(6.0)).toBe('Good');
      expect(getScoreLabel(7.0)).toBe('Good');
    });

    it('should return Fair for scores >= 4 and < 6', () => {
      expect(getScoreLabel(5.9)).toBe('Fair');
      expect(getScoreLabel(4.0)).toBe('Fair');
      expect(getScoreLabel(5.0)).toBe('Fair');
    });

    it('should return Poor for scores >= 2 and < 4', () => {
      expect(getScoreLabel(3.9)).toBe('Poor');
      expect(getScoreLabel(2.0)).toBe('Poor');
      expect(getScoreLabel(3.0)).toBe('Poor');
    });

    it('should return Critical for scores < 2', () => {
      expect(getScoreLabel(1.9)).toBe('Critical');
      expect(getScoreLabel(0.0)).toBe('Critical');
      expect(getScoreLabel(1.0)).toBe('Critical');
    });
  });

  describe('validateWeights', () => {
    it('should return true for valid weights summing to 100', () => {
      expect(validateWeights({ safety: 50, privacy: 50 })).toBe(true);
      expect(validateWeights({ a: 30, b: 30, c: 40 })).toBe(true);
    });

    it('should return false for invalid weights', () => {
      expect(validateWeights({ safety: 60, privacy: 50 })).toBe(false);
      expect(validateWeights({ a: 20, b: 20 })).toBe(false);
    });

    it('should handle floating point precision', () => {
      expect(validateWeights({ a: 33.3, b: 33.3, c: 33.4 })).toBe(true);
    });
  });

  describe('validateWeightsSum100', () => {
    it('should not throw for valid weights summing to 100', () => {
      expect(() => validateWeightsSum100({ safety: 50, privacy: 50 })).not.toThrow();
    });

    it('should throw for weights not summing to 100', () => {
      expect(() => validateWeightsSum100({ safety: 30, privacy: 30 })).toThrow();
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

  describe('normalizeWeightsTo100', () => {
    it('should pass through weights that already sum to 100', () => {
      const input = { safety: 60, privacy: 40 };
      const result = normalizeWeightsTo100(input);
      expect(result.safety).toBe(60);
      expect(result.privacy).toBe(40);
    });

    it('should convert sum-to-1.0 weights to sum-to-100', () => {
      const result = normalizeWeightsTo100({ safety: 0.6, privacy: 0.4 });
      expect(result.safety).toBeCloseTo(60, 0);
      expect(result.privacy).toBeCloseTo(40, 0);
    });

    it('should handle uneven sum-to-100 weights', () => {
      const result = normalizeWeightsTo100({ a: 70, b: 30 });
      expect(result.a).toBe(70);
      expect(result.b).toBe(30);
    });
  });

  describe('resolveFrameworkAlias', () => {
    it('should resolve ai_act to eu_ai_act', () => {
      expect(resolveFrameworkAlias('ai_act')).toBe('eu_ai_act');
    });

    it('should resolve euaia to eu_ai_act', () => {
      expect(resolveFrameworkAlias('euaia')).toBe('eu_ai_act');
    });

    it('should resolve dpdp to india_dpdp', () => {
      expect(resolveFrameworkAlias('dpdp')).toBe('india_dpdp');
    });

    it('should resolve ai_governance to india_ai_gov', () => {
      expect(resolveFrameworkAlias('ai_governance')).toBe('india_ai_gov');
    });

    it('should pass through canonical framework names', () => {
      expect(resolveFrameworkAlias('gdpr')).toBe('gdpr');
      expect(resolveFrameworkAlias('ccpa')).toBe('ccpa');
      expect(resolveFrameworkAlias('hipaa')).toBe('hipaa');
    });
  });

  describe('normalizeDimensionName', () => {
    beforeEach(() => {
      _resetDeprecationWarnings();
    });

    it('should map legal_compliance to inclusivity', () => {
      const result = normalizeDimensionName('legal_compliance');
      expect(result).toBe('inclusivity');
    });

    it('should pass through standard dimension names unchanged', () => {
      expect(normalizeDimensionName('safety')).toBe('safety');
      expect(normalizeDimensionName('privacy')).toBe('privacy');
      expect(normalizeDimensionName('fairness')).toBe('fairness');
      expect(normalizeDimensionName('inclusivity')).toBe('inclusivity');
    });

    it('should emit deprecation warning for legal_compliance', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      normalizeDimensionName('legal_compliance');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('legal_compliance')
      );
      warnSpy.mockRestore();
    });

    it('should only emit deprecation warning once', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      normalizeDimensionName('legal_compliance');
      normalizeDimensionName('legal_compliance');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });

  describe('_resetDeprecationWarnings', () => {
    it('should allow deprecation warning to fire again after reset', () => {
      _resetDeprecationWarnings();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      normalizeDimensionName('legal_compliance');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      _resetDeprecationWarnings();

      normalizeDimensionName('legal_compliance');
      expect(warnSpy).toHaveBeenCalledTimes(2);

      warnSpy.mockRestore();
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
    const mockResult: EvalResult = {
      rail_score: { score: 8.0, confidence: 0.9, summary: 'Good' },
      explanation: '',
      dimension_scores: {
        safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
        privacy: { score: 6.5, confidence: 0.85, explanation: 'Needs work', issues: [] },
        fairness: { score: 8.0, confidence: 0.90, explanation: 'Fair', issues: [] },
      },
      from_cache: false,
    };

    it('should find the lowest scoring dimension', () => {
      const result = getLowestScoringDimension(mockResult);
      expect(result.dimension).toBe('privacy');
      expect(result.score.score).toBe(6.5);
    });
  });

  describe('getHighestScoringDimension', () => {
    const mockResult: EvalResult = {
      rail_score: { score: 8.0, confidence: 0.9, summary: 'Good' },
      explanation: '',
      dimension_scores: {
        safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
        privacy: { score: 6.5, confidence: 0.85, explanation: 'Needs work', issues: [] },
        fairness: { score: 8.0, confidence: 0.90, explanation: 'Fair', issues: [] },
      },
      from_cache: false,
    };

    it('should find the highest scoring dimension', () => {
      const result = getHighestScoringDimension(mockResult);
      expect(result.dimension).toBe('safety');
      expect(result.score.score).toBe(9.0);
    });
  });

  describe('getDimensionsBelowThreshold', () => {
    const mockResult: EvalResult = {
      rail_score: { score: 7.5, confidence: 0.9, summary: 'Good' },
      explanation: '',
      dimension_scores: {
        safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
        privacy: { score: 6.5, confidence: 0.85, explanation: 'Needs work', issues: [] },
        fairness: { score: 6.0, confidence: 0.80, explanation: 'Needs improvement', issues: [] },
        transparency: { score: 7.8, confidence: 0.90, explanation: 'Transparent', issues: [] },
      },
      from_cache: false,
    };

    it('should find dimensions below default threshold (7.0)', () => {
      const result = getDimensionsBelowThreshold(mockResult);
      expect(result).toHaveLength(2);
      expect(result[0].dimension).toBe('fairness');
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
    const mockResults: EvalResult[] = [
      {
        rail_score: { score: 8.0, confidence: 0.9, summary: 'Good' },
        explanation: '',
        dimension_scores: {
          safety: { score: 8.5, confidence: 0.95, explanation: 'Safe', issues: [] },
          privacy: { score: 7.5, confidence: 0.85, explanation: 'Good', issues: [] },
        },
        from_cache: false,
      },
      {
        rail_score: { score: 7.0, confidence: 0.85, summary: 'Good' },
        explanation: '',
        dimension_scores: {
          safety: { score: 7.5, confidence: 0.90, explanation: 'Safe', issues: [] },
          privacy: { score: 6.5, confidence: 0.80, explanation: 'Needs work', issues: [] },
        },
        from_cache: false,
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
