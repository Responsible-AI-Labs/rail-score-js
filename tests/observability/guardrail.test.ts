import { RailScore } from '../../src/client';
import { RAILGuardrail } from '../../src/observability/guardrail';
import { setMockResponse, resetMock } from '../__mocks__/node-fetch';

jest.mock('node-fetch');

describe('RAILGuardrail', () => {
  let client: RailScore;

  const mockHighScore = {
    rail_score: { score: 9.0, confidence: 0.95, summary: 'Excellent' },
    explanation: 'Content is safe and fair.',
    dimension_scores: {
      safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
      fairness: { score: 8.5, confidence: 0.90, explanation: 'Fair', issues: [] },
    },
    from_cache: false,
  };

  const mockLowScore = {
    rail_score: { score: 3.0, confidence: 0.60, summary: 'Poor' },
    explanation: 'Content has issues.',
    dimension_scores: {
      safety: { score: 2.0, confidence: 0.50, explanation: 'Unsafe', issues: ['harmful'] },
      fairness: { score: 4.0, confidence: 0.70, explanation: 'Biased', issues: ['bias'] },
    },
    from_cache: false,
  };

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-rail-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  describe('preCall', () => {
    it('should allow input that passes thresholds', async () => {
      setMockResponse(mockHighScore);
      const guardrail = new RAILGuardrail(client, {
        inputThresholds: { safety: 7.0 },
      });

      const result = await guardrail.preCall('Safe input');

      expect(result.allowed).toBe(true);
      expect(result.result.rail_score.score).toBe(9.0);
      expect(result.failedDimensions).toBeUndefined();
    });

    it('should block input that fails thresholds', async () => {
      setMockResponse(mockLowScore);
      const guardrail = new RAILGuardrail(client, {
        inputThresholds: { safety: 7.0 },
      });

      const result = await guardrail.preCall('Unsafe input');

      expect(result.allowed).toBe(false);
      expect(result.failedDimensions).toContain('safety');
    });

    it('should allow all input when no inputThresholds configured', async () => {
      setMockResponse(mockLowScore);
      const guardrail = new RAILGuardrail(client, {});

      const result = await guardrail.preCall('Any input');

      expect(result.allowed).toBe(true);
    });
  });

  describe('postCall', () => {
    it('should allow output that passes thresholds', async () => {
      setMockResponse(mockHighScore);
      const guardrail = new RAILGuardrail(client, {
        outputThresholds: { safety: 7.0, fairness: 7.0 },
      });

      const result = await guardrail.postCall('Safe output');

      expect(result.allowed).toBe(true);
    });

    it('should block output that fails thresholds', async () => {
      setMockResponse(mockLowScore);
      const guardrail = new RAILGuardrail(client, {
        outputThresholds: { safety: 7.0 },
      });

      const result = await guardrail.postCall('Unsafe output');

      expect(result.allowed).toBe(false);
      expect(result.failedDimensions).toContain('safety');
    });

    it('should allow all output when no outputThresholds configured', async () => {
      setMockResponse(mockLowScore);
      const guardrail = new RAILGuardrail(client, {});

      const result = await guardrail.postCall('Any output');

      expect(result.allowed).toBe(true);
    });

    it('should identify multiple failed dimensions', async () => {
      setMockResponse(mockLowScore);
      const guardrail = new RAILGuardrail(client, {
        outputThresholds: { safety: 7.0, fairness: 7.0 },
      });

      const result = await guardrail.postCall('Bad output');

      expect(result.failedDimensions).toContain('safety');
      expect(result.failedDimensions).toContain('fairness');
    });
  });

  describe('getHandler', () => {
    it('should return an object with preCall and postCall methods', () => {
      const guardrail = new RAILGuardrail(client, {
        inputThresholds: { safety: 7.0 },
        outputThresholds: { safety: 7.0 },
      });

      const handler = guardrail.getHandler();

      expect(handler.preCall).toBeDefined();
      expect(typeof handler.preCall).toBe('function');
      expect(handler.postCall).toBeDefined();
      expect(typeof handler.postCall).toBe('function');
    });

    it('should work correctly via handler methods', async () => {
      setMockResponse(mockHighScore);
      const guardrail = new RAILGuardrail(client, {
        inputThresholds: { safety: 7.0 },
      });

      const handler = guardrail.getHandler();
      const result = await handler.preCall('Safe input');

      expect(result.allowed).toBe(true);
    });
  });
});
