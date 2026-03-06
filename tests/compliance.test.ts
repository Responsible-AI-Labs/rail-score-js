import { RailScore } from '../src/client';
import { ValidationError } from '../src/errors';
import { setMockResponse, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('Compliance API', () => {
  let client: RailScore;

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  const mockComplianceResult = {
    framework: 'gdpr',
    framework_version: '2016/679',
    framework_url: 'https://gdpr.eu',
    evaluated_at: '2026-03-07T00:00:00Z',
    compliance_score: { score: 6.5, confidence: 0.85, label: 'Good', summary: 'Generally compliant' },
    dimension_scores: {},
    requirements_checked: 10,
    requirements_passed: 7,
    requirements_failed: 2,
    requirements_warned: 1,
    requirements: [],
    issues: [
      {
        id: 'gdpr-1',
        description: 'No explicit consent mechanism found',
        dimension: 'privacy',
        severity: 'high',
        requirement: 'User consent',
        article: 'Art. 7',
        reference_url: 'https://gdpr.eu/article-7',
        remediation_effort: 'medium',
      },
    ],
    improvement_suggestions: ['Implement explicit consent mechanism'],
    from_cache: false,
  };

  describe('single framework', () => {
    it('should check compliance successfully', async () => {
      setMockResponse(mockComplianceResult);

      const result = await client.complianceCheck({
        content: 'We collect and process user data for analytics...',
        framework: 'gdpr',
      });

      expect(result.framework).toBe('gdpr');
      expect(result.compliance_score.score).toBe(6.5);
      expect(result.requirements_checked).toBe(10);
      expect(result.issues).toHaveLength(1);
    });

    it('should accept context parameter', async () => {
      setMockResponse(mockComplianceResult);

      const result = await client.complianceCheck({
        content: 'We collect user data for analytics...',
        framework: 'gdpr',
        context: { domain: 'e-commerce', data_types: ['browsing_history'] },
      });

      expect(result).toBeDefined();
      expect(result.framework).toBe('gdpr');
    });

    it('should accept strictMode parameter', async () => {
      setMockResponse(mockComplianceResult);

      const result = await client.complianceCheck({
        content: 'Test content',
        framework: 'ccpa',
        strictMode: true,
      });

      expect(result).toBeDefined();
    });

    it('should resolve framework aliases', async () => {
      setMockResponse({ ...mockComplianceResult, framework: 'eu_ai_act' });

      const result = await client.complianceCheck({
        content: 'Our AI system classifies users...',
        framework: 'ai_act',
      });

      expect(result).toBeDefined();
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.complianceCheck({ content: '', framework: 'gdpr' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('multi-framework', () => {
    const mockMultiResult = {
      results: {
        gdpr: mockComplianceResult,
        ccpa: { ...mockComplianceResult, framework: 'ccpa' },
      },
      cross_framework_summary: {
        frameworks_evaluated: 2,
        average_score: 6.5,
        weakest_framework: 'gdpr',
        weakest_score: 6.5,
      },
    };

    it('should check multiple frameworks successfully', async () => {
      setMockResponse(mockMultiResult);

      const result = await client.complianceCheck({
        content: 'Our healthcare app processes patient data...',
        frameworks: ['gdpr', 'ccpa'],
      });

      expect((result as any).cross_framework_summary).toBeDefined();
      expect((result as any).cross_framework_summary.frameworks_evaluated).toBe(2);
    });

    it('should throw ValidationError on empty frameworks array', async () => {
      await expect(
        client.complianceCheck({ content: 'Test', frameworks: [] } as any)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on more than 5 frameworks', async () => {
      await expect(
        client.complianceCheck({
          content: 'Test',
          frameworks: ['gdpr', 'ccpa', 'hipaa', 'eu_ai_act', 'india_dpdp', 'india_ai_gov'],
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
