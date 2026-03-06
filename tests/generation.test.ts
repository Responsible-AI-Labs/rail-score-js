import { RailScore } from '../src/client';
import { ValidationError, ContentTooHarmfulError, SessionExpiredError } from '../src/errors';
import { setMockResponse, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('RailScore Client v2.2.1', () => {
  let client: RailScore;

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  describe('eval', () => {
    const mockEvalResult = {
      rail_score: { score: 8.5, confidence: 0.92, summary: 'Good overall score' },
      explanation: 'The content demonstrates strong responsible AI practices.',
      dimension_scores: {
        safety: { score: 9.0, confidence: 0.95, explanation: 'Very safe' },
        privacy: { score: 8.0, confidence: 0.90, explanation: 'Good privacy' },
      },
      from_cache: false,
    };

    it('should evaluate content successfully', async () => {
      setMockResponse(mockEvalResult);

      const result = await client.eval({
        content: 'AI should prioritize human welfare and safety.',
      });

      expect(result.rail_score.score).toBe(8.5);
      expect(result.rail_score.summary).toBe('Good overall score');
      expect(result.dimension_scores.safety.score).toBe(9.0);
      expect(result.from_cache).toBe(false);
    });

    it('should accept all eval options', async () => {
      setMockResponse(mockEvalResult);

      const result = await client.eval({
        content: 'Test content',
        mode: 'deep',
        domain: 'healthcare',
        dimensions: ['safety', 'reliability'],
        includeSuggestions: true,
        includeExplanations: true,
        includeIssues: true,
      });

      expect(result).toBeDefined();
    });

    it('should accept custom weights that sum to 100', async () => {
      setMockResponse(mockEvalResult);

      const result = await client.eval({
        content: 'Test content',
        weights: { safety: 50, privacy: 50 },
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
  });

  describe('safeRegenerate', () => {
    const mockSafeRegenResult = {
      status: 'passed',
      original_content: 'Our AI system collects user data.',
      credits_consumed: 2.5,
      metadata: { req_id: 'req-123', mode: 'basic', total_iterations: 2 },
      best_content: 'Our AI system collects user data with explicit consent.',
      best_iteration: 2,
      best_scores: {
        rail_score: { score: 8.5, confidence: 0.90 },
        dimension_scores: { safety: { score: 9.0, confidence: 0.95 } },
      },
      iteration_history: [
        {
          iteration: 1,
          content: 'First attempt',
          scores: { rail_score: { score: 7.0 } },
          thresholds_met: false,
          failing_dimensions: ['privacy'],
          improvement_from_previous: null,
          latency_ms: 500,
        },
        {
          iteration: 2,
          content: 'Second attempt',
          scores: { rail_score: { score: 8.5 } },
          thresholds_met: true,
          failing_dimensions: [],
          improvement_from_previous: 1.5,
          latency_ms: 450,
        },
      ],
    };

    it('should safe-regenerate content successfully', async () => {
      setMockResponse(mockSafeRegenResult);

      const result = await client.safeRegenerate({
        content: 'Our AI system collects user data.',
        mode: 'basic',
        maxRegenerations: 2,
        regenerationModel: 'RAIL_Safe_LLM',
        thresholds: { overall: { score: 8.0, confidence: 0.5 } },
      });

      expect(result.status).toBe('passed');
      expect(result.best_content).toBeTruthy();
      expect(result.best_scores?.rail_score.score).toBe(8.5);
      expect(result.iteration_history).toHaveLength(2);
    });

    it('should support external mode', async () => {
      setMockResponse({
        status: 'awaiting_regeneration',
        original_content: 'Test',
        credits_consumed: 1.0,
        metadata: { req_id: 'req-456', mode: 'basic' },
        session_id: 'sr_abc123',
        iteration: 1,
        iterations_remaining: 1,
        current_scores: { rail_score: { score: 5.0 } },
        rail_prompt: {
          system_prompt: 'You are a helpful assistant...',
          user_prompt: 'Improve this content...',
          temperature: 0.7,
        },
      });

      const result = await client.safeRegenerate({
        content: 'Test content',
        regenerationModel: 'external',
        maxRegenerations: 1,
      });

      expect(result.status).toBe('awaiting_regeneration');
      expect(result.session_id).toBe('sr_abc123');
      expect(result.rail_prompt).toBeDefined();
      expect(result.rail_prompt?.system_prompt).toBeTruthy();
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.safeRegenerate({ content: '' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('safeRegenerateContinue', () => {
    it('should continue an external session', async () => {
      setMockResponse({
        status: 'passed',
        original_content: 'Original',
        credits_consumed: 1.0,
        metadata: { req_id: 'req-789', mode: 'basic' },
        best_content: 'Improved content',
        best_iteration: 1,
        best_scores: {
          rail_score: { score: 9.0 },
          dimension_scores: {},
        },
      });

      const result = await client.safeRegenerateContinue({
        sessionId: 'sr_abc123',
        regeneratedContent: 'My improved content',
      });

      expect(result.status).toBe('passed');
      expect(result.best_content).toBe('Improved content');
    });

    it('should throw ValidationError on missing session ID', async () => {
      await expect(
        client.safeRegenerateContinue({ sessionId: '', regeneratedContent: 'test' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on empty regenerated content', async () => {
      await expect(
        client.safeRegenerateContinue({ sessionId: 'sr_123', regeneratedContent: '' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('complianceCheck', () => {
    const mockComplianceResult = {
      framework: 'gdpr',
      framework_version: '2016/679',
      framework_url: 'https://gdpr.eu',
      evaluated_at: '2026-03-07T00:00:00Z',
      compliance_score: { score: 4.5, confidence: 0.85, label: 'Fair', summary: 'Needs work' },
      dimension_scores: {},
      requirements_checked: 10,
      requirements_passed: 5,
      requirements_failed: 3,
      requirements_warned: 2,
      requirements: [],
      issues: [
        {
          id: 'gdpr-1',
          description: 'Missing consent mechanism',
          dimension: 'privacy',
          severity: 'high',
          requirement: 'Consent',
          article: 'Art. 7',
          reference_url: 'https://gdpr.eu/article-7',
          remediation_effort: 'medium',
        },
      ],
      improvement_suggestions: ['Add explicit consent'],
      from_cache: false,
    };

    it('should check single framework compliance', async () => {
      setMockResponse(mockComplianceResult);

      const result = await client.complianceCheck({
        content: 'We collect user data without consent.',
        framework: 'gdpr',
        context: { domain: 'e-commerce', data_types: ['browsing_history'] },
      });

      expect(result.framework).toBe('gdpr');
      expect(result.compliance_score.label).toBe('Fair');
      expect(result.requirements_passed).toBe(5);
      expect(result.issues).toHaveLength(1);
    });

    it('should resolve framework aliases', async () => {
      setMockResponse(mockComplianceResult);

      // 'ai_act' should resolve to 'eu_ai_act'
      const result = await client.complianceCheck({
        content: 'Test content',
        framework: 'ai_act',
      });

      expect(result).toBeDefined();
    });

    it('should check multi-framework compliance', async () => {
      const mockMulti = {
        results: {
          gdpr: mockComplianceResult,
          ccpa: { ...mockComplianceResult, framework: 'ccpa' },
        },
        cross_framework_summary: {
          frameworks_evaluated: 2,
          average_score: 4.5,
          weakest_framework: 'gdpr',
          weakest_score: 4.5,
        },
      };

      setMockResponse(mockMulti);

      const result = await client.complianceCheck({
        content: 'Test content',
        frameworks: ['gdpr', 'ccpa'],
      });

      expect((result as any).cross_framework_summary).toBeDefined();
      expect((result as any).cross_framework_summary.frameworks_evaluated).toBe(2);
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.complianceCheck({ content: '', framework: 'gdpr' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on empty frameworks array', async () => {
      await expect(
        client.complianceCheck({ content: 'test', frameworks: [] } as any)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on more than 5 frameworks', async () => {
      await expect(
        client.complianceCheck({
          content: 'test',
          frameworks: ['gdpr', 'ccpa', 'hipaa', 'eu_ai_act', 'india_dpdp', 'india_ai_gov'],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should support strict mode', async () => {
      setMockResponse(mockComplianceResult);

      const result = await client.complianceCheck({
        content: 'Test content',
        framework: 'ccpa',
        strictMode: true,
      });

      expect(result).toBeDefined();
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      setMockResponse({ status: 'healthy', service: 'rail-score-engine' });

      const health = await client.health();

      expect(health.status).toBe('healthy');
      expect(health.service).toBe('rail-score-engine');
    });
  });
});
