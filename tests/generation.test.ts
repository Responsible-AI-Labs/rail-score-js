import { RailScore } from '../src/client';
import { ValidationError } from '../src/errors';
import { setMockResponse, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('Generation API', () => {
  let client: RailScore;

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  describe('generate', () => {
    const mockGenerationResult = {
      content: 'Generated responsible AI content here.',
      railScore: { score: 9.0, confidence: 0.95 },
      scores: {
        safety: { score: 9.5, confidence: 0.96, explanation: 'Highly safe', issues: [] },
        privacy: { score: 8.5, confidence: 0.92, explanation: 'Good privacy', issues: [] },
      },
      iterations: 2,
      metadata: {
        reqId: 'req-gen-1',
        tier: 'balanced',
        queueWaitTimeMs: 20,
        processingTimeMs: 1500,
        creditsConsumed: 3,
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    it('should generate content successfully', async () => {
      setMockResponse(mockGenerationResult);

      const result = await client.generation.generate(
        'Write a privacy policy for a mobile app'
      );

      expect(result.content).toBeDefined();
      expect(result.railScore.score).toBe(9.0);
      expect(result.iterations).toBe(2);
    });

    it('should accept generation options', async () => {
      setMockResponse(mockGenerationResult);

      const result = await client.generation.generate(
        'Write a privacy policy',
        {
          targetScore: 9.0,
          dimensions: ['privacy', 'transparency'],
          maxIterations: 3,
          temperature: 0.7,
        }
      );

      expect(result).toBeDefined();
      expect(result.content).toBeTruthy();
    });

    it('should throw ValidationError on empty prompt', async () => {
      await expect(
        client.generation.generate('')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on whitespace-only prompt', async () => {
      await expect(
        client.generation.generate('   ')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on invalid targetScore (< 0)', async () => {
      await expect(
        client.generation.generate('Test prompt', { targetScore: -1 })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on invalid targetScore (> 10)', async () => {
      await expect(
        client.generation.generate('Test prompt', { targetScore: 11 })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on invalid maxIterations (< 1)', async () => {
      await expect(
        client.generation.generate('Test prompt', { maxIterations: 0 })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on invalid maxIterations (> 10)', async () => {
      await expect(
        client.generation.generate('Test prompt', { maxIterations: 11 })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on invalid temperature (< 0)', async () => {
      await expect(
        client.generation.generate('Test prompt', { temperature: -0.1 })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on invalid temperature (> 2)', async () => {
      await expect(
        client.generation.generate('Test prompt', { temperature: 2.1 })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('improve', () => {
    const mockImproveResult = {
      content: 'Improved content with better responsible AI practices.',
      railScore: { score: 9.2, confidence: 0.94 },
      scores: {
        privacy: { score: 9.0, confidence: 0.93, explanation: 'Enhanced privacy', issues: [] },
        transparency: { score: 9.5, confidence: 0.95, explanation: 'Very transparent', issues: [] },
      },
      iterations: 1,
      metadata: {
        reqId: 'req-improve-1',
        tier: 'balanced',
        queueWaitTimeMs: 15,
        processingTimeMs: 1200,
        creditsConsumed: 2,
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    it('should improve content successfully', async () => {
      setMockResponse(mockImproveResult);

      const result = await client.generation.improve(
        'Our AI collects user data for analysis.'
      );

      expect(result.content).toBeDefined();
      expect(result.railScore.score).toBeGreaterThan(8.0);
    });

    it('should accept target dimensions', async () => {
      setMockResponse(mockImproveResult);

      const result = await client.generation.improve(
        'Test content',
        ['privacy', 'transparency']
      );

      expect(result).toBeDefined();
    });

    it('should accept custom target score', async () => {
      setMockResponse(mockImproveResult);

      const result = await client.generation.improve(
        'Test content',
        ['privacy'],
        9.5
      );

      expect(result).toBeDefined();
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.generation.improve('')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on invalid target score (< 0)', async () => {
      await expect(
        client.generation.improve('Test content', undefined, -1)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on invalid target score (> 10)', async () => {
      await expect(
        client.generation.improve('Test content', undefined, 11)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('rewrite', () => {
    const mockRewriteResult = {
      content: 'Rewritten content addressing all identified issues.',
      railScore: { score: 8.8, confidence: 0.91 },
      scores: {
        safety: { score: 9.0, confidence: 0.93, explanation: 'Safe content', issues: [] },
      },
      iterations: 1,
      metadata: {
        reqId: 'req-rewrite-1',
        tier: 'balanced',
        queueWaitTimeMs: 10,
        processingTimeMs: 1000,
        creditsConsumed: 2,
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    it('should rewrite content successfully', async () => {
      setMockResponse(mockRewriteResult);

      const result = await client.generation.rewrite(
        'We may share your data with partners.',
        [
          'Lacks transparency about data sharing',
          'No user consent mentioned',
        ]
      );

      expect(result.content).toBeDefined();
      expect(result.railScore.score).toBeGreaterThan(8.0);
    });

    it('should accept preserveTone parameter', async () => {
      setMockResponse(mockRewriteResult);

      const result = await client.generation.rewrite(
        'Test content',
        ['Issue 1'],
        false
      );

      expect(result).toBeDefined();
    });

    it('should default preserveTone to true', async () => {
      setMockResponse(mockRewriteResult);

      const result = await client.generation.rewrite(
        'Test content',
        ['Issue 1']
      );

      expect(result).toBeDefined();
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.generation.rewrite('', ['Issue'])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on empty issues array', async () => {
      await expect(
        client.generation.rewrite('Test content', [])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if issues contain empty strings', async () => {
      await expect(
        client.generation.rewrite('Test content', ['Valid issue', ''])
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('variations', () => {
    const mockVariationsResult = {
      variations: [
        {
          content: 'Variation 1 optimized for safety and transparency.',
          railScore: { score: 9.0, confidence: 0.93 },
          scores: {
            safety: { score: 9.5, confidence: 0.95, explanation: 'Highly safe', issues: [] },
            transparency: { score: 8.5, confidence: 0.90, explanation: 'Transparent', issues: [] },
          },
          iterations: 1,
          metadata: {
            reqId: 'req-var-1',
            tier: 'balanced',
            queueWaitTimeMs: 20,
            processingTimeMs: 1500,
            creditsConsumed: 3,
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
        {
          content: 'Variation 2 optimized for privacy and accountability.',
          railScore: { score: 8.8, confidence: 0.91 },
          scores: {
            privacy: { score: 9.0, confidence: 0.92, explanation: 'Strong privacy', issues: [] },
            accountability: { score: 8.6, confidence: 0.90, explanation: 'Accountable', issues: [] },
          },
          iterations: 1,
          metadata: {
            reqId: 'req-var-2',
            tier: 'balanced',
            queueWaitTimeMs: 20,
            processingTimeMs: 1500,
            creditsConsumed: 3,
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
      ],
    };

    it('should generate variations successfully', async () => {
      setMockResponse(mockVariationsResult);

      const results = await client.generation.variations(
        'Describe our AI moderation system',
        [
          ['safety', 'transparency'],
          ['privacy', 'accountability'],
        ]
      );

      expect(results).toHaveLength(2);
      expect(results[0].content).toBeDefined();
      expect(results[1].content).toBeDefined();
    });

    it('should accept count parameter', async () => {
      setMockResponse(mockVariationsResult);

      const results = await client.generation.variations(
        'Test prompt',
        [['safety']],
        2
      );

      expect(results).toBeDefined();
    });

    it('should default count to 1', async () => {
      setMockResponse({ variations: [mockVariationsResult.variations[0]] });

      const results = await client.generation.variations(
        'Test prompt',
        [['safety']]
      );

      expect(results).toBeDefined();
    });

    it('should throw ValidationError on empty prompt', async () => {
      await expect(
        client.generation.variations('', [['safety']])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on empty dimension sets', async () => {
      await expect(
        client.generation.variations('Test prompt', [])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if any dimension set is empty', async () => {
      await expect(
        client.generation.variations('Test prompt', [['safety'], []])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on invalid count (< 1)', async () => {
      await expect(
        client.generation.variations('Test prompt', [['safety']], 0)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on invalid count (> 5)', async () => {
      await expect(
        client.generation.variations('Test prompt', [['safety']], 6)
      ).rejects.toThrow(ValidationError);
    });
  });
});
