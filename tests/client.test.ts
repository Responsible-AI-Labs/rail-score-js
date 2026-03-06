import { RailScore } from '../src/client';
import {
  AuthenticationError,
  InsufficientCreditsError,
  InsufficientTierError,
  ServiceUnavailableError,
  ValidationError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  SessionExpiredError,
  ContentTooHarmfulError,
  EvaluationFailedError,
  NotImplementedByServerError,
} from '../src/errors';
import { setMockResponse, setMockError, resetMock } from './__mocks__/node-fetch';

jest.mock('node-fetch');

describe('RailScore Client', () => {
  let client: RailScore;

  beforeEach(() => {
    resetMock();
    client = new RailScore({ apiKey: 'test-api-key' });
  });

  afterEach(() => {
    resetMock();
  });

  describe('Constructor', () => {
    it('should initialize with API key', () => {
      expect(client).toBeInstanceOf(RailScore);
    });

    it('should throw ValidationError when API key is missing', () => {
      expect(() => {
        new RailScore({ apiKey: '' });
      }).toThrow(ValidationError);
    });

    it('should use default base URL when not provided', () => {
      const defaultClient = new RailScore({ apiKey: 'test-key' });
      expect(defaultClient).toBeDefined();
    });

    it('should use custom base URL when provided', () => {
      const customClient = new RailScore({
        apiKey: 'test-key',
        baseUrl: 'https://custom-api.example.com',
      });
      expect(customClient).toBeDefined();
    });

    it('should use custom timeout when provided', () => {
      const customClient = new RailScore({
        apiKey: 'test-key',
        timeout: 60000,
      });
      expect(customClient).toBeDefined();
    });
  });

  describe('health', () => {
    it('should return health status successfully', async () => {
      setMockResponse({ status: 'healthy', service: 'rail-score-engine' });

      const health = await client.health();
      expect(health.status).toBe('healthy');
      expect(health.service).toBe('rail-score-engine');
    });
  });

  describe('Error Handling', () => {
    it('should throw AuthenticationError on 401', async () => {
      setMockResponse({ message: 'Invalid API key' }, 401, false);

      await expect(client.eval({ content: 'test' })).rejects.toThrow(AuthenticationError);
    });

    it('should throw InsufficientCreditsError on 402', async () => {
      setMockResponse(
        { message: 'Insufficient credits', balance: 0, required: 10 },
        402,
        false
      );

      await expect(client.eval({ content: 'test' })).rejects.toThrow(InsufficientCreditsError);
    });

    it('should throw InsufficientTierError on 403 with tier info', async () => {
      setMockResponse(
        { message: 'Feature requires pro tier', required_tier: 'pro', current_tier: 'free' },
        403,
        false
      );

      try {
        await client.eval({ content: 'test' });
        fail('Expected InsufficientTierError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(InsufficientTierError);
        expect(error.requiredTier).toBe('pro');
        expect(error.currentTier).toBe('free');
      }
    });

    it('should throw SessionExpiredError on 410', async () => {
      setMockResponse({ message: 'Session expired' }, 410, false);

      await expect(
        client.safeRegenerateContinue({ sessionId: 'sr_123', regeneratedContent: 'test' })
      ).rejects.toThrow(SessionExpiredError);
    });

    it('should throw ContentTooHarmfulError on 422', async () => {
      setMockResponse({ message: 'Content too harmful' }, 422, false);

      await expect(client.eval({ content: 'test' })).rejects.toThrow(ContentTooHarmfulError);
    });

    it('should throw RateLimitError on 429', async () => {
      setMockResponse(
        { message: 'Rate limit exceeded', retry_after: 60 },
        429,
        false
      );

      await expect(client.eval({ content: 'test' })).rejects.toThrow(RateLimitError);
    });

    it('should throw EvaluationFailedError on 500', async () => {
      setMockResponse(
        { message: 'Internal server error', req_id: 'req-123' },
        500,
        false
      );

      await expect(client.eval({ content: 'test' })).rejects.toThrow(EvaluationFailedError);
    });

    it('should throw NotImplementedByServerError on 501', async () => {
      setMockResponse({ message: 'Not implemented' }, 501, false);

      await expect(client.eval({ content: 'test' })).rejects.toThrow(NotImplementedByServerError);
    });

    it('should throw ServiceUnavailableError on 503', async () => {
      setMockResponse(
        { message: 'Service temporarily unavailable', retry_after: 30 },
        503,
        false
      );

      try {
        await client.eval({ content: 'test' });
        fail('Expected ServiceUnavailableError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        expect(error.retryAfter).toBe(30);
        expect(error.statusCode).toBe(503);
      }
    });

    it('should throw TimeoutError on timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      setMockError(abortError);

      await expect(client.eval({ content: 'test' })).rejects.toThrow(TimeoutError);
    });

    it('should throw NetworkError on network failure', async () => {
      const networkError = new Error('Network connection failed');
      setMockError(networkError);

      await expect(client.eval({ content: 'test' })).rejects.toThrow(NetworkError);
    });

    it('should handle error responses without message', async () => {
      setMockResponse({}, 500, false);

      await expect(client.eval({ content: 'test' })).rejects.toThrow(EvaluationFailedError);
    });

    it('should handle malformed JSON error responses', async () => {
      setMockResponse(null, 500, false);

      await expect(client.eval({ content: 'test' })).rejects.toThrow(EvaluationFailedError);
    });
  });

  describe('Request Configuration', () => {
    it('should include User-Agent header with version 2.2.1', async () => {
      const fetchMock = require('node-fetch').default;
      setMockResponse({ status: 'healthy', service: 'rail-score-engine' });

      await client.health();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'rail-score-js/2.2.1',
          }),
        })
      );
    });

    it('should not include Authorization header for health endpoint', async () => {
      const fetchMock = require('node-fetch').default;
      setMockResponse({ status: 'healthy', service: 'rail-score-engine' });

      await client.health();

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should include Authorization header for eval endpoint', async () => {
      const fetchMock = require('node-fetch').default;
      setMockResponse({
        rail_score: { score: 8.0, confidence: 0.9, summary: 'Good' },
        explanation: '',
        dimension_scores: {},
        from_cache: false,
      });

      await client.eval({ content: 'Test content' });

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers['Authorization']).toBe('Bearer test-api-key');
    });
  });
});
