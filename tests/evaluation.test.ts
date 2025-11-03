import { RailScore } from '../src/client';
import { ValidationError } from '../src/errors';
import { setMockResponse, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('Evaluation API', () => {
  let client: RailScore;

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  describe('basic', () => {
    const mockEvaluationResult = {
      railScore: {
        score: 8.5,
        confidence: 0.92,
      },
      scores: {
        safety: {
          score: 9.0,
          confidence: 0.95,
          explanation: 'Content is safe',
          issues: [],
        },
        privacy: {
          score: 8.0,
          confidence: 0.90,
          explanation: 'Good privacy practices',
          issues: [],
        },
      },
      metadata: {
        reqId: 'req-123',
        tier: 'balanced',
        queueWaitTimeMs: 10,
        processingTimeMs: 500,
        creditsConsumed: 1,
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    it('should evaluate content successfully', async () => {
      setMockResponse(mockEvaluationResult);

      const result = await client.evaluation.basic('Test content');

      expect(result.railScore.score).toBe(8.5);
      expect(result.railScore.confidence).toBe(0.92);
      expect(result.scores.safety.score).toBe(9.0);
    });

    it('should accept custom weights', async () => {
      setMockResponse(mockEvaluationResult);

      const weights = { safety: 0.6, privacy: 0.4 };
      const result = await client.evaluation.basic('Test content', weights);

      expect(result).toBeDefined();
      expect(result.railScore).toBeDefined();
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.evaluation.basic('')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on whitespace-only content', async () => {
      await expect(
        client.evaluation.basic('   ')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('dimension', () => {
    const mockDimensionScore = {
      score: {
        score: 8.5,
        confidence: 0.90,
        explanation: 'Content demonstrates good privacy practices',
        issues: ['Could be more explicit about data retention'],
      },
    };

    it('should evaluate a specific dimension successfully', async () => {
      setMockResponse(mockDimensionScore);

      const result = await client.evaluation.dimension('Test content', 'privacy');

      expect(result.score).toBe(8.5);
      expect(result.confidence).toBe(0.90);
      expect(result.explanation).toBeDefined();
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.evaluation.dimension('', 'safety')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when dimension is missing', async () => {
      await expect(
        client.evaluation.dimension('Test content', '' as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('custom', () => {
    const mockCustomResult = {
      railScore: { score: 8.0, confidence: 0.88 },
      scores: {
        safety: { score: 8.5, confidence: 0.90, explanation: 'Safe content', issues: [] },
        privacy: { score: 7.5, confidence: 0.85, explanation: 'Good privacy', issues: [] },
      },
      metadata: {
        reqId: 'req-456',
        tier: 'balanced',
        queueWaitTimeMs: 5,
        processingTimeMs: 300,
        creditsConsumed: 1,
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    it('should evaluate with custom dimensions successfully', async () => {
      setMockResponse(mockCustomResult);

      const result = await client.evaluation.custom(
        'Test content',
        ['safety', 'privacy']
      );

      expect(result.railScore.score).toBe(8.0);
      expect(Object.keys(result.scores)).toContain('safety');
      expect(Object.keys(result.scores)).toContain('privacy');
    });

    it('should accept custom weights', async () => {
      setMockResponse(mockCustomResult);

      const result = await client.evaluation.custom(
        'Test content',
        ['safety', 'privacy'],
        { safety: 0.7, privacy: 0.3 }
      );

      expect(result).toBeDefined();
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.evaluation.custom('', ['safety'])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on empty dimensions array', async () => {
      await expect(
        client.evaluation.custom('Test content', [])
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('batch', () => {
    const mockBatchResult = {
      results: [
        {
          railScore: { score: 8.5, confidence: 0.92 },
          scores: {
            safety: { score: 9.0, confidence: 0.95, explanation: 'Safe', issues: [] },
          },
          metadata: {
            reqId: 'req-1',
            tier: 'balanced',
            queueWaitTimeMs: 10,
            processingTimeMs: 500,
            creditsConsumed: 1,
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
        {
          railScore: { score: 7.5, confidence: 0.88 },
          scores: {
            safety: { score: 8.0, confidence: 0.90, explanation: 'Mostly safe', issues: [] },
          },
          metadata: {
            reqId: 'req-2',
            tier: 'balanced',
            queueWaitTimeMs: 10,
            processingTimeMs: 500,
            creditsConsumed: 1,
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
      ],
      totalItems: 2,
      successful: 2,
      failed: 0,
    };

    it('should evaluate batch of strings successfully', async () => {
      setMockResponse(mockBatchResult);

      const result = await client.evaluation.batch([
        'First content',
        'Second content',
      ]);

      expect(result.totalItems).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('should evaluate batch of BatchItem objects successfully', async () => {
      setMockResponse(mockBatchResult);

      const result = await client.evaluation.batch([
        { content: 'First content', id: 'item-1' },
        { content: 'Second content', id: 'item-2' },
      ]);

      expect(result.totalItems).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('should accept optional dimensions parameter', async () => {
      setMockResponse(mockBatchResult);

      const result = await client.evaluation.batch(
        ['Content 1', 'Content 2'],
        ['safety', 'privacy']
      );

      expect(result).toBeDefined();
    });

    it('should accept tier parameter', async () => {
      setMockResponse(mockBatchResult);

      const result = await client.evaluation.batch(
        ['Content 1', 'Content 2'],
        undefined,
        'fast'
      );

      expect(result).toBeDefined();
    });

    it('should throw ValidationError on empty items array', async () => {
      await expect(
        client.evaluation.batch([])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if any item has empty content', async () => {
      await expect(
        client.evaluation.batch([
          { content: 'Valid content', id: 'item-1' },
          { content: '', id: 'item-2' },
        ])
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('ragEvaluate', () => {
    const mockRagResult = {
      ragScore: { score: 8.5, confidence: 0.90 },
      metrics: {
        contextRelevance: { score: 8.0, confidence: 0.88 },
        faithfulness: { score: 9.0, confidence: 0.92 },
        answerRelevance: { score: 8.5, confidence: 0.90 },
      },
      analysis: {
        issues: ['Minor inconsistency in data citation'],
        suggestions: ['Add more specific references'],
      },
      metadata: {
        reqId: 'req-rag-1',
        tier: 'balanced',
        queueWaitTimeMs: 15,
        processingTimeMs: 800,
        creditsConsumed: 2,
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    it('should evaluate RAG response successfully', async () => {
      setMockResponse(mockRagResult);

      const result = await client.evaluation.ragEvaluate(
        'What is GDPR?',
        'GDPR is a regulation in EU law on data protection.',
        [
          { content: 'GDPR stands for General Data Protection Regulation.' },
          { content: 'It was implemented in May 2018.' },
        ]
      );

      expect(result.ragScore.score).toBe(8.5);
      expect(result.metrics.contextRelevance).toBeDefined();
      expect(result.metrics.faithfulness).toBeDefined();
      expect(result.metrics.answerRelevance).toBeDefined();
    });

    it('should accept context chunks with optional metadata', async () => {
      setMockResponse(mockRagResult);

      const result = await client.evaluation.ragEvaluate(
        'What is GDPR?',
        'GDPR is a regulation in EU law.',
        [
          {
            content: 'GDPR stands for General Data Protection Regulation.',
            source: 'document-1',
            relevance: 0.95,
          },
        ]
      );

      expect(result).toBeDefined();
    });

    it('should throw ValidationError on empty query', async () => {
      await expect(
        client.evaluation.ragEvaluate(
          '',
          'Response here',
          [{ content: 'Context' }]
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on empty response', async () => {
      await expect(
        client.evaluation.ragEvaluate(
          'Query here',
          '',
          [{ content: 'Context' }]
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on empty context chunks', async () => {
      await expect(
        client.evaluation.ragEvaluate(
          'Query here',
          'Response here',
          []
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if any context chunk has empty content', async () => {
      await expect(
        client.evaluation.ragEvaluate(
          'Query here',
          'Response here',
          [
            { content: 'Valid context' },
            { content: '' },
          ]
        )
      ).rejects.toThrow(ValidationError);
    });
  });
});
