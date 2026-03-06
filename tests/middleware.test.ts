import { RailScore } from '../src/client';
import { RAILMiddleware } from '../src/middleware';
import { RAILBlockedError } from '../src/errors';
import { setMockResponse, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('RAILMiddleware', () => {
  let client: RailScore;

  const mockHighScore = {
    rail_score: { score: 9.0, confidence: 0.95, summary: 'Excellent' },
    explanation: 'Very safe and fair content.',
    dimension_scores: {
      safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
      fairness: { score: 8.5, confidence: 0.90, explanation: 'Fair', issues: [] },
    },
    from_cache: false,
  };

  const mockLowScore = {
    rail_score: { score: 3.0, confidence: 0.60, summary: 'Poor' },
    explanation: 'Content has safety and fairness issues.',
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

  it('should wrap a function and pass through when no thresholds configured', async () => {
    const middleware = new RAILMiddleware(client, {});
    const fn = jest.fn().mockResolvedValue('output text');

    const wrapped = middleware.wrap(fn);
    const result = await wrapped('input text');

    expect(fn).toHaveBeenCalledWith('input text');
    expect(result).toBe('output text');
  });

  it('should evaluate input against inputThresholds', async () => {
    setMockResponse(mockHighScore);
    const middleware = new RAILMiddleware(client, {
      inputThresholds: { safety: 7.0 },
    });

    const fn = jest.fn().mockResolvedValue('output');
    const wrapped = middleware.wrap(fn);
    const result = await wrapped('safe input');

    expect(fn).toHaveBeenCalled();
    expect(result).toBe('output');
  });

  it('should block input when inputThresholds fail', async () => {
    setMockResponse(mockLowScore);
    const middleware = new RAILMiddleware(client, {
      inputThresholds: { safety: 7.0 },
    });

    const fn = jest.fn().mockResolvedValue('output');
    const wrapped = middleware.wrap(fn);

    await expect(wrapped('unsafe input')).rejects.toThrow(RAILBlockedError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('should evaluate output against outputThresholds', async () => {
    const fetchDefault = require('node-fetch').default;
    fetchDefault.mockImplementation(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockHighScore,
    }));

    const middleware = new RAILMiddleware(client, {
      outputThresholds: { safety: 7.0 },
    });

    const fn = jest.fn().mockResolvedValue('safe output');
    const wrapped = middleware.wrap(fn);
    const result = await wrapped('input');

    expect(result).toBe('safe output');
  });

  it('should block output when outputThresholds fail (no policy)', async () => {
    setMockResponse(mockLowScore);
    const middleware = new RAILMiddleware(client, {
      outputThresholds: { safety: 7.0 },
    });

    const fn = jest.fn().mockResolvedValue('unsafe output');
    const wrapped = middleware.wrap(fn);

    await expect(wrapped('input')).rejects.toThrow(RAILBlockedError);
  });

  it('should call onInputEval hook', async () => {
    setMockResponse(mockHighScore);
    const onInputEval = jest.fn();
    const middleware = new RAILMiddleware(client, {
      inputThresholds: { safety: 7.0 },
      onInputEval,
    });

    const fn = jest.fn().mockResolvedValue('output');
    const wrapped = middleware.wrap(fn);
    await wrapped('input');

    expect(onInputEval).toHaveBeenCalledWith(expect.objectContaining({
      rail_score: expect.objectContaining({ score: 9.0 }),
    }));
  });

  it('should call onOutputEval hook', async () => {
    const onOutputEval = jest.fn();
    setMockResponse(mockHighScore);
    const middleware = new RAILMiddleware(client, {
      outputThresholds: { safety: 7.0 },
      onOutputEval,
    });

    const fn = jest.fn().mockResolvedValue('output');
    const wrapped = middleware.wrap(fn);
    await wrapped('input');

    expect(onOutputEval).toHaveBeenCalledWith(expect.objectContaining({
      rail_score: expect.objectContaining({ score: 9.0 }),
    }));
  });

  it('should apply BLOCK policy on output', async () => {
    setMockResponse(mockLowScore);
    const middleware = new RAILMiddleware(client, {
      outputThresholds: { safety: 7.0 },
      policy: {
        mode: 'BLOCK',
        thresholds: { safety: 7.0 },
      },
    });

    const fn = jest.fn().mockResolvedValue('bad output');
    const wrapped = middleware.wrap(fn);

    await expect(wrapped('input')).rejects.toThrow(RAILBlockedError);
  });

  it('should apply REGENERATE policy on output', async () => {
    const fetchDefault = require('node-fetch').default;
    let callCount = 0;
    fetchDefault.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true, status: 200, statusText: 'OK',
          json: async () => mockLowScore,
        };
      }
      return {
        ok: true, status: 200, statusText: 'OK',
        json: async () => ({
          status: 'passed',
          original_content: 'bad output',
          credits_consumed: 1.0,
          metadata: { req_id: 'req-regen', mode: 'basic' },
          best_content: 'Regenerated output',
          best_iteration: 1,
          best_scores: { rail_score: { score: 9.0 }, dimension_scores: {} },
        }),
      };
    });

    const middleware = new RAILMiddleware(client, {
      outputThresholds: { safety: 7.0 },
      policy: {
        mode: 'REGENERATE',
        thresholds: { safety: 7.0 },
      },
    });

    const fn = jest.fn().mockResolvedValue('bad output');
    const wrapped = middleware.wrap(fn);
    const result = await wrapped('input');

    expect(result).toBe('Regenerated output');
  });

  it('should apply CUSTOM policy on output', async () => {
    setMockResponse(mockLowScore);
    const customCallback = jest.fn().mockResolvedValue('Custom fixed output');
    const middleware = new RAILMiddleware(client, {
      outputThresholds: { safety: 7.0 },
      policy: {
        mode: 'CUSTOM',
        thresholds: { safety: 7.0 },
        customCallback,
      },
    });

    const fn = jest.fn().mockResolvedValue('bad output');
    const wrapped = middleware.wrap(fn);
    const result = await wrapped('input');

    expect(customCallback).toHaveBeenCalled();
    expect(result).toBe('Custom fixed output');
  });

  it('should pass through in LOG_ONLY policy mode', async () => {
    setMockResponse(mockLowScore);
    const middleware = new RAILMiddleware(client, {
      outputThresholds: { safety: 7.0 },
      policy: {
        mode: 'LOG_ONLY',
        thresholds: { safety: 7.0 },
      },
    });

    const fn = jest.fn().mockResolvedValue('output');
    const wrapped = middleware.wrap(fn);

    const result = await wrapped('input');
    expect(result).toBe('output');
  });
});
