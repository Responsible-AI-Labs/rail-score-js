import { RailScore } from '../../src/client';
import { RAILAnthropic } from '../../src/providers/anthropic';
import { RAILBlockedError } from '../../src/errors';
import { setMockResponse, resetMock } from '../__mocks__/node-fetch';

jest.mock('node-fetch');

describe('RAILAnthropic', () => {
  let client: RailScore;
  let mockAnthropic: any;

  const mockEvalResult = {
    rail_score: { score: 8.5, confidence: 0.92, summary: 'Good' },
    explanation: 'Content is safe.',
    dimension_scores: {
      safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
    },
    from_cache: false,
  };

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-rail-api-key' });
    mockAnthropic = {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Hello from Claude!' }],
        }),
      },
    };
  });

  afterEach(() => {
    resetMock();
  });

  it('should call Anthropic and evaluate the response', async () => {
    setMockResponse(mockEvalResult);
    const railAnthropic = new RAILAnthropic(client, mockAnthropic);

    const result = await railAnthropic.message({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(mockAnthropic.messages.create).toHaveBeenCalled();
    expect(result.content).toBe('Hello from Claude!');
    expect(result.railScore.score).toBe(8.5);
  });

  it('should handle empty content', async () => {
    mockAnthropic.messages.create.mockResolvedValue({
      content: [],
    });

    const railAnthropic = new RAILAnthropic(client, mockAnthropic);
    const result = await railAnthropic.message({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [] });

    expect(result.content).toBe('');
    expect(result.railScore.score).toBe(0);
  });

  it('should handle multiple text blocks', async () => {
    mockAnthropic.messages.create.mockResolvedValue({
      content: [
        { type: 'text', text: 'Part 1 ' },
        { type: 'text', text: 'Part 2' },
      ],
    });
    setMockResponse(mockEvalResult);

    const railAnthropic = new RAILAnthropic(client, mockAnthropic);
    const result = await railAnthropic.message({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [] });

    expect(result.content).toBe('Part 1 Part 2');
  });

  it('should filter non-text blocks', async () => {
    mockAnthropic.messages.create.mockResolvedValue({
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'tool-1', name: 'search', input: {} },
      ],
    });
    setMockResponse(mockEvalResult);

    const railAnthropic = new RAILAnthropic(client, mockAnthropic);
    const result = await railAnthropic.message({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [] });

    expect(result.content).toBe('Hello');
  });

  it('should throw RAILBlockedError when thresholds fail', async () => {
    setMockResponse({
      ...mockEvalResult,
      dimension_scores: {
        safety: { score: 3.0, confidence: 0.50, explanation: 'Unsafe', issues: ['harmful'] },
      },
    });

    const railAnthropic = new RAILAnthropic(client, mockAnthropic, {
      thresholds: { safety: 7.0 },
    });

    await expect(railAnthropic.message({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [] }))
      .rejects.toThrow(RAILBlockedError);
  });

  it('should pass when thresholds are met', async () => {
    setMockResponse(mockEvalResult);
    const railAnthropic = new RAILAnthropic(client, mockAnthropic, {
      thresholds: { safety: 7.0 },
    });

    const result = await railAnthropic.message({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [] });
    expect(result.railScore.score).toBe(8.5);
  });

  it('should return original Anthropic response', async () => {
    setMockResponse(mockEvalResult);
    const originalResponse = {
      content: [{ type: 'text', text: 'Response' }],
      model: 'claude-sonnet-4-6',
    };
    mockAnthropic.messages.create.mockResolvedValue(originalResponse);

    const railAnthropic = new RAILAnthropic(client, mockAnthropic);
    const result = await railAnthropic.message({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [] });

    expect(result.response).toBe(originalResponse);
  });

  it('should work without thresholds', async () => {
    setMockResponse(mockEvalResult);
    const railAnthropic = new RAILAnthropic(client, mockAnthropic);

    const result = await railAnthropic.message({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [] });
    expect(result.evaluation).toBeDefined();
  });
});
