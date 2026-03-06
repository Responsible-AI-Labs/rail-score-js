import { RailScore } from '../src/client';
import { PolicyEngine } from '../src/policy';
import { RAILBlockedError } from '../src/errors';
import { setMockResponse, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('PolicyEngine', () => {
  let client: RailScore;

  const mockHighScoreResult = {
    rail_score: { score: 9.0, confidence: 0.95, summary: 'Excellent' },
    explanation: 'Content is very safe and fair.',
    dimension_scores: {
      safety: { score: 9.0, confidence: 0.95, explanation: 'Very safe', issues: [] },
      fairness: { score: 8.5, confidence: 0.90, explanation: 'Fair', issues: [] },
      privacy: { score: 8.0, confidence: 0.88, explanation: 'Good privacy', issues: [] },
    },
    from_cache: false,
  };

  const mockLowScoreResult = {
    rail_score: { score: 4.0, confidence: 0.70, summary: 'Poor' },
    explanation: 'Content has significant safety issues.',
    dimension_scores: {
      safety: { score: 3.0, confidence: 0.60, explanation: 'Unsafe content detected', issues: ['harmful'] },
      fairness: { score: 5.0, confidence: 0.75, explanation: 'Some bias', issues: ['bias'] },
      privacy: { score: 8.0, confidence: 0.88, explanation: 'Good privacy', issues: [] },
    },
    from_cache: false,
  };

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  describe('LOG_ONLY mode', () => {
    it('should return result without blocking', async () => {
      setMockResponse(mockLowScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'LOG_ONLY',
        thresholds: { safety: 7.0 },
      });

      const result = await policy.enforce('Low quality content');

      expect(result.evaluation.rail_score.score).toBe(4.0);
      expect(result.passed).toBe(false);
      expect(result.failedDimensions).toContain('safety');
    });

    it('should report passed when all dimensions meet thresholds', async () => {
      setMockResponse(mockHighScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'LOG_ONLY',
        thresholds: { safety: 7.0, fairness: 7.0 },
      });

      const result = await policy.enforce('High quality content');

      expect(result.passed).toBe(true);
      expect(result.failedDimensions).toHaveLength(0);
    });
  });

  describe('BLOCK mode', () => {
    it('should throw RAILBlockedError when dimensions fail', async () => {
      setMockResponse(mockLowScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'BLOCK',
        thresholds: { safety: 7.0 },
      });

      await expect(policy.enforce('Unsafe content')).rejects.toThrow(RAILBlockedError);
    });

    it('should throw with correct policyMode', async () => {
      setMockResponse(mockLowScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'BLOCK',
        thresholds: { safety: 7.0 },
      });

      try {
        await policy.enforce('Unsafe content');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(RAILBlockedError);
        expect(error.policyMode).toBe('BLOCK');
        expect(error.scores).toBeDefined();
      }
    });

    it('should pass when all dimensions meet thresholds', async () => {
      setMockResponse(mockHighScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'BLOCK',
        thresholds: { safety: 7.0 },
      });

      const result = await policy.enforce('Safe content');
      expect(result.passed).toBe(true);
    });

    it('should identify multiple failed dimensions', async () => {
      setMockResponse(mockLowScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'LOG_ONLY',
        thresholds: { safety: 7.0, fairness: 7.0 },
      });

      const result = await policy.enforce('Content');
      expect(result.failedDimensions).toContain('safety');
      expect(result.failedDimensions).toContain('fairness');
      expect(result.failedDimensions).not.toContain('privacy');
    });
  });

  describe('REGENERATE mode', () => {
    it('should call safeRegenerate when dimensions fail', async () => {
      const fetchDefault = require('node-fetch').default;
      let callCount = 0;
      fetchDefault.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true, status: 200, statusText: 'OK',
            json: async () => mockLowScoreResult,
          };
        }
        return {
          ok: true, status: 200, statusText: 'OK',
          json: async () => ({
            status: 'passed',
            original_content: 'Unsafe content',
            credits_consumed: 2.0,
            metadata: { req_id: 'req-regen', mode: 'basic' },
            best_content: 'Regenerated safe content',
            best_iteration: 1,
            best_scores: { rail_score: { score: 9.0 }, dimension_scores: {} },
          }),
        };
      });

      const policy = new PolicyEngine(client, {
        mode: 'REGENERATE',
        thresholds: { safety: 7.0 },
      });

      const result = await policy.enforce('Unsafe content');

      expect(result.passed).toBe(false);
      expect(result.regeneratedContent).toBe('Regenerated safe content');
    });

    it('should pass through when all thresholds met', async () => {
      setMockResponse(mockHighScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'REGENERATE',
        thresholds: { safety: 7.0 },
      });

      const result = await policy.enforce('Good content');
      expect(result.passed).toBe(true);
      expect(result.regeneratedContent).toBeUndefined();
    });
  });

  describe('CUSTOM mode', () => {
    it('should call custom callback when dimensions fail', async () => {
      setMockResponse(mockLowScoreResult);
      const customCallback = jest.fn().mockResolvedValue('Custom fixed content');
      const policy = new PolicyEngine(client, {
        mode: 'CUSTOM',
        thresholds: { safety: 7.0 },
        customCallback,
      });

      const result = await policy.enforce('Unsafe content');

      expect(customCallback).toHaveBeenCalled();
      expect(result.regeneratedContent).toBe('Custom fixed content');
    });

    it('should handle null from custom callback', async () => {
      setMockResponse(mockLowScoreResult);
      const customCallback = jest.fn().mockResolvedValue(null);
      const policy = new PolicyEngine(client, {
        mode: 'CUSTOM',
        thresholds: { safety: 7.0 },
        customCallback,
      });

      const result = await policy.enforce('Content');

      expect(customCallback).toHaveBeenCalled();
      expect(result.regeneratedContent).toBeUndefined();
    });

    it('should not call callback when all thresholds met', async () => {
      setMockResponse(mockHighScoreResult);
      const customCallback = jest.fn();
      const policy = new PolicyEngine(client, {
        mode: 'CUSTOM',
        thresholds: { safety: 7.0 },
        customCallback,
      });

      const result = await policy.enforce('Good content');

      expect(customCallback).not.toHaveBeenCalled();
      expect(result.passed).toBe(true);
    });
  });

  describe('setMode', () => {
    it('should update the policy mode', async () => {
      setMockResponse(mockLowScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'LOG_ONLY',
        thresholds: { safety: 7.0 },
      });

      const result = await policy.enforce('Content');
      expect(result.passed).toBe(false);

      policy.setMode('BLOCK');
      setMockResponse(mockLowScoreResult);

      await expect(policy.enforce('Content')).rejects.toThrow(RAILBlockedError);
    });
  });

  describe('setThresholds', () => {
    it('should update thresholds', async () => {
      setMockResponse(mockLowScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'LOG_ONLY',
        thresholds: { safety: 2.0 },
      });

      let result = await policy.enforce('Content');
      expect(result.passed).toBe(true);

      policy.setThresholds({ safety: 7.0 });
      setMockResponse(mockLowScoreResult);

      result = await policy.enforce('Content');
      expect(result.passed).toBe(false);
    });
  });

  describe('setCustomCallback', () => {
    it('should update the custom callback', async () => {
      setMockResponse(mockLowScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'CUSTOM',
        thresholds: { safety: 7.0 },
      });

      const callback = jest.fn().mockResolvedValue('Fixed');
      policy.setCustomCallback(callback);

      setMockResponse(mockLowScoreResult);
      const result = await policy.enforce('Content');

      expect(callback).toHaveBeenCalled();
      expect(result.regeneratedContent).toBe('Fixed');
    });
  });

  describe('threshold checking', () => {
    it('should only check dimensions present in thresholds', async () => {
      setMockResponse(mockLowScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'LOG_ONLY',
        thresholds: { privacy: 7.0 },
      });

      const result = await policy.enforce('Content');
      expect(result.passed).toBe(true);
      expect(result.failedDimensions).toHaveLength(0);
    });

    it('should skip dimensions not in evaluation result', async () => {
      setMockResponse(mockLowScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'LOG_ONLY',
        thresholds: { nonexistent_dimension: 7.0 },
      });

      const result = await policy.enforce('Content');
      expect(result.passed).toBe(true);
    });
  });
});
