import { RailScore } from '../../src/client';
import { RAILLangfuse } from '../../src/observability/langfuse';
import { setMockResponse, resetMock } from '../__mocks__/node-fetch';

jest.mock('node-fetch');

describe('RAILLangfuse', () => {
  let client: RailScore;
  let mockLangfuse: any;

  const mockEvalResult = {
    rail_score: { score: 8.5, confidence: 0.92, summary: 'Good' },
    explanation: 'Content is safe and well-formed.',
    dimension_scores: {
      safety: { score: 9.0, confidence: 0.95, explanation: 'Safe content', issues: [] },
      privacy: { score: 8.0, confidence: 0.90, explanation: 'Good privacy', issues: [] },
    },
    from_cache: false,
  };

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-api-key' });
    mockLangfuse = {
      score: jest.fn(),
    };
  });

  afterEach(() => {
    resetMock();
  });

  it('should evaluate content and push scores to a trace', async () => {
    setMockResponse(mockEvalResult);
    const railLangfuse = new RAILLangfuse(client, mockLangfuse);

    const result = await railLangfuse.traceEvaluation('trace-123', 'Content to evaluate');

    expect(result.rail_score.score).toBe(8.5);
    // Should push overall score + 2 dimension scores = 3 calls
    expect(mockLangfuse.score).toHaveBeenCalledTimes(3);
  });

  it('should push overall RAIL score to Langfuse', async () => {
    setMockResponse(mockEvalResult);
    const railLangfuse = new RAILLangfuse(client, mockLangfuse);

    await railLangfuse.traceEvaluation('trace-123', 'Content');

    expect(mockLangfuse.score).toHaveBeenCalledWith({
      traceId: 'trace-123',
      name: 'rail_score',
      value: 8.5,
    });
  });

  it('should push per-dimension scores to Langfuse', async () => {
    setMockResponse(mockEvalResult);
    const railLangfuse = new RAILLangfuse(client, mockLangfuse);

    await railLangfuse.traceEvaluation('trace-123', 'Content');

    expect(mockLangfuse.score).toHaveBeenCalledWith({
      traceId: 'trace-123',
      name: 'rail_safety',
      value: 9.0,
      comment: 'Safe content',
    });

    expect(mockLangfuse.score).toHaveBeenCalledWith({
      traceId: 'trace-123',
      name: 'rail_privacy',
      value: 8.0,
      comment: 'Good privacy',
    });
  });

  it('should accept evaluation mode parameter', async () => {
    setMockResponse(mockEvalResult);
    const railLangfuse = new RAILLangfuse(client, mockLangfuse);

    const result = await railLangfuse.traceEvaluation('trace-123', 'Content', 'deep');
    expect(result).toBeDefined();
  });

  it('should push existing result to trace via scoreTrace', async () => {
    const railLangfuse = new RAILLangfuse(client, mockLangfuse);

    await railLangfuse.scoreTrace('trace-456', mockEvalResult as any);

    expect(mockLangfuse.score).toHaveBeenCalledWith({
      traceId: 'trace-456',
      name: 'rail_score',
      value: 8.5,
    });
    expect(mockLangfuse.score).toHaveBeenCalledTimes(3);
  });

  it('should handle evaluation results with many dimensions', async () => {
    const manyDimResult = {
      ...mockEvalResult,
      dimension_scores: {
        safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
        privacy: { score: 8.0, confidence: 0.90, explanation: 'Good', issues: [] },
        fairness: { score: 7.5, confidence: 0.88, explanation: 'Fair', issues: [] },
        transparency: { score: 8.5, confidence: 0.92, explanation: 'Clear', issues: [] },
      },
    };
    setMockResponse(manyDimResult);

    const railLangfuse = new RAILLangfuse(client, mockLangfuse);
    await railLangfuse.traceEvaluation('trace-789', 'Content');

    // 1 overall + 4 dimensions = 5 calls
    expect(mockLangfuse.score).toHaveBeenCalledTimes(5);
  });
});
