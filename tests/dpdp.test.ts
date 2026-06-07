import { RailScore } from '../src/client';
import { DPDPContentScanner } from '../src/dpdp';
import { ValidationError, DPDPHostedOnlyError } from '../src/errors';
import { setMockResponse, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('DPDP compliance namespace', () => {
  let client: RailScore;

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-rail-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  describe('scan()', () => {
    it('maps a server scan response to camelCase', async () => {
      setMockResponse({
        result: {
          compliant: false,
          pii_found: [
            {
              type: 'aadhaar',
              original: '2345 6789 0124',
              masked: 'XXXX XXXX 0124',
              position: { start: 8, end: 22 },
              severity: 'high',
              section: 'S.8(5)',
              penalty_crore: 250,
            },
          ],
          child_signals: [],
          child_session: false,
          purpose_drift: false,
          checks_run: ['pii', 'child'],
          latency_ms: 12.5,
        },
        credits_consumed: 1.0,
      });

      const result = await client.dpdp.scan('My id is 2345 6789 0124', { piiAction: 'mask' });

      expect(result.compliant).toBe(false);
      expect(result.piiFound).toHaveLength(1);
      expect(result.piiFound[0].type).toBe('aadhaar');
      expect(result.piiFound[0].penaltyCrore).toBe(250);
      expect(result.latencyMs).toBe(12.5);
      expect(result.creditsConsumed).toBe(1.0);
    });
  });

  describe('evaluate()', () => {
    it('returns a decision with verdict and violations', async () => {
      setMockResponse({
        result: {
          verdict: 'block',
          violations: [
            { rule: 'consent', section: 'S.6', severity: 'high', penalty_crore: 50 },
          ],
          required_before_proceed: [{ type: 'consent', reason: 'missing' }],
        },
        credits_consumed: 0.5,
      });

      const decision = await client.dpdp.evaluate('process_data', { purpose: 'analytics' });

      expect(decision.verdict).toBe('block');
      expect(decision.violations[0].penaltyCrore).toBe(50);
      expect(decision.requiredBeforeProceed[0].type).toBe('consent');
      expect(decision.creditsConsumed).toBe(0.5);
    });
  });

  describe('emit()', () => {
    it('wraps a single event in a list and maps results', async () => {
      setMockResponse({
        result: {
          accepted: 1,
          rejected: 0,
          events: [{ event_id: 'evt_1', type: 'consent.granted', status: 'recorded' }],
        },
      });

      const result = await client.dpdp.emit({ type: 'consent.granted', data: {} });

      expect(result.accepted).toBe(1);
      expect(result.events[0].eventId).toBe('evt_1');
    });
  });

  describe('createSession()', () => {
    it('throws ValidationError when purpose is empty', async () => {
      await expect(
        client.dpdp.createSession({ purpose: '   ' })
      ).rejects.toThrow(ValidationError);
    });

    it('creates a session when purpose is provided', async () => {
      setMockResponse({
        result: {
          session_id: 'sess_abc',
          created_at: '2026-06-07T00:00:00Z',
          config: { purpose: 'loan processing' },
        },
      });

      const session = await client.dpdp.createSession({
        purpose: 'loan processing',
        sector: 'fintech',
      });

      expect(session.sessionId).toBe('sess_abc');
      expect(session.config.purpose).toBe('loan processing');
    });
  });

  describe('getSession()', () => {
    it('retrieves a session and maps state', async () => {
      setMockResponse({
        result: {
          session_id: 'sess_abc',
          created_at: '2026-06-07T00:00:00Z',
          state: { events_count: 3, child_session: true },
        },
      });

      const session = await client.dpdp.getSession('sess_abc');

      expect(session.sessionId).toBe('sess_abc');
      expect(session.state?.eventsCount).toBe(3);
      expect(session.state?.childSession).toBe(true);
    });
  });

  describe('listTimers()', () => {
    it('maps timers and summary', async () => {
      setMockResponse({
        result: {
          timers: [
            { timer_id: 't1', type: 'dsr', started_at: 'x', deadline: 'y', days_remaining: 3 },
          ],
          summary: { total_active: 1, overdue: 0, approaching_7_days: 1 },
        },
      });

      const list = await client.dpdp.listTimers({ status: 'active', approachingDays: 7 });

      expect(list.timers[0].timerId).toBe('t1');
      expect(list.timers[0].daysRemaining).toBe(3);
      expect(list.summary?.totalActive).toBe(1);
      expect(list.summary?.approachingDays).toBe(1);
    });
  });

  describe('dpdpAudit()', () => {
    it('maps a tiered audit result', async () => {
      setMockResponse({
        result: {
          framework: 'india_dpdp',
          framework_version: '2023',
          compliance_score: { score: 7.2, label: 'Good' },
          requirements_checked: 5,
          requirements_passed: 4,
          requirements: [
            {
              requirement_id: 'r1',
              requirement: 'Consent',
              article: 'S.6',
              status: 'pass',
              score: 8,
              tier: 'tier_1',
            },
          ],
          total_penalty_exposure_crore: 0,
        },
      });

      const audit = await client.dpdp.dpdpAudit('Privacy policy text', {
        sector: 'fintech',
      });

      expect(audit.framework).toBe('india_dpdp');
      expect(audit.overallScore).toBe(7.2);
      expect(audit.overallLabel).toBe('Good');
      expect(audit.requirements[0].requirementId).toBe('r1');
    });

    it('raises DPDPHostedOnlyError on a 404 from the audit endpoint', async () => {
      setMockResponse({ message: 'not found' }, 404, false);

      await expect(
        client.dpdp.dpdpAudit('content')
      ).rejects.toThrow(DPDPHostedOnlyError);
    });

    it('raises DPDPHostedOnlyError on a 501 from the audit endpoint', async () => {
      setMockResponse({ message: 'not implemented' }, 501, false);

      await expect(
        client.dpdp.dpdpAudit('content')
      ).rejects.toThrow(DPDPHostedOnlyError);
    });
  });
});

describe('DPDPContentScanner (local)', () => {
  it('detects Indian mobile numbers locally', () => {
    const scanner = new DPDPContentScanner({ piiPatterns: ['mobile_in'] });
    const result = scanner.scanText('Call me on +91 9876543210 anytime');

    expect(result.compliant).toBe(false);
    expect(result.piiFound.some((p) => p.type === 'mobile_in')).toBe(true);
  });

  it('validates Aadhaar with the Verhoeff checksum', () => {
    const scanner = new DPDPContentScanner({ piiPatterns: ['aadhaar'] });

    // Verhoeff-valid number → detected.
    const valid = scanner.scanText('Aadhaar: 2345 6789 0124');
    expect(valid.piiFound.some((p) => p.type === 'aadhaar')).toBe(true);

    // Checksum-invalid number → rejected.
    const invalid = scanner.scanText('Aadhaar: 2345 6789 0125');
    expect(invalid.piiFound.some((p) => p.type === 'aadhaar')).toBe(false);
  });

  it('masks PII when piiAction is "mask"', () => {
    const scanner = new DPDPContentScanner({ piiPatterns: ['mobile_in'], piiAction: 'mask' });
    const result = scanner.scanText('Reach me at +91 9876543210');
    const [processed] = scanner.applyActions(result, 'Reach me at +91 9876543210');

    expect(processed).toContain('[MOBILE]');
    expect(processed).not.toContain('9876543210');
  });

  it('detects child age signals', () => {
    const scanner = new DPDPContentScanner();
    const result = scanner.scanText('I am 12 years old and I love games');

    expect(result.childSignals.some((s) => s.signalType === 'age_mention')).toBe(true);
    expect(result.sessionFlags).toContain('child_data_detected');
  });

  it('does not flag adults', () => {
    const scanner = new DPDPContentScanner();
    const result = scanner.scanText('I am 25 years old');

    expect(result.childSignals).toHaveLength(0);
  });

  it('throws ValidationError on an invalid config value', () => {
    expect(() => new DPDPContentScanner({ piiAction: 'nope' as any })).toThrow(ValidationError);
  });
});
