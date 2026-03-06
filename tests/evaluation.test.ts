import { RailScore } from '../src/client';
import { ValidationError } from '../src/errors';
import { setMockResponse, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('Eval API', () => {
  let client: RailScore;

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-rail-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  const mockEvalResult = {
    rail_score: { score: 8.5, confidence: 0.92, summary: 'Good overall score' },
    explanation: 'The content demonstrates strong responsible AI practices.',
    dimension_scores: {
      safety: { score: 9.0, confidence: 0.95, explanation: 'Content is safe', issues: [] },
      privacy: { score: 8.0, confidence: 0.90, explanation: 'Good privacy practices', issues: [] },
    },
    from_cache: false,
  };

  describe('basic evaluation', () => {
    it('should evaluate content successfully', async () => {
      setMockResponse(mockEvalResult);

      const result = await client.eval({ content: 'Test content' });

      expect(result.rail_score.score).toBe(8.5);
      expect(result.rail_score.confidence).toBe(0.92);
      expect(result.dimension_scores.safety.score).toBe(9.0);
    });

    it('should accept mode option', async () => {
      setMockResponse(mockEvalResult);

      const result = await client.eval({
        content: 'Test content',
        mode: 'deep',
      });

      expect(result).toBeDefined();
      expect(result.rail_score).toBeDefined();
    });

    it('should accept domain and usecase options', async () => {
      setMockResponse(mockEvalResult);

      const result = await client.eval({
        content: 'Test content',
        domain: 'healthcare',
        usecase: 'chatbot',
      });

      expect(result).toBeDefined();
    });

    it('should accept dimensions filter', async () => {
      setMockResponse(mockEvalResult);

      const result = await client.eval({
        content: 'Test content',
        dimensions: ['safety', 'privacy'],
      });

      expect(result).toBeDefined();
    });

    it('should accept include flags', async () => {
      setMockResponse(mockEvalResult);

      const result = await client.eval({
        content: 'Test content',
        includeExplanations: true,
        includeIssues: true,
        includeSuggestions: true,
      });

      expect(result).toBeDefined();
    });

    it('should accept custom weights summing to 100', async () => {
      setMockResponse(mockEvalResult);

      const result = await client.eval({
        content: 'Test content',
        weights: { safety: 60, privacy: 40 },
      });

      expect(result).toBeDefined();
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.eval({ content: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on whitespace-only content', async () => {
      await expect(
        client.eval({ content: '   ' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw on weights that do not sum to 100', async () => {
      await expect(
        client.eval({ content: 'Test', weights: { safety: 30, privacy: 30 } })
      ).rejects.toThrow();
    });

    it('should return from_cache field', async () => {
      setMockResponse({ ...mockEvalResult, from_cache: true });

      const result = await client.eval({ content: 'Cached content' });
      expect(result.from_cache).toBe(true);
    });
  });
});
