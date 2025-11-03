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

  describe('check', () => {
    const mockComplianceResult = {
      framework: 'gdpr',
      compliant: false,
      score: 6.5,
      requirements: [
        {
          id: 'gdpr-1',
          name: 'Lawful basis for processing',
          status: 'compliant',
          score: 8.0,
          description: 'Clear lawful basis identified',
        },
        {
          id: 'gdpr-2',
          name: 'User consent',
          status: 'non_compliant',
          score: 5.0,
          description: 'Consent mechanism unclear',
        },
      ],
      violations: [
        {
          severity: 'high',
          requirement: 'User consent',
          description: 'No explicit consent mechanism found',
          location: 'Section 3',
          remediation: 'Add clear consent opt-in mechanism',
        },
      ],
      recommendations: [
        'Implement explicit consent mechanism',
        'Add data retention policy',
      ],
      metadata: {
        reqId: 'req-compliance-1',
        tier: 'balanced',
        queueWaitTimeMs: 25,
        processingTimeMs: 2000,
        creditsConsumed: 2,
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    it('should check compliance successfully', async () => {
      setMockResponse(mockComplianceResult);

      const result = await client.compliance.check(
        'We collect and process user data for analytics...',
        'gdpr'
      );

      expect(result.framework).toBe('gdpr');
      expect(result.compliant).toBe(false);
      expect(result.score).toBe(6.5);
      expect(result.requirements).toHaveLength(2);
      expect(result.violations).toHaveLength(1);
    });

    it('should handle compliant result', async () => {
      const compliantResult = { ...mockComplianceResult, compliant: true, score: 9.0 };
      setMockResponse(compliantResult);

      const result = await client.compliance.check('Compliant content', 'gdpr');

      expect(result.compliant).toBe(true);
      expect(result.score).toBe(9.0);
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.compliance.check('', 'gdpr')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on whitespace-only content', async () => {
      await expect(
        client.compliance.check('   ', 'gdpr')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when framework is missing', async () => {
      await expect(
        client.compliance.check('Test content', '' as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('checkMultiple', () => {
    const mockMultipleResults = {
      results: [
        {
          framework: 'gdpr',
          compliant: true,
          score: 9.0,
          requirements: [],
          violations: [],
          recommendations: [],
          metadata: {
            reqId: 'req-multi-1',
            tier: 'balanced',
            queueWaitTimeMs: 30,
            processingTimeMs: 2500,
            creditsConsumed: 4,
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
        {
          framework: 'hipaa',
          compliant: false,
          score: 7.0,
          requirements: [],
          violations: [
            {
              severity: 'medium',
              requirement: 'PHI protection',
              description: 'Insufficient PHI safeguards',
              remediation: 'Implement additional PHI protections',
            },
          ],
          recommendations: ['Add PHI encryption'],
          metadata: {
            reqId: 'req-multi-2',
            tier: 'balanced',
            queueWaitTimeMs: 30,
            processingTimeMs: 2500,
            creditsConsumed: 4,
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
      ],
    };

    it('should check multiple frameworks successfully', async () => {
      setMockResponse(mockMultipleResults);

      const results = await client.compliance.checkMultiple(
        'Our healthcare app processes patient data...',
        ['gdpr', 'hipaa']
      );

      expect(results).toHaveLength(2);
      expect(results[0].framework).toBe('gdpr');
      expect(results[1].framework).toBe('hipaa');
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.compliance.checkMultiple('', ['gdpr'])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on empty frameworks array', async () => {
      await expect(
        client.compliance.checkMultiple('Test content', [])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on too many frameworks (> 10)', async () => {
      const tooManyFrameworks = Array(11).fill('gdpr') as any[];

      await expect(
        client.compliance.checkMultiple('Test content', tooManyFrameworks)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getRequirements', () => {
    const mockRequirements = {
      framework: 'gdpr',
      name: 'General Data Protection Regulation',
      version: '2016/679',
      description: 'EU regulation on data protection and privacy',
      categories: [
        {
          name: 'Lawfulness of processing',
          requirements: [
            {
              id: 'gdpr-1',
              name: 'Lawful basis',
              description: 'Processing must have a lawful basis',
            },
          ],
        },
      ],
    };

    it('should get framework requirements successfully', async () => {
      setMockResponse(mockRequirements);

      const requirements = await client.compliance.getRequirements('gdpr');

      expect(requirements.framework).toBe('gdpr');
      expect(requirements.name).toBeDefined();
      expect(requirements.categories).toBeDefined();
    });

    it('should throw ValidationError when framework is missing', async () => {
      await expect(
        client.compliance.getRequirements('' as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('scan', () => {
    const mockScanResult = {
      issues: [
        {
          severity: 'high',
          frameworks: ['gdpr', 'ccpa'],
          description: 'Data collection without clear consent',
          recommendation: 'Implement explicit consent mechanism',
        },
        {
          severity: 'medium',
          frameworks: ['pci_dss'],
          description: 'Potential credit card data handling issue',
          recommendation: 'Review PCI DSS requirements',
        },
      ],
      summary: {
        totalIssues: 2,
        criticalIssues: 0,
        highIssues: 1,
        mediumIssues: 1,
        lowIssues: 0,
      },
      affectedFrameworks: ['gdpr', 'ccpa', 'pci_dss'],
    };

    it('should scan for compliance issues successfully', async () => {
      setMockResponse(mockScanResult);

      const result = await client.compliance.scan(
        'We store customer credit card information in our database...'
      );

      expect(result.issues).toBeDefined();
      expect(result.issues).toHaveLength(2);
      expect(result.summary.totalIssues).toBe(2);
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.compliance.scan('')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getRecommendations', () => {
    const mockRecommendations = [
      {
        priority: 'high',
        category: 'Consent',
        suggestion: 'Implement explicit opt-in mechanism for data collection',
        effort: 'medium',
        impact: 'high',
      },
      {
        priority: 'medium',
        category: 'Data retention',
        suggestion: 'Add clear data retention policy',
        effort: 'low',
        impact: 'medium',
      },
    ];

    it('should get recommendations successfully', async () => {
      setMockResponse(mockRecommendations);

      const recommendations = await client.compliance.getRecommendations(
        'We use cookies to track users.',
        'gdpr'
      );

      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].priority).toBe('high');
    });

    it('should accept current violations parameter', async () => {
      setMockResponse(mockRecommendations);

      const recommendations = await client.compliance.getRecommendations(
        'Test content',
        'gdpr',
        ['No consent mechanism', 'Missing privacy policy']
      );

      expect(recommendations).toBeDefined();
    });

    it('should throw ValidationError on empty content', async () => {
      await expect(
        client.compliance.getRecommendations('', 'gdpr')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when framework is missing', async () => {
      await expect(
        client.compliance.getRecommendations('Test content', '' as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('listFrameworks', () => {
    const mockFrameworks = [
      {
        id: 'gdpr',
        name: 'General Data Protection Regulation',
        version: '2016/679',
        region: 'EU',
        description: 'EU data protection regulation',
      },
      {
        id: 'hipaa',
        name: 'Health Insurance Portability and Accountability Act',
        version: '1996',
        region: 'US',
        description: 'US healthcare data protection',
      },
    ];

    it('should list available frameworks successfully', async () => {
      setMockResponse(mockFrameworks);

      const frameworks = await client.compliance.listFrameworks();

      expect(frameworks).toHaveLength(2);
      expect(frameworks[0].id).toBe('gdpr');
      expect(frameworks[1].id).toBe('hipaa');
    });
  });
});
