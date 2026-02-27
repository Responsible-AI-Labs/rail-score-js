import { RailScore } from '../src/client';
import { PolicyEngine } from '../src/policy';
import { RAILBlockedError } from '../src/errors';
import { setMockResponse, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('PolicyEngine', () => {
  let client: RailScore;

  const mockHighScoreResult = {
    railScore: { score: 9.0, confidence: 0.95 },
    scores: {
      safety: { score: 9.0, confidence: 0.95, explanation: 'Very safe', issues: [] },
      fairness: { score: 8.5, confidence: 0.90, explanation: 'Fair', issues: [] },
      privacy: { score: 8.0, confidence: 0.88, explanation: 'Good privacy', issues: [] },
    },
    metadata: {
      reqId: 'req-policy',
      tier: 'balanced',
      queueWaitTimeMs: 10,
      processingTimeMs: 500,
      creditsConsumed: 1,
      timestamp: '2026-01-01T00:00:00Z',
    },
  };

  const mockLowScoreResult = {
    railScore: { score: 4.0, confidence: 0.70 },
    scores: {
      safety: { score: 3.0, confidence: 0.60, explanation: 'Unsafe content detected', issues: ['harmful'] },
      fairness: { score: 5.0, confidence: 0.75, explanation: 'Some bias', issues: ['bias'] },
      privacy: { score: 8.0, confidence: 0.88, explanation: 'Good privacy', issues: [] },
    },
    metadata: {
      reqId: 'req-policy-low',
      tier: 'balanced',
      queueWaitTimeMs: 10,
      processingTimeMs: 500,
      creditsConsumed: 1,
      timestamp: '2026-01-01T00:00:00Z',
    },
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

      expect(result.evaluation.railScore.score).toBe(4.0);
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
    it('should call protectedRegenerate when dimensions fail', async () => {
      // First call: evaluation returns low scores
      setMockResponse(mockLowScoreResult);
      const policy = new PolicyEngine(client, {
        mode: 'REGENERATE',
        thresholds: { safety: 7.0 },
      });

      // The enforce method will make two API calls: basic eval then protectedRegenerate
      // We need to handle the second call
      const fetchDefault = require('node-fetch').default;
      let callCount = 0;
      fetchDefault.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => mockLowScoreResult,
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            content: 'Regenerated safe content',
            railScore: { score: 9.0, confidence: 0.95 },
            fixedIssues: ['safety'],
          }),
        };
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

      // Should not throw in LOG_ONLY
      const result = await policy.enforce('Content');
      expect(result.passed).toBe(false);

      // Switch to BLOCK
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
      // privacy is 8.0, above 7.0 threshold
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
