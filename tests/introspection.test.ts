import { RailScore } from '../src/client';
import { setMockResponse, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('Configuration introspection (v2.6.0)', () => {
  let client: RailScore;

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-rail-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  describe('getConfig()', () => {
    it('maps the application config (camelCase API fields)', async () => {
      setMockResponse({
        application: {
          id: 'app_1',
          environment: 'production',
          organization: 'org_1',
          plan: 'pro',
        },
        policy: {
          enforcement: 'block',
          evalMode: 'deep',
          overallThreshold: 8.0,
          domain: 'finance',
          dimensionThresholds: { safety: 7 },
          dimensionWeights: { safety: 15 },
          compliance: ['gdpr'],
          safeRegenerate: { enabled: true },
          locked: true,
        },
        enforcement: { active: true, mode: 'enforce' },
      });

      const cfg = await client.getConfig();

      expect(cfg.application.id).toBe('app_1');
      expect(cfg.application.plan).toBe('pro');
      expect(cfg.policy.evalMode).toBe('deep');
      expect(cfg.policy.overallThreshold).toBe(8.0);
      expect(cfg.policy.locked).toBe(true);
      expect(cfg.enforcement.active).toBe(true);
      expect(cfg.enforcement.mode).toBe('enforce');
      expect(cfg.raw).toBeDefined();
    });

    it('falls back to defaults on a sparse payload', async () => {
      setMockResponse({});

      const cfg = await client.getConfig();

      expect(cfg.application.id).toBe('');
      expect(cfg.policy.enforcement).toBe('log_only');
      expect(cfg.policy.overallThreshold).toBe(7.0);
      expect(cfg.policy.locked).toBe(false);
      expect(cfg.enforcement.mode).toBe('monitor');
    });
  });

  describe('getCapabilities()', () => {
    it('maps plan capabilities', async () => {
      setMockResponse({
        plan: 'pro',
        evaluation: { modes: ['basic', 'deep'] },
        compliance: { frameworks: ['gdpr', 'india_dpdp'] },
        agent: { enabled: true },
        dpdp: { enabled: true },
        limits: { rpm: 600 },
      });

      const caps = await client.getCapabilities();

      expect(caps.plan).toBe('pro');
      expect(caps.evaluation.modes).toEqual(['basic', 'deep']);
      expect(caps.dpdp.enabled).toBe(true);
      expect(caps.limits.rpm).toBe(600);
    });

    it('defaults plan to "free" when absent', async () => {
      setMockResponse({});
      const caps = await client.getCapabilities();
      expect(caps.plan).toBe('free');
    });
  });

  describe('getDimensions()', () => {
    it('maps dimensions and score bands (snake_case -> camelCase)', async () => {
      setMockResponse({
        dimensions: [{ name: 'safety', weight: 12.5, threshold: 8.0 }],
        score_bands: [{ name: 'good', min: 7.0, max: 8.99 }],
      });

      const dims = await client.getDimensions();

      expect(dims.dimensions).toHaveLength(1);
      expect(dims.dimensions[0].name).toBe('safety');
      expect(dims.scoreBands).toHaveLength(1);
      expect(dims.scoreBands[0].name).toBe('good');
    });
  });
});
