import { RailScore } from '../../src/client';
import { RAILOpenAI } from '../../src/providers/openai';
import { RAILBlockedError } from '../../src/errors';
import { setMockResponse, resetMock } from '../__mocks__/node-fetch';

jest.mock('node-fetch');

describe('RAILOpenAI', () => {
  let client: RailScore;
  let mockOpenAI: any;

  const mockEvalResult = {
    rail_score: { score: 8.5, confidence: 0.92, summary: 'Good' },
    explanation: 'Content is safe and well-formed.',
    dimension_scores: {
      safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
      privacy: { score: 8.0, confidence: 0.90, explanation: 'Good', issues: [] },
    },
    from_cache: false,
  };

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-api-key' });
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Hello, I can help!' } }],
          }),
        },
      },
    };
  });

  afterEach(() => {
    resetMock();
  });

  it('should call OpenAI and evaluate the response', async () => {
    setMockResponse(mockEvalResult);
    const railOpenAI = new RAILOpenAI(client, mockOpenAI);

    const result = await railOpenAI.chat({ model: 'gpt-4', messages: [] });

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    expect(result.content).toBe('Hello, I can help!');
    expect(result.railScore.score).toBe(8.5);
    expect(result.evaluation).toBeDefined();
  });

  it('should handle empty response content', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: '' } }],
    });

    const railOpenAI = new RAILOpenAI(client, mockOpenAI);
    const result = await railOpenAI.chat({ model: 'gpt-4', messages: [] });

    expect(result.content).toBe('');
    expect(result.railScore.score).toBe(0);
  });

  it('should handle missing choices', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [],
    });

    const railOpenAI = new RAILOpenAI(client, mockOpenAI);
    const result = await railOpenAI.chat({ model: 'gpt-4', messages: [] });

    expect(result.content).toBe('');
  });

  it('should pass when thresholds are met', async () => {
    setMockResponse(mockEvalResult);
    const railOpenAI = new RAILOpenAI(client, mockOpenAI, {
      thresholds: { safety: 7.0 },
    });

    const result = await railOpenAI.chat({ model: 'gpt-4', messages: [] });
    expect(result.railScore.score).toBe(8.5);
  });

  it('should throw RAILBlockedError when thresholds fail', async () => {
    setMockResponse({
      ...mockEvalResult,
      dimension_scores: {
        ...mockEvalResult.dimension_scores,
        safety: { score: 3.0, confidence: 0.60, explanation: 'Unsafe', issues: ['harmful'] },
      },
    });

    const railOpenAI = new RAILOpenAI(client, mockOpenAI, {
      thresholds: { safety: 7.0 },
    });

    await expect(railOpenAI.chat({ model: 'gpt-4', messages: [] }))
      .rejects.toThrow(RAILBlockedError);
  });

  it('should work without thresholds config', async () => {
    setMockResponse(mockEvalResult);
    const railOpenAI = new RAILOpenAI(client, mockOpenAI);

    const result = await railOpenAI.chat({ model: 'gpt-4', messages: [] });
    expect(result.evaluation).toBeDefined();
  });

  it('should return the original OpenAI response object', async () => {
    setMockResponse(mockEvalResult);
    const originalResponse = {
      choices: [{ message: { content: 'Response' } }],
      model: 'gpt-4',
    };
    mockOpenAI.chat.completions.create.mockResolvedValue(originalResponse);

    const railOpenAI = new RAILOpenAI(client, mockOpenAI);
    const result = await railOpenAI.chat({ model: 'gpt-4', messages: [] });

    expect(result.response).toBe(originalResponse);
  });
});
