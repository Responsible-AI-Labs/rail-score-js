import { RailScore } from '../../src/client';
import { RAILGemini } from '../../src/providers/gemini';
import { RAILBlockedError } from '../../src/errors';
import { setMockResponse, resetMock } from '../__mocks__/node-fetch';

jest.mock('node-fetch');

describe('RAILGemini', () => {
  let client: RailScore;
  let mockModel: any;

  const mockEvalResult = {
    railScore: { score: 8.5, confidence: 0.92 },
    scores: {
      safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
    },
    metadata: {
      reqId: 'req-gem',
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
    mockModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => 'Hello from Gemini!',
        },
      }),
    };
  });

  afterEach(() => {
    resetMock();
  });

  it('should call Gemini and evaluate the response', async () => {
    setMockResponse(mockEvalResult);
    const railGemini = new RAILGemini(client, mockModel);

    const result = await railGemini.generate('Tell me about safety');

    expect(mockModel.generateContent).toHaveBeenCalled();
    expect(result.content).toBe('Hello from Gemini!');
    expect(result.railScore.score).toBe(8.5);
  });

  it('should handle empty response', async () => {
    mockModel.generateContent.mockResolvedValue({
      response: {
        text: () => '',
      },
    });

    const railGemini = new RAILGemini(client, mockModel);
    const result = await railGemini.generate('Hello');

    expect(result.content).toBe('');
    expect(result.railScore.score).toBe(0);
  });

  it('should handle candidates format', async () => {
    mockModel.generateContent.mockResolvedValue({
      response: {
        candidates: [{ content: { parts: [{ text: 'Candidate response' }] } }],
      },
    });
    setMockResponse(mockEvalResult);

    const railGemini = new RAILGemini(client, mockModel);
    const result = await railGemini.generate('Hello');

    expect(result.content).toBe('Candidate response');
  });

  it('should throw RAILBlockedError when thresholds fail', async () => {
    setMockResponse({
      ...mockEvalResult,
      scores: {
        safety: { score: 2.0, confidence: 0.40, explanation: 'Unsafe', issues: ['harmful'] },
      },
    });

    const railGemini = new RAILGemini(client, mockModel, {
      thresholds: { safety: 7.0 },
    });

    await expect(railGemini.generate('Unsafe prompt')).rejects.toThrow(RAILBlockedError);
  });

  it('should pass when thresholds are met', async () => {
    setMockResponse(mockEvalResult);
    const railGemini = new RAILGemini(client, mockModel, {
      thresholds: { safety: 7.0 },
    });

    const result = await railGemini.generate('Safe prompt');
    expect(result.railScore.score).toBe(8.5);
  });

  it('should return original Gemini response', async () => {
    setMockResponse(mockEvalResult);
    const originalResponse = {
      response: { text: () => 'Response' },
    };
    mockModel.generateContent.mockResolvedValue(originalResponse);

    const railGemini = new RAILGemini(client, mockModel);
    const result = await railGemini.generate('Hello');

    expect(result.response).toBe(originalResponse);
  });

  it('should work without thresholds', async () => {
    setMockResponse(mockEvalResult);
    const railGemini = new RAILGemini(client, mockModel);

    const result = await railGemini.generate('Hello');
    expect(result.evaluation).toBeDefined();
  });

  it('should handle errors in text extraction gracefully', async () => {
    mockModel.generateContent.mockResolvedValue({
      response: null,
    });

    const railGemini = new RAILGemini(client, mockModel);
    const result = await railGemini.generate('Hello');

    expect(result.content).toBe('');
    expect(result.railScore.score).toBe(0);
  });
});
